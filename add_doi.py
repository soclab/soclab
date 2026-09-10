"""Crossref에서 DOI를 찾아 publications.json에 안전하게 추가합니다.

자동 입력 조건
---------------
1. 제목 유사도 0.95 이상
2. 첫 저자 성 완전 일치
3. 논문지명 정규화 후 완전 일치
4. Crossref 자료 유형이 journal-article
5. 연도가 일치하거나 1년 이내
6. https://doi.org/<DOI>가 정상적으로 해석됨

조건을 모두 충족한 항목은 확정 DOI로 기록합니다. 완화된 임시 입력 조건을
충족한 후보는 ``doi_review_required: true``와 함께 DOI를 먼저 기록하고,
보고서에서 추후 검토 대상으로 구분합니다. 임시 입력 조건에도 미달하거나
DOI가 실제로 열리지 않는 후보는 JSON을 수정하지 않습니다.

사용법
------
    py -m pip install requests
    py add_doi.py publications.json --dry-run
    py add_doi.py publications.json

실행 결과
---------
- publications.json: 확정 또는 임시 검토 DOI가 추가된 원본 파일
- publications.backup-YYYYMMDD-HHMMSS.json: 실행 전 백업
- doi_report-YYYYMMDD-HHMMSS.txt: 전체 판정 결과
"""

from __future__ import annotations

import argparse
import difflib
import json
import os
import re
import shutil
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.parse import quote, urlparse
from zoneinfo import ZoneInfo

try:
    import requests
    from requests.adapters import HTTPAdapter
    from urllib3.util.retry import Retry
except ModuleNotFoundError as error:
    raise SystemExit(
        "requests 패키지가 필요합니다. 먼저 'py -m pip install requests'를 실행하세요."
    ) from error


CROSSREF_API_URL = "https://api.crossref.org/works"
DOI_RESOLVER_URL = "https://doi.org/"
MAILTO = "arbitrary@yonsei.ac.kr"
USER_AGENT = f"soclab-publications/2.0 (mailto:{MAILTO})"

TITLE_MATCH_MIN = 0.95
JOURNAL_MATCH_MIN = 1.00
REVIEW_TITLE_MATCH_MIN = 0.75
REVIEW_JOURNAL_MATCH_MIN = 0.80
YEAR_TOLERANCE = 1
SEARCH_RESULT_COUNT = 5
DEFAULT_DELAY_SECONDS = 0.35
REQUEST_TIMEOUT = (8, 25)
REDIRECT_STATUS_CODES = {301, 302, 303, 307, 308}


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Crossref DOI를 확정 또는 추후 검토 대상으로 "
            "publications.json에 추가합니다."
        )
    )
    parser.add_argument(
        "source",
        nargs="?",
        default="publications.json",
        help="대상 JSON 파일 경로 (기본값: publications.json)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="JSON을 수정하지 않고 검색 및 보고서 생성만 수행합니다.",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=DEFAULT_DELAY_SECONDS,
        help=f"논문별 요청 간격(초, 기본값: {DEFAULT_DELAY_SECONDS})",
    )
    return parser.parse_args()


def normalize_text(text: str) -> str:
    normalized = text.casefold()
    normalized = normalized.replace("&", " and ")
    normalized = re.sub(r"[^a-z0-9]+", " ", normalized)
    return re.sub(r"\s+", " ", normalized).strip()


def text_similarity(first: str, second: str) -> float:
    return difflib.SequenceMatcher(
        None,
        normalize_text(first),
        normalize_text(second),
    ).ratio()


def get_local_first_author_surname(publication: dict[str, Any]) -> str:
    authors = publication.get("authors")
    if not isinstance(authors, list) or not authors:
        return ""

    first_author = normalize_text(str(authors[0]))
    return first_author.split()[-1] if first_author else ""


def get_crossref_first_author_surname(item: dict[str, Any]) -> str:
    authors = item.get("author")
    if not isinstance(authors, list) or not authors:
        return ""

    family_name = normalize_text(str(authors[0].get("family", "")))
    return family_name.split()[-1] if family_name else ""


def get_crossref_title(item: dict[str, Any]) -> str:
    titles = item.get("title")
    if not isinstance(titles, list) or not titles:
        return ""
    return str(titles[0])


def get_crossref_journals(item: dict[str, Any]) -> list[str]:
    journals = item.get("container-title")
    if not isinstance(journals, list):
        return []
    return [str(journal) for journal in journals if journal]


def get_crossref_year(item: dict[str, Any]) -> int | None:
    for key in ("published-print", "published-online", "issued"):
        date_parts = item.get(key, {}).get("date-parts", [])
        if not date_parts or not date_parts[0]:
            continue

        year = date_parts[0][0]
        if isinstance(year, int):
            return year

    return None


def calculate_journal_similarity(
    publication: dict[str, Any],
    item: dict[str, Any],
) -> tuple[float, str]:
    local_journal = str(publication.get("journal", ""))
    candidates = get_crossref_journals(item)

    if not local_journal or not candidates:
        return 0.0, ""

    scored_candidates = [
        (text_similarity(local_journal, candidate), candidate)
        for candidate in candidates
    ]
    return max(scored_candidates, key=lambda candidate: candidate[0])


def evaluate_candidate(
    publication: dict[str, Any],
    item: dict[str, Any],
) -> dict[str, Any]:
    crossref_title = get_crossref_title(item)
    title_score = text_similarity(str(publication.get("title", "")), crossref_title)

    local_surname = get_local_first_author_surname(publication)
    crossref_surname = get_crossref_first_author_surname(item)
    author_matches = bool(local_surname) and local_surname == crossref_surname

    journal_score, crossref_journal = calculate_journal_similarity(
        publication,
        item,
    )

    local_year = publication.get("year")
    crossref_year = get_crossref_year(item)
    year_matches = (
        isinstance(local_year, int)
        and isinstance(crossref_year, int)
        and abs(local_year - crossref_year) <= YEAR_TOLERANCE
    )

    doi = str(item.get("DOI", "")).strip()
    type_matches = item.get("type") == "journal-article"

    checks = {
        "title": title_score >= TITLE_MATCH_MIN,
        "first_author": author_matches,
        "journal": journal_score >= JOURNAL_MATCH_MIN,
        "year": year_matches,
        "type": type_matches,
        "doi": bool(doi),
    }
    review_checks = {
        "title": title_score >= REVIEW_TITLE_MATCH_MIN,
        "first_author": author_matches,
        "journal": journal_score >= REVIEW_JOURNAL_MATCH_MIN,
        "year": year_matches,
        "type": type_matches,
        "doi": bool(doi),
    }

    return {
        "item": item,
        "doi": doi,
        "crossref_title": crossref_title,
        "crossref_journal": crossref_journal,
        "crossref_surname": crossref_surname,
        "crossref_year": crossref_year,
        "title_score": title_score,
        "journal_score": journal_score,
        "checks": checks,
        "review_checks": review_checks,
        "metadata_passed": all(checks.values()),
        "review_eligible": all(review_checks.values()),
    }


def candidate_sort_key(evaluation: dict[str, Any]) -> tuple[Any, ...]:
    passed_check_count = sum(evaluation["checks"].values())
    return (
        evaluation["metadata_passed"],
        evaluation["review_eligible"],
        passed_check_count,
        evaluation["title_score"],
        evaluation["journal_score"],
    )


def create_http_session() -> requests.Session:
    retry_policy = Retry(
        total=4,
        connect=4,
        read=4,
        status=4,
        backoff_factor=1.0,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=frozenset({"GET", "HEAD"}),
        respect_retry_after_header=True,
    )

    adapter = HTTPAdapter(max_retries=retry_policy)
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": USER_AGENT,
            "Accept": "application/json",
        }
    )
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    return session


def search_crossref(
    session: requests.Session,
    publication: dict[str, Any],
) -> list[dict[str, Any]]:
    parameters = {
        "query.title": publication.get("title", ""),
        "query.author": get_local_first_author_surname(publication),
        "query.container-title": publication.get("journal", ""),
        "rows": SEARCH_RESULT_COUNT,
        "mailto": MAILTO,
    }

    response = session.get(
        CROSSREF_API_URL,
        params=parameters,
        timeout=REQUEST_TIMEOUT,
    )
    response.raise_for_status()
    payload = response.json()
    items = payload.get("message", {}).get("items", [])
    return items if isinstance(items, list) else []


def select_best_candidate(
    publication: dict[str, Any],
    items: list[dict[str, Any]],
) -> dict[str, Any] | None:
    if not items:
        return None

    evaluations = [evaluate_candidate(publication, item) for item in items]
    return max(evaluations, key=candidate_sort_key)


def is_http_url(url: str) -> bool:
    parsed = urlparse(url)
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def verify_doi_resolution(
    session: requests.Session,
    doi: str,
) -> tuple[bool, str, int]:
    resolver_url = DOI_RESOLVER_URL + quote(doi, safe="/:;()")
    response = session.head(
        resolver_url,
        allow_redirects=False,
        timeout=REQUEST_TIMEOUT,
        headers={"Accept": "text/html,application/xhtml+xml"},
    )

    if response.status_code == 405:
        response = session.get(
            resolver_url,
            allow_redirects=False,
            timeout=REQUEST_TIMEOUT,
            headers={"Accept": "text/html,application/xhtml+xml"},
            stream=True,
        )

    redirect_target = response.headers.get("Location", "")
    resolved = response.status_code == 200 or (
        response.status_code in REDIRECT_STATUS_CODES
        and is_http_url(redirect_target)
    )
    return resolved, redirect_target, response.status_code


def format_check(name: str, passed: bool, detail: str) -> str:
    marker = "PASS" if passed else "FAIL"
    return f"    - {name}: {marker} ({detail})"


def build_evaluation_report(
    publication: dict[str, Any],
    evaluation: dict[str, Any],
    resolution: tuple[bool, str, int] | None = None,
) -> list[str]:
    checks = evaluation["checks"]
    review_checks = evaluation["review_checks"]
    local_surname = get_local_first_author_surname(publication)

    lines = [
        format_check(
            "제목",
            checks["title"],
            f"{evaluation['title_score']:.3f}, 기준 {TITLE_MATCH_MIN:.2f}",
        ),
        format_check(
            "첫 저자 성",
            checks["first_author"],
            f"{local_surname} / {evaluation['crossref_surname'] or '없음'}",
        ),
        format_check(
            "논문지",
            checks["journal"],
            f"{evaluation['journal_score']:.3f}, 기준 {JOURNAL_MATCH_MIN:.2f}",
        ),
        format_check(
            "임시 입력 제목 기준",
            review_checks["title"],
            (
                f"{evaluation['title_score']:.3f}, "
                f"기준 {REVIEW_TITLE_MATCH_MIN:.2f}"
            ),
        ),
        format_check(
            "임시 입력 논문지 기준",
            review_checks["journal"],
            (
                f"{evaluation['journal_score']:.3f}, "
                f"기준 {REVIEW_JOURNAL_MATCH_MIN:.2f}"
            ),
        ),
        format_check(
            "연도",
            checks["year"],
            f"{publication.get('year')} / {evaluation['crossref_year']}",
        ),
        format_check(
            "자료 유형",
            checks["type"],
            str(evaluation["item"].get("type", "없음")),
        ),
        format_check(
            "DOI 존재",
            checks["doi"],
            evaluation["doi"] or "없음",
        ),
        f"    - Crossref 제목: {evaluation['crossref_title']}",
        f"    - Crossref 논문지: {evaluation['crossref_journal'] or '없음'}",
        format_check(
            "임시 입력 자격",
            evaluation["review_eligible"],
            "완화된 전체 조건",
        ),
    ]

    if resolution is not None:
        resolved, target, status_code = resolution
        lines.append(
            format_check(
                "DOI 해석",
                resolved,
                f"HTTP {status_code}, {target or '리디렉션 없음'}",
            )
        )

    return lines


def load_publications(source_path: Path) -> list[dict[str, Any]]:
    with source_path.open("r", encoding="utf-8") as source_file:
        publications = json.load(source_file)

    if not isinstance(publications, list):
        raise ValueError("publications.json의 최상위 값은 배열이어야 합니다.")

    return publications


def get_timestamp() -> str:
    return datetime.now(ZoneInfo("Asia/Seoul")).strftime("%Y%m%d-%H%M%S")


def create_unique_path(path: Path) -> Path:
    if not path.exists():
        return path

    counter = 2
    while True:
        candidate = path.with_name(f"{path.stem}-{counter}{path.suffix}")
        if not candidate.exists():
            return candidate
        counter += 1


def create_backup(source_path: Path, timestamp: str) -> Path:
    backup_path = create_unique_path(
        source_path.with_name(
            f"{source_path.stem}.backup-{timestamp}{source_path.suffix}"
        )
    )
    shutil.copy2(source_path, backup_path)
    return backup_path


def write_publications_atomically(
    source_path: Path,
    publications: list[dict[str, Any]],
) -> None:
    temporary_path = source_path.with_name(source_path.name + ".tmp")

    try:
        with temporary_path.open("w", encoding="utf-8", newline="\n") as output_file:
            json.dump(publications, output_file, ensure_ascii=False, indent=2)
            output_file.write("\n")
        os.replace(temporary_path, source_path)
    finally:
        if temporary_path.exists():
            temporary_path.unlink()


def write_report(
    source_path: Path,
    timestamp: str,
    report_lines: list[str],
    summary: dict[str, int],
    dry_run: bool,
) -> Path:
    report_path = create_unique_path(
        source_path.with_name(f"doi_report-{timestamp}.txt")
    )
    header = [
        "SoC Lab DOI matching report",
        f"실행 시각: {timestamp} (Asia/Seoul)",
        f"대상 파일: {source_path.name}",
        f"실행 모드: {'DRY RUN' if dry_run else 'WRITE'}",
        f"제목 기준: {TITLE_MATCH_MIN:.2f} 이상",
        f"논문지 기준: {JOURNAL_MATCH_MIN:.2f} 이상",
        f"임시 입력 제목 기준: {REVIEW_TITLE_MATCH_MIN:.2f} 이상",
        f"임시 입력 논문지 기준: {REVIEW_JOURNAL_MATCH_MIN:.2f} 이상",
        "자동 확정 조건: 엄격 제목 + 첫 저자 성 + 엄격 논문지 + 연도 + 자료 유형 + DOI 해석",
        "임시 입력 조건: 완화 제목 + 첫 저자 성 + 완화 논문지 + 연도 + 자료 유형 + DOI 해석",
        "",
    ]
    footer = [
        "",
        "요약",
        f"- 자동 확정: {summary['matched']}",
        f"- 임시 입력(검토 필요): {summary['provisional']}",
        f"- 미입력 검토 필요: {summary['review']}",
        f"- 미발견: {summary['missing']}",
        f"- 오류: {summary['error']}",
        f"- 기존 확정 URL 유지: {summary['skipped']}",
        f"- 기존 임시 URL(검토 필요): {summary['existing_review']}",
        f"- 대상 외 항목: {summary['ignored']}",
    ]

    with report_path.open("w", encoding="utf-8", newline="\n") as report_file:
        report_file.write("\n".join(header + report_lines + footer))
        report_file.write("\n")

    return report_path


def process_publications(
    publications: list[dict[str, Any]],
    session: requests.Session,
    delay_seconds: float,
    dry_run: bool,
) -> tuple[list[str], dict[str, int]]:
    summary = {
        "matched": 0,
        "provisional": 0,
        "review": 0,
        "missing": 0,
        "error": 0,
        "skipped": 0,
        "existing_review": 0,
        "ignored": 0,
    }
    report_lines: list[str] = []
    target_publications = [
        publication
        for publication in publications
        if publication.get("type") == "international-journal"
    ]
    total = len(target_publications)
    processed = 0

    for publication in publications:
        publication_id = publication.get("id", "?")
        title = str(publication.get("title", "")).strip()

        if publication.get("type") != "international-journal":
            summary["ignored"] += 1
            continue

        processed += 1
        prefix = f"#{publication_id} {title}"

        if publication.get("url"):
            if publication.get("doi_review_required") is True:
                summary["existing_review"] += 1
                report_lines.append(f"[기존 임시 URL · 검토 필요] {prefix}")
                report_lines.append(
                    f"    - 현재 URL: {publication.get('url', '')}"
                )
                print(
                    f"{processed}/{total} "
                    f"[기존 임시 URL · 검토 필요] #{publication_id}"
                )
            else:
                summary["skipped"] += 1
                report_lines.append(f"[기존 확정 URL 유지] {prefix}")
                print(f"{processed}/{total} [기존 확정 URL 유지] #{publication_id}")
            continue

        try:
            print(
                f"{processed}/{total} [Crossref 검색 중] #{publication_id}",
                flush=True,
            )
            items = search_crossref(session, publication)
            evaluation = select_best_candidate(publication, items)

            if evaluation is None:
                summary["missing"] += 1
                report_lines.append(f"[미발견] {prefix}")
                print(f"{processed}/{total} [미발견] #{publication_id}")
                time.sleep(delay_seconds)
                continue

            if not evaluation["review_eligible"]:
                summary["review"] += 1
                report_lines.append(f"[미입력 · 검토 필요] {prefix}")
                report_lines.extend(
                    build_evaluation_report(publication, evaluation)
                )
                print(f"{processed}/{total} [미입력 · 검토 필요] #{publication_id}")
                time.sleep(delay_seconds)
                continue

            resolution = verify_doi_resolution(session, evaluation["doi"])
            resolved, _, _ = resolution

            if not resolved:
                summary["review"] += 1
                report_lines.append(f"[검토 필요] {prefix}")
                report_lines.extend(
                    build_evaluation_report(publication, evaluation, resolution)
                )
                print(f"{processed}/{total} [DOI 확인 실패] #{publication_id}")
                time.sleep(delay_seconds)
                continue

            doi = evaluation["doi"]
            is_confirmed = evaluation["metadata_passed"]
            if not dry_run:
                publication["doi"] = doi
                publication["url"] = DOI_RESOLVER_URL + doi
                if is_confirmed:
                    publication.pop("doi_review_required", None)
                else:
                    publication["doi_review_required"] = True

            if is_confirmed:
                summary["matched"] += 1
                result_label = "DRY RUN 자동 확정" if dry_run else "자동 확정"
            else:
                summary["provisional"] += 1
                result_label = (
                    "DRY RUN 임시 입력 대상" if dry_run else "임시 입력 · 검토 필요"
                )

            report_lines.append(f"[{result_label}] {prefix}")
            report_lines.extend(
                build_evaluation_report(publication, evaluation, resolution)
            )
            print(f"{processed}/{total} [{result_label}] #{publication_id} → {doi}")

        except (requests.RequestException, ValueError, KeyError, TypeError) as error:
            summary["error"] += 1
            report_lines.append(f"[오류] {prefix}\n    - {type(error).__name__}: {error}")
            print(f"{processed}/{total} [오류] #{publication_id}: {error}")

        time.sleep(delay_seconds)

    return report_lines, summary


def main() -> int:
    arguments = parse_arguments()
    source_path = Path(arguments.source).resolve()

    if not source_path.is_file():
        print(f"파일을 찾을 수 없습니다: {source_path}", file=sys.stderr)
        return 1

    if arguments.delay < 0:
        print("--delay 값은 0 이상이어야 합니다.", file=sys.stderr)
        return 1

    try:
        publications = load_publications(source_path)
    except (OSError, json.JSONDecodeError, ValueError) as error:
        print(f"JSON을 읽을 수 없습니다: {error}", file=sys.stderr)
        return 1

    timestamp = get_timestamp()
    session = create_http_session()
    report_lines, summary = process_publications(
        publications,
        session,
        arguments.delay,
        arguments.dry_run,
    )

    backup_path: Path | None = None
    if not arguments.dry_run:
        backup_path = create_backup(source_path, timestamp)
        write_publications_atomically(source_path, publications)

    report_path = write_report(
        source_path,
        timestamp,
        report_lines,
        summary,
        arguments.dry_run,
    )

    print("\n완료")
    print(f"- 자동 확정: {summary['matched']}")
    print(f"- 임시 입력(검토 필요): {summary['provisional']}")
    print(f"- 미입력 검토 필요: {summary['review']}")
    print(f"- 미발견: {summary['missing']}")
    print(f"- 오류: {summary['error']}")
    print(f"- 기존 확정 URL 유지: {summary['skipped']}")
    print(f"- 기존 임시 URL(검토 필요): {summary['existing_review']}")
    if backup_path is not None:
        print(f"- 백업: {backup_path.name}")
    print(f"- 보고서: {report_path.name}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

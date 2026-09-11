#!/usr/bin/env python3
"""Create research-news entries from changed publication and patent records.

The script compares the current worktree with a previous Git revision.  It only
creates announcements for records that were added or reached a new lifecycle
stage in that comparison, so installing the automation does not backfill the
entire archive.
"""

from __future__ import annotations

import argparse
import calendar
import json
import re
import subprocess
import sys
import unicodedata
from dataclasses import dataclass
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Iterable


PUBLICATIONS_FILE = "publications.json"
DOMESTIC_PATENTS_FILE = "patents_domestic_granted.json"
INTERNATIONAL_PATENTS_FILE = "patents_international_granted.json"
MEMBERS_FILE = "members.json"
NEWS_FILE = "news.json"

SOURCE_FILES = (
    PUBLICATIONS_FILE,
    DOMESTIC_PATENTS_FILE,
    INTERNATIONAL_PATENTS_FILE,
)

JOURNAL_ABBREVIATIONS = {
    "ieee transactions on computer aided design of integrated circuits and systems": "IEEE TCAD",
    "ieee transactions on very large scale integration systems": "IEEE TVLSI",
    "ieee transactions on vlsi systems": "IEEE TVLSI",
    "ieee transactions on vlsi": "IEEE TVLSI",
    "ieee transactions on reliability": "IEEE TR",
    "ieee transactions on circuits and systems i": "IEEE TCASI",
    "ieee transactions on circuits and systems i regular papers": "IEEE TCASI",
    "ieee transactions on circuits and systems ii": "IEEE TCASII",
    "ieee transactions on circuits and systems ii express briefs": "IEEE TCASII",
    "ieee transactions on semiconductor manufacturing": "IEEE TSM",
    "ieee transactions on computers": "IEEE TC",
    "ieee access": "IEEE Access",
    "acm computing surveys": "ACM Computing Surveys",
    "public library of science one": "PLOS ONE",
    "plos one": "PLOS ONE",
    "ieice electronics express": "IEICE ELEX",
    "ieice electronics express elex": "IEICE ELEX",
    "etri journal": "ETRI Journal",
    "sensors": "Sensors",
    "electronics": "Electronics",
}

MONTH_NAMES = [
    "",
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
]


@dataclass(frozen=True)
class SourceChange:
    source: str
    previous: dict[str, dict[str, Any]]
    current: dict[str, dict[str, Any]]


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate news.json entries from changed achievement JSON records."
    )
    parser.add_argument(
        "--before",
        default="HEAD^",
        help="Git revision to compare against (default: HEAD^)",
    )
    parser.add_argument(
        "--commit-date",
        default="",
        help="Fallback ISO date/time for acceptance announcements",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print the result without writing news.json",
    )
    return parser.parse_args()


def read_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8-sig") as stream:
        return json.load(stream)


def read_json_at_revision(revision: str, relative_path: str) -> list[dict[str, Any]]:
    if not revision or set(revision) == {"0"}:
        return []

    result = subprocess.run(
        ["git", "show", f"{revision}:{relative_path}"],
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    if result.returncode != 0:
        return []

    data = json.loads(result.stdout)
    if not isinstance(data, list):
        raise TypeError(f"{relative_path} at {revision} must contain a JSON array")
    return data


def records_by_id(records: Iterable[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    indexed: dict[str, dict[str, Any]] = {}
    for record in records:
        record_id = str(record.get("id", "")).strip()
        if not record_id:
            raise ValueError("Every achievement record must have an id")
        if record_id in indexed:
            raise ValueError(f"Duplicate achievement id: {record_id}")
        indexed[record_id] = record
    return indexed


def normalize_text(value: Any) -> str:
    text = unicodedata.normalize("NFKD", str(value or "")).casefold()
    return re.sub(r"[^a-z0-9가-힣]+", "", text)


def normalize_journal(value: Any) -> str:
    text = unicodedata.normalize("NFKC", str(value or "")).casefold()
    text = text.replace("&", " and ")
    return re.sub(r"[^a-z0-9]+", " ", text).strip()


def parse_date_parts(value: Any) -> tuple[int, int, int | None] | None:
    match = re.fullmatch(
        r"\s*(\d{4})(?:[.\-/](\d{1,2}))?(?:[.\-/](\d{1,2}))?\s*",
        str(value or ""),
    )
    if not match:
        return None
    year = int(match.group(1))
    month = int(match.group(2) or 1)
    day = int(match.group(3)) if match.group(3) else None
    if not 1 <= month <= 12:
        return None
    if day is not None and not 1 <= day <= calendar.monthrange(year, month)[1]:
        return None
    return year, month, day


def fallback_commit_date(value: str) -> date:
    if value:
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00")).date()
        except ValueError:
            parsed = parse_date_parts(value)
            if parsed:
                return date(parsed[0], parsed[1], parsed[2] or 1)
    return datetime.now(timezone.utc).date()


def news_date(value: Any, *, end_of_month: bool = False) -> str | None:
    parsed = parse_date_parts(value)
    if not parsed:
        return None
    year, month, day = parsed
    if day is None:
        day = calendar.monthrange(year, month)[1] if end_of_month else 1
    return date(year, month, day).isoformat()


def display_month_year(record: dict[str, Any], fallback: date) -> str:
    parsed = parse_date_parts(record.get("date"))
    if parsed:
        year, month, _ = parsed
    else:
        year = int(record.get("year") or fallback.year)
        month = int(record.get("month") or fallback.month)
        if not 1 <= month <= 12:
            month = fallback.month
    return f"{MONTH_NAMES[month]} {year}"


def format_people(people: Any) -> str:
    names = [str(person).strip() for person in people or [] if str(person).strip()]
    if not names:
        return ""
    if len(names) == 1:
        return names[0]
    if len(names) == 2:
        return f"{names[0]} and {names[1]}"
    return ", ".join(names[:-1]) + f", and {names[-1]}"


def journal_abbreviation(record: dict[str, Any]) -> str:
    explicit = str(record.get("journal_abbr") or "").strip()
    if explicit:
        return explicit
    journal = str(record.get("journal") or "").strip()
    return JOURNAL_ABBREVIATIONS.get(normalize_journal(journal), journal)


def publication_ready(record: dict[str, Any]) -> bool:
    return bool(
        parse_date_parts(record.get("date"))
        and str(record.get("volume") or "").strip()
        and str(record.get("issue") or "").strip()
        and str(record.get("pages") or "").strip()
    )


def acceptance_ready(record: dict[str, Any]) -> bool:
    status = normalize_text(record.get("status"))
    return not publication_ready(record) and (
        status in {"accepted", "tobepublished", "acceptance"}
        or not str(record.get("date") or "").strip()
    )


def patent_ready(record: dict[str, Any]) -> bool:
    return bool(
        normalize_text(record.get("status")) == "granted"
        and parse_date_parts(record.get("date"))
        and str(record.get("number") or "").strip()
    )


def publication_key(record: dict[str, Any], stage: str) -> str:
    return f"publication:{record['id']}:{stage}"


def patent_key(record: dict[str, Any], scope: str) -> str:
    return f"patent:{scope}:{record['id']}:granted"


def common_news_fields(
    *,
    source_key: str,
    category: str,
    post_date: str,
    title: str,
    body: str,
    achievement_title: str,
    authors: str,
) -> dict[str, Any]:
    return {
        "board": "research",
        "category": category,
        "date": post_date,
        "title": title,
        "body": body,
        "body_html": body,
        "images": [],
        "views": 0,
        "pinned": False,
        "paper_title": achievement_title,
        "authors": authors,
        "attachments": [],
        "auto_generated": True,
        "source_key": source_key,
    }


def make_acceptance_news(
    record: dict[str, Any], fallback: date, existing_date: str | None = None
) -> dict[str, Any]:
    authors = format_people(record.get("authors"))
    lead = str((record.get("authors") or ["Unknown"])[0]).strip()
    year = fallback.year
    journal = str(record.get("journal") or "").strip()
    month_year = f"{MONTH_NAMES[fallback.month]} {fallback.year}"
    title = f"{year} {journal_abbreviation(record)} Acceptance - {lead}, etc."
    body = (
        f"The following paper has been accepted in the {journal} in {month_year}.\n"
        "Congratulations to the authors.\n\n"
        f"Title: {record.get('title', '')}\n"
        f"Authors: {authors}"
    )
    return common_news_fields(
        source_key=publication_key(record, "acceptance"),
        category="publication",
        post_date=existing_date or fallback.isoformat(),
        title=title,
        body=body,
        achievement_title=str(record.get("title") or ""),
        authors=authors,
    )


def make_publication_news(record: dict[str, Any], fallback: date) -> dict[str, Any]:
    authors = format_people(record.get("authors"))
    lead = str((record.get("authors") or ["Unknown"])[0]).strip()
    year = int(record.get("year") or fallback.year)
    journal = str(record.get("journal") or "").strip()
    month_year = display_month_year(record, fallback)
    pages = re.sub(r"\s*[–—]\s*", "-", str(record.get("pages") or "").strip())
    title = f"Publication - {year} {journal_abbreviation(record)} - {lead}, etc."
    body = (
        f"In {month_year},\n"
        f'"{record.get("title", "")}" written by {authors} has been published in the '
        f"{journal}, vol.{record.get('volume')}, no.{record.get('issue')}, pp.{pages}.\n\n"
        "Authors' hard work has finally paid off !"
    )
    post_date = news_date(record.get("date"), end_of_month=True) or fallback.isoformat()
    return common_news_fields(
        source_key=publication_key(record, "publication"),
        category="publication",
        post_date=post_date,
        title=title,
        body=body,
        achievement_title=str(record.get("title") or ""),
        authors=authors,
    )


def member_name_map(members: Iterable[dict[str, Any]]) -> dict[str, str]:
    mapping: dict[str, str] = {}
    for member in members:
        korean = str(member.get("name_kr") or "").strip()
        english = str(member.get("name_en") or "").strip()
        if korean and english and korean not in mapping:
            mapping[korean] = english
    return mapping


def lead_inventor(record: dict[str, Any], names: dict[str, str]) -> str:
    inventors = [str(name).strip() for name in record.get("inventors") or []]
    lead_kr = next((name for name in inventors if name != "강성호"), inventors[0] if inventors else "Unknown")
    return str(record.get("lead_inventor_en") or names.get(lead_kr) or lead_kr).strip()


def make_patent_news(
    record: dict[str, Any], scope: str, names: dict[str, str], fallback: date
) -> dict[str, Any]:
    inventors = [str(name).strip() for name in record.get("inventors") or [] if str(name).strip()]
    authors = ", ".join(inventors)
    lead = lead_inventor(record, names)
    parsed = parse_date_parts(record.get("date"))
    year = parsed[0] if parsed else int(record.get("year") or fallback.year)
    month_year = display_month_year(record, fallback)
    if scope == "domestic":
        label = "Domestic"
        office = "Korean Intellectual Property Office"
    else:
        label = "International"
        office = "World Intellectual Property Office"
    title = f"{year} {label} Patent - {lead}, etc."
    body = (
        f"The following patent has been approved by the {office} in {month_year}.\n"
        "Congratulations to the authors.\n\n"
        f"Title: {record.get('title', '')}\n"
        f"Authors: {authors}"
    )
    post_date = news_date(record.get("date")) or fallback.isoformat()
    return common_news_fields(
        source_key=patent_key(record, scope),
        category="patent",
        post_date=post_date,
        title=title,
        body=body,
        achievement_title=str(record.get("title") or ""),
        authors=authors,
    )


def legacy_news_exists(news: Iterable[dict[str, Any]], desired: dict[str, Any]) -> bool:
    target = normalize_text(desired.get("paper_title"))
    if not target:
        return False
    desired_key = str(desired.get("source_key") or "")
    stage = "acceptance" if desired_key.endswith(":acceptance") else "publication"
    if desired.get("category") == "patent":
        stage = "patent"

    for item in news:
        if item.get("category") != desired.get("category"):
            continue
        item_title = normalize_text(item.get("paper_title"))
        item_body = normalize_text(item.get("body"))
        if target != item_title and target not in item_body:
            continue
        heading = str(item.get("title") or "").casefold()
        body = str(item.get("body") or "").casefold()
        if stage == "acceptance" and ("accept" in heading or "has been accepted" in body):
            return True
        if stage == "publication" and (
            heading.startswith("publication") or "has been published" in body
        ):
            return True
        if stage == "patent" and "patent" in heading:
            return True
    return False


def update_generated_item(existing: dict[str, Any], desired: dict[str, Any]) -> bool:
    preserved_id = existing.get("id")
    preserved_views = existing.get("views", 0)
    preserved_images = existing.get("images", [])
    preserved_attachments = existing.get("attachments", [])
    replacement = dict(desired)
    replacement["id"] = preserved_id
    replacement["views"] = preserved_views
    replacement["images"] = preserved_images
    replacement["attachments"] = preserved_attachments
    if existing == replacement:
        return False
    existing.clear()
    existing.update(replacement)
    return True


def changed_sources(root: Path, before: str) -> dict[str, SourceChange]:
    changes: dict[str, SourceChange] = {}
    for source in SOURCE_FILES:
        current_data = read_json(root / source)
        if not isinstance(current_data, list):
            raise TypeError(f"{source} must contain a JSON array")
        previous_data = read_json_at_revision(before, source)
        changes[source] = SourceChange(
            source=source,
            previous=records_by_id(previous_data),
            current=records_by_id(current_data),
        )
    return changes


def main() -> int:
    arguments = parse_arguments()
    root = Path.cwd()
    fallback = fallback_commit_date(arguments.commit_date)
    changes = changed_sources(root, arguments.before)
    news = read_json(root / NEWS_FILE)
    members = read_json(root / MEMBERS_FILE)
    if not isinstance(news, list) or not isinstance(members, list):
        raise TypeError("news.json and members.json must contain JSON arrays")

    by_source_key = {
        str(item.get("source_key")): item
        for item in news
        if item.get("auto_generated") and item.get("source_key")
    }
    names = member_name_map(members)
    candidates: list[dict[str, Any]] = []
    updated = 0
    skipped_legacy = 0
    waiting = 0

    publications = changes[PUBLICATIONS_FILE]
    for record_id, current in publications.current.items():
        if current.get("type") != "international-journal":
            continue
        previous = publications.previous.get(record_id)
        acceptance_source_key = publication_key(current, "acceptance")
        publication_source_key = publication_key(current, "publication")

        existing_acceptance = by_source_key.get(acceptance_source_key)
        if existing_acceptance:
            existing_date = str(existing_acceptance.get("date") or fallback.isoformat())
            existing_parts = parse_date_parts(existing_date)
            acceptance_date = (
                date(existing_parts[0], existing_parts[1], existing_parts[2] or 1)
                if existing_parts
                else fallback
            )
            desired = make_acceptance_news(
                current, acceptance_date, existing_date
            )
            updated += int(update_generated_item(existing_acceptance, desired))
        elif acceptance_ready(current) and (previous is None or not acceptance_ready(previous)):
            candidates.append(make_acceptance_news(current, fallback))

        existing_publication = by_source_key.get(publication_source_key)
        if existing_publication and publication_ready(current):
            updated += int(
                update_generated_item(existing_publication, make_publication_news(current, fallback))
            )
        elif publication_ready(current) and (previous is None or not publication_ready(previous)):
            candidates.append(make_publication_news(current, fallback))
        elif (
            previous is not None
            and current != previous
            and not publication_ready(previous)
            and parse_date_parts(current.get("date"))
            and not publication_ready(current)
        ):
            waiting += 1
            print(
                f"[대기] publication:{record_id} — 날짜는 있으나 volume/issue/pages가 완성되지 않았습니다."
            )

    for source, scope in (
        (DOMESTIC_PATENTS_FILE, "domestic"),
        (INTERNATIONAL_PATENTS_FILE, "international"),
    ):
        patents = changes[source]
        for record_id, current in patents.current.items():
            source_key = patent_key(current, scope)
            existing = by_source_key.get(source_key)
            if existing and patent_ready(current):
                updated += int(
                    update_generated_item(
                        existing, make_patent_news(current, scope, names, fallback)
                    )
                )
                continue
            previous = patents.previous.get(record_id)
            if patent_ready(current) and (previous is None or not patent_ready(previous)):
                candidates.append(make_patent_news(current, scope, names, fallback))

    new_items: list[dict[str, Any]] = []
    seen_keys = set(by_source_key)
    for desired in candidates:
        source_key = str(desired["source_key"])
        if source_key in seen_keys:
            continue
        if legacy_news_exists(news, desired):
            skipped_legacy += 1
            print(f"[중복 생략] {source_key} — 기존 수동 게시글이 있습니다.")
            continue
        new_items.append(desired)
        seen_keys.add(source_key)

    next_id = max((int(item.get("id") or 0) for item in news), default=0) + 1
    new_items.sort(key=lambda item: (str(item["date"]), str(item["source_key"])))
    for item in new_items:
        item["id"] = next_id
        next_id += 1
    news.extend(new_items)

    changed = bool(new_items or updated)
    if changed and not arguments.dry_run:
        (root / NEWS_FILE).write_text(
            json.dumps(news, ensure_ascii=False, indent=1) + "\n", encoding="utf-8"
        )

    print("\n완료")
    print(f"- 새 게시글: {len(new_items)}")
    print(f"- 자동 게시글 갱신: {updated}")
    print(f"- 기존 수동 게시글 중복 생략: {skipped_legacy}")
    print(f"- Publication 정보 대기: {waiting}")
    print(f"- news.json 변경: {'예' if changed else '아니요'}")
    if arguments.dry_run:
        print("- 시험 실행: 파일을 수정하지 않았습니다.")
    for item in new_items:
        print(f"  + {item['source_key']}: {item['title']}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, TypeError, json.JSONDecodeError) as error:
        print(f"오류: {error}", file=sys.stderr)
        raise SystemExit(1)

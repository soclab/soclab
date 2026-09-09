"""Build the public members.json from a local private source.

The private source keeps plain email addresses and must never be committed.
The generated public file contains only display fields and an obfuscated private
detail token. The token is decoded in the browser only when a profile is opened.

This is harvesting deterrence for a static site, not cryptographic protection.
Anyone who studies the public decoder can recover the token contents.
"""

from __future__ import annotations

import argparse
import base64
import copy
import hashlib
import json
import os
import re
import sys
from pathlib import Path
from typing import Any


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PRIVATE_SOURCE = REPOSITORY_ROOT / "private-data" / "members.source.json"
DEFAULT_PUBLIC_OUTPUT = REPOSITORY_ROOT / "members.json"

TOKEN_VERSION = "v2"
TOKEN_SEED_SUFFIX = "soclab-member-v2"
LEGACY_TOKEN_VERSION = "v1"
LEGACY_TOKEN_SEED_SUFFIX = "soclab-alumni-v1"

EMAIL_PATTERN = re.compile(
    r"[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@"
    r"[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?"
    r"(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+",
    re.IGNORECASE,
)

PUBLIC_FIELDS = (
    "id",
    "group",
    "category",
    "name_kr",
    "name_en",
    "photo",
    "photo_scale",
    "photo_offset_y",
    "display_order",
    "research_interests",
    "graduation",
    "thesis",
    "work",
    "profile",
    "position_kr",
    "position_en",
)

SOURCE_FIELDS = PUBLIC_FIELDS + (
    "email",
    "hobby",
)

NAME_REQUIRED_GROUPS = {"faculty", "staff", "student"}
NAME_REQUIRED_ALUMNI_CATEGORIES = {"박사", "석사"}

# `--initialize`로 예전 members.json을 가져올 때만 사용하는 1회성 순서입니다.
# 이후에는 비공개 원본의 display_order가 유일한 기준이 됩니다.
LEGACY_DISPLAY_ORDER = {
    "박사후연구원": ("윤효준",),
    "박사/통합과정": (
        "박종호",
        "이수령",
        "김성훈",
        "유연우",
        "신승호",
        "문영기",
        "이주용",
        "원두연",
        "김원준",
        "김재현",
        "윤두현",
        "김나연",
        "김다영",
        "정유진",
        "김다훈",
        "김승태",
        "박경규",
        "이미혜",
        "임수민",
        "김강현",
        "김일웅",
        "박기현",
        "이종철",
    ),
    "석사과정": (
        "손누리",
        "최연호",
        "손정현",
        "위호연",
        "김준거",
        "조준희",
        "신재우",
        "권인아",
    ),
    "인턴": ("김준혁",),
    "사무원": ("최승아",),
}


class MemberDataError(ValueError):
    """Raised when member data cannot be safely published."""


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="로컬 구성원 원본에서 공개용 members.json을 생성합니다."
    )
    parser.add_argument(
        "--source",
        type=Path,
        default=DEFAULT_PRIVATE_SOURCE,
        help=f"비공개 원본 경로 (기본값: {DEFAULT_PRIVATE_SOURCE})",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_PUBLIC_OUTPUT,
        help=f"공개 JSON 경로 (기본값: {DEFAULT_PUBLIC_OUTPUT})",
    )
    action = parser.add_mutually_exclusive_group()
    action.add_argument(
        "--initialize",
        action="store_true",
        help="현재 공개 JSON을 복원하여 최초 비공개 원본을 생성합니다.",
    )
    action.add_argument(
        "--check",
        action="store_true",
        help="원본과 공개 JSON을 검증하고 파일은 수정하지 않습니다.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="--initialize 사용 시 기존 비공개 원본을 덮어씁니다.",
    )
    return parser.parse_args()


def read_json(path: Path) -> Any:
    try:
        with path.open("r", encoding="utf-8") as input_file:
            return json.load(input_file)
    except FileNotFoundError as error:
        raise MemberDataError(f"파일을 찾을 수 없습니다: {path}") from error
    except json.JSONDecodeError as error:
        raise MemberDataError(
            f"JSON 문법 오류: {path} ({error.lineno}행 {error.colno}열)"
        ) from error
    except OSError as error:
        raise MemberDataError(f"파일을 읽을 수 없습니다: {path} ({error})") from error


def write_json_atomically(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = path.with_name(path.name + ".tmp")
    try:
        with temporary_path.open("w", encoding="utf-8", newline="\n") as output_file:
            json.dump(value, output_file, ensure_ascii=False, indent=2)
            output_file.write("\n")
        os.replace(temporary_path, path)
    finally:
        if temporary_path.exists():
            temporary_path.unlink()


def require_member_list(value: Any, path: Path) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        raise MemberDataError(f"최상위 값은 배열이어야 합니다: {path}")

    members: list[dict[str, Any]] = []
    for index, member in enumerate(value):
        if not isinstance(member, dict):
            raise MemberDataError(f"{index + 1}번째 구성원은 객체여야 합니다.")
        members.append(member)
    return members


def normalized_text(value: Any) -> str:
    return "" if value is None else str(value).strip()


def create_stable_member_id(member: dict[str, Any], index: int) -> str:
    existing_id = member.get("id")
    if existing_id not in (None, ""):
        return str(existing_id)

    legacy_id = member.get("post_id")
    if legacy_id not in (None, ""):
        return str(legacy_id)

    identity = "|".join(
        (
            normalized_text(member.get("group")),
            normalized_text(member.get("category")),
            normalized_text(member.get("name_kr")),
            normalized_text(member.get("name_en")),
            str(index),
        )
    )
    digest = hashlib.sha256(identity.encode("utf-8")).hexdigest()[:12]
    return f"member-{digest}"


def create_obfuscation_state(value: str) -> int:
    state = 2166136261
    for byte in value.encode("utf-8"):
        state ^= byte
        state = (state * 16777619) & 0xFFFFFFFF
    return state or 1


def advance_obfuscation_state(state: int) -> int:
    state &= 0xFFFFFFFF
    state ^= (state << 13) & 0xFFFFFFFF
    state ^= state >> 17
    state ^= (state << 5) & 0xFFFFFFFF
    return state & 0xFFFFFFFF


def get_token_seed(member: dict[str, Any], version: str) -> str:
    if version == TOKEN_VERSION:
        return "|".join(
            (
                normalized_text(member.get("id")),
                normalized_text(member.get("name_kr")),
                TOKEN_SEED_SUFFIX,
            )
        )

    if version == LEGACY_TOKEN_VERSION:
        return "|".join(
            (
                normalized_text(member.get("name_kr")),
                normalized_text(member.get("graduation")),
                LEGACY_TOKEN_SEED_SUFFIX,
            )
        )

    raise MemberDataError(f"지원하지 않는 보호 데이터 버전입니다: {version}")


def xor_with_seed(payload: bytes, seed: str) -> bytes:
    state = create_obfuscation_state(seed)
    transformed = bytearray(len(payload))
    for index, byte in enumerate(payload):
        state = advance_obfuscation_state(state)
        transformed[index] = byte ^ (state & 0xFF)
    return bytes(transformed)


def encode_private_detail(member: dict[str, Any], detail: dict[str, str]) -> str:
    payload = json.dumps(
        detail,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    transformed = xor_with_seed(payload, get_token_seed(member, TOKEN_VERSION))
    encoded = base64.urlsafe_b64encode(transformed).decode("ascii").rstrip("=")
    return f"{TOKEN_VERSION}.{encoded}"


def decode_private_detail(member: dict[str, Any]) -> dict[str, str]:
    protected_value = normalized_text(member.get("private_detail_obfuscated"))
    if not protected_value:
        return {}

    try:
        version, encoded = protected_value.split(".", 1)
        padded = encoded + "=" * (-len(encoded) % 4)
        transformed = base64.urlsafe_b64decode(padded.encode("ascii"))
        payload = xor_with_seed(transformed, get_token_seed(member, version))
        decoded = json.loads(payload.decode("utf-8"))
    except (ValueError, UnicodeDecodeError, json.JSONDecodeError) as error:
        member_name = normalized_text(member.get("name_kr")) or "이름 없음"
        raise MemberDataError(
            f"{member_name}: 보호된 상세정보를 복원할 수 없습니다."
        ) from error

    if not isinstance(decoded, dict):
        raise MemberDataError("보호된 상세정보는 객체여야 합니다.")

    return {
        key: normalized_text(value)
        for key, value in decoded.items()
        if key in {"email", "hobby"} and normalized_text(value)
    }


def sanitize_embedded_emails(value: Any) -> tuple[Any, list[str]]:
    found_emails: list[str] = []

    if isinstance(value, dict):
        sanitized_object: dict[str, Any] = {}
        for key, child in value.items():
            sanitized_child, child_emails = sanitize_embedded_emails(child)
            sanitized_object[key] = sanitized_child
            found_emails.extend(child_emails)
        return sanitized_object, found_emails

    if isinstance(value, list):
        sanitized_list: list[Any] = []
        for child in value:
            sanitized_child, child_emails = sanitize_embedded_emails(child)
            sanitized_list.append(sanitized_child)
            found_emails.extend(child_emails)
        return sanitized_list, found_emails

    if not isinstance(value, str):
        return value, found_emails

    found_emails.extend(match.group(0) for match in EMAIL_PATTERN.finditer(value))
    sanitized = EMAIL_PATTERN.sub("", value)
    sanitized = re.sub(r"(?i)\b(e-?mail)\s*\(\s*\)", r"\1", sanitized)
    sanitized = re.sub(r"\(\s*\)", "", sanitized)
    sanitized = re.sub(r"[ \t]{2,}", " ", sanitized).strip()
    return sanitized, found_emails


def choose_private_email(
    explicit_email: str,
    protected_email: str,
    embedded_emails: list[str],
    member_name: str,
) -> str:
    candidates = {
        normalized_text(value)
        for value in [explicit_email, protected_email, *embedded_emails]
        if normalized_text(value)
    }
    if len(candidates) > 1:
        raise MemberDataError(
            f"{member_name}: 서로 다른 이메일 주소가 여러 곳에 들어 있습니다."
        )
    return next(iter(candidates), "")


def resolve_photo_path(photo_path: str) -> str:
    if not photo_path or photo_path.startswith(("https://", "http://")):
        return photo_path

    relative_path = Path(photo_path.replace("\\", "/"))
    absolute_path = REPOSITORY_ROOT / relative_path
    if absolute_path.is_file():
        return relative_path.as_posix()

    parent = absolute_path.parent
    if parent.is_dir():
        matches = [
            candidate
            for candidate in parent.iterdir()
            if candidate.name.casefold() == absolute_path.name.casefold()
        ]
        if len(matches) == 1:
            return matches[0].relative_to(REPOSITORY_ROOT).as_posix()

    return relative_path.as_posix()


def copy_present_fields(
    member: dict[str, Any],
    field_names: tuple[str, ...],
) -> dict[str, Any]:
    copied: dict[str, Any] = {}
    for field_name in field_names:
        if field_name not in member:
            continue
        value = copy.deepcopy(member[field_name])
        if value in (None, "", [], {}):
            continue
        copied[field_name] = value
    return copied


def normalize_public_member_for_source(
    member: dict[str, Any],
    index: int,
) -> dict[str, Any]:
    normalized_member = copy_present_fields(member, SOURCE_FIELDS)
    normalized_member["id"] = create_stable_member_id(member, index)

    photo_path = normalized_text(
        member.get("photo") if member.get("photo") else member.get("photo_new")
    )
    legacy_public_photo = normalized_text(member.get("photo_new"))
    if legacy_public_photo:
        photo_path = legacy_public_photo
    if photo_path:
        normalized_member["photo"] = resolve_photo_path(photo_path)

    protected_detail = decode_private_detail(member)
    sanitized_profile, embedded_emails = sanitize_embedded_emails(
        copy.deepcopy(member.get("profile", {}))
    )
    if sanitized_profile:
        normalized_member["profile"] = sanitized_profile

    member_name = (
        normalized_text(member.get("name_kr"))
        or normalized_text(member.get("name_en"))
        or f"{index + 1}번째 구성원"
    )
    email = choose_private_email(
        normalized_text(member.get("email")),
        protected_detail.get("email", ""),
        embedded_emails,
        member_name,
    )
    hobby = normalized_text(member.get("hobby")) or protected_detail.get("hobby", "")

    if email:
        normalized_member["email"] = email
    if hobby:
        normalized_member["hobby"] = hobby

    if "display_order" not in normalized_member:
        legacy_order = LEGACY_DISPLAY_ORDER.get(
            normalized_text(member.get("category")), ()
        )
        member_name_kr = normalized_text(member.get("name_kr"))
        if member_name_kr in legacy_order:
            normalized_member["display_order"] = legacy_order.index(member_name_kr) + 1

    return normalized_member


def validate_source_members(members: list[dict[str, Any]]) -> list[str]:
    errors: list[str] = []
    seen_ids: set[str] = set()

    for index, member in enumerate(members):
        label = (
            normalized_text(member.get("name_kr"))
            or normalized_text(member.get("name_en"))
            or f"{index + 1}번째 구성원"
        )
        member_id = normalized_text(member.get("id"))
        group = normalized_text(member.get("group"))
        category = normalized_text(member.get("category"))

        if not member_id:
            errors.append(f"{label}: id가 없습니다.")
        elif member_id in seen_ids:
            errors.append(f"{label}: id가 중복됩니다 ({member_id}).")
        else:
            seen_ids.add(member_id)

        if not group:
            errors.append(f"{label}: group이 없습니다.")
        if not category:
            errors.append(f"{label}: category가 없습니다.")

        name_required = group in NAME_REQUIRED_GROUPS or (
            group == "alumni" and category in NAME_REQUIRED_ALUMNI_CATEGORIES
        )
        if name_required and not (
            normalized_text(member.get("name_kr"))
            or normalized_text(member.get("name_en"))
        ):
            errors.append(f"{label}: 이름이 없습니다.")

        email = normalized_text(member.get("email"))
        if email and EMAIL_PATTERN.fullmatch(email) is None:
            errors.append(f"{label}: 이메일 형식이 올바르지 않습니다.")

        display_order = member.get("display_order")
        if display_order not in (None, ""):
            if isinstance(display_order, bool) or not isinstance(display_order, int):
                errors.append(f"{label}: display_order는 정수여야 합니다.")
            elif display_order < 1:
                errors.append(f"{label}: display_order는 1 이상이어야 합니다.")

        photo = normalized_text(member.get("photo"))
        if photo and not photo.startswith(("https://", "http://")):
            if not (REPOSITORY_ROOT / photo).is_file():
                errors.append(f"{label}: 사진 파일이 없습니다 ({photo}).")

        public_fields = copy_present_fields(member, PUBLIC_FIELDS)
        if EMAIL_PATTERN.search(json.dumps(public_fields, ensure_ascii=False)):
            errors.append(
                f"{label}: email 필드가 아닌 공개 필드에 이메일 주소가 있습니다."
            )

    return errors


def build_public_members(members: list[dict[str, Any]]) -> list[dict[str, Any]]:
    public_members: list[dict[str, Any]] = []
    for member in members:
        public_member = copy_present_fields(member, PUBLIC_FIELDS)
        public_member["id"] = str(member["id"])

        private_detail = {
            key: normalized_text(member.get(key))
            for key in ("email", "hobby")
            if normalized_text(member.get(key))
        }
        if private_detail:
            public_member["private_detail_obfuscated"] = encode_private_detail(
                public_member,
                private_detail,
            )

        public_members.append(public_member)

    public_text = json.dumps(public_members, ensure_ascii=False)
    if EMAIL_PATTERN.search(public_text):
        raise MemberDataError("공개 JSON에 평문 이메일 주소가 남아 있습니다.")

    return public_members


def public_members_match(
    expected_members: list[dict[str, Any]],
    output_path: Path,
) -> bool:
    actual_members = require_member_list(read_json(output_path), output_path)
    return actual_members == expected_members


def initialize_private_source(source_path: Path, output_path: Path, force: bool) -> None:
    if source_path.exists() and not force:
        raise MemberDataError(
            f"비공개 원본이 이미 존재합니다: {source_path}\n"
            "덮어쓰려면 --force를 명시하세요."
        )

    public_members = require_member_list(read_json(output_path), output_path)
    source_members = [
        normalize_public_member_for_source(member, index)
        for index, member in enumerate(public_members)
    ]
    errors = validate_source_members(source_members)
    if errors:
        raise MemberDataError("\n".join(errors))

    write_json_atomically(source_path, source_members)
    print(f"비공개 원본 생성 완료: {source_path}")
    print("이 파일은 .gitignore 대상이며 GitHub에 올리면 안 됩니다.")


def build_or_check(source_path: Path, output_path: Path, check_only: bool) -> None:
    source_members = require_member_list(read_json(source_path), source_path)
    errors = validate_source_members(source_members)
    if errors:
        raise MemberDataError("\n".join(errors))

    public_members = build_public_members(source_members)
    if check_only:
        if not public_members_match(public_members, output_path):
            raise MemberDataError(
                "공개 members.json이 비공개 원본과 다릅니다. "
                "build-members.bat을 실행하세요."
            )
        print(f"검증 완료: {len(public_members)}명, 공개 파일과 원본이 일치합니다.")
        return

    write_json_atomically(output_path, public_members)
    print(f"공개 JSON 생성 완료: {output_path}")
    print(f"구성원 수: {len(public_members)}명")
    print("평문 이메일 검사: 통과")


def main() -> int:
    arguments = parse_arguments()
    source_path = arguments.source.resolve()
    output_path = arguments.output.resolve()

    try:
        if arguments.initialize:
            initialize_private_source(source_path, output_path, arguments.force)
        else:
            build_or_check(source_path, output_path, arguments.check)
    except MemberDataError as error:
        print(f"[ERROR] {error}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

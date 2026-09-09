# 구성원 데이터 관리

구성원 정보의 원본은 로컬의 `private-data/members.source.json`입니다. 홈페이지가
읽는 `members.json`은 원본에서 자동 생성되는 공개용 파일입니다.

## 최초 1회 설정

1. 저장소 최상위의 `setup-members-data.bat`을 실행합니다.
2. `private-data/members.source.json`이 생성되었는지 확인합니다.
3. 해당 파일을 GitHub가 아닌 별도의 안전한 위치에도 백업합니다.

`private-data` 폴더는 `.gitignore`에 포함되어 있습니다. `git add -f`로 강제로
추가하거나 저장소 밖으로 공개하면 안 됩니다.

## 구성원 추가·수정·삭제

1. `private-data/members.source.json`만 수정합니다.
2. 사진을 변경했다면 `images/members`에 사진 파일을 넣고 `photo` 경로를 수정합니다.
3. `build-members.bat`을 실행합니다.
4. 오류가 없으면 자동 생성된 `members.json`과 필요한 사진만 커밋합니다.

```text
private-data/members.source.json  ->  build-members.bat  ->  members.json
          비공개 원본                      변환·검증              공개 파일
```

공개 `members.json`을 직접 수정하면 다음 빌드에서 덮어써집니다.

## 주요 필드

| 필드 | 의미 |
|---|---|
| `id` | 구성원을 식별하는 고유값. 기존 값을 변경하지 않습니다. |
| `group` | `faculty`, `student`, `staff`, `alumni` 중 하나입니다. |
| `category` | 지도교수, 박사후연구원, 박사/통합과정, 석사과정, 인턴, 사무원, 박사, 석사 등입니다. |
| `name_kr`, `name_en` | 한글·영문 이름입니다. |
| `photo` | `images/members/...` 형식의 공개 사진 경로입니다. |
| `display_order` | 같은 과정 안에서의 표시 순서입니다. 1부터 시작합니다. |
| `research_interests` | 현재 구성원 카드의 연구 분야입니다. |
| `email` | 비공개 원본에서만 사용하는 이메일입니다. |
| `hobby` | 프로필을 열었을 때 표시할 취미입니다. 이메일과 함께 난독화됩니다. |
| `graduation`, `thesis`, `work` | 동문의 졸업 시점, 학위논문, 현재 재직처입니다. |
| `profile` | 지도교수의 학력·경력·수상 등 상세 정보입니다. |

## 이메일 처리 방식

공개 `members.json`에는 평문 `email` 필드가 생성되지 않습니다. 이메일과 취미는
`private_detail_obfuscated` 토큰으로 변환되며, 구성원 프로필 카드를 열 때만
브라우저가 복원합니다. 프로필을 닫으면 이메일이 포함된 상세 DOM도 제거됩니다.

이 방식은 단순 이메일 수집기를 막기 위한 난독화입니다. 정적 사이트의 JavaScript와
토큰은 모두 공개되므로 전문적인 수집을 암호학적으로 차단하지는 못합니다. 완전한
비공개가 필요하면 개인 이메일을 표시하지 않고 서버 기반 문의 폼을 사용해야 합니다.

## 오류 확인

빌드 도구는 다음 항목을 자동 검사합니다.

- JSON 문법
- 구성원 ID 중복
- 필수 이름·그룹·카테고리
- 이메일 형식
- `display_order` 형식
- 사진 파일 존재 여부와 대소문자
- 이메일이 다른 공개 필드에 들어갔는지 여부
- 공개 JSON에 평문 이메일이 남았는지 여부

명령 프롬프트에서 원본과 공개 파일의 일치 여부만 확인하려면 다음 명령을 사용합니다.

```bat
py tools\build_members.py --check
```

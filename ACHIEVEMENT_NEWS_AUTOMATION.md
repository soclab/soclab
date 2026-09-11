# 업적 소식 자동 생성

`main` 브랜치에 업적 JSON을 올리면 GitHub Actions가 변경된 항목만 확인해
`news.json`에 연구 게시글을 추가합니다. 과거 업적 전체를 다시 게시하지 않습니다.
자동 커밋과 같은 실행에서 정적 사이트도 GitHub Pages에 배포합니다.

## 최초 1회 설정

저장소의 **Settings → Pages → Build and deployment → Source**를
**GitHub Actions**로 설정합니다. GitHub Actions가 만든 커밋은 기존의
`Deploy from a branch` 빌드를 다시 실행하지 않기 때문에 필요한 설정입니다.

저장소의 **Settings → Actions → General → Workflow permissions**에서
**Read and write permissions**도 허용해야 `news.json` 자동 커밋이 가능합니다.

## 국제논문

- 새 레코드가 `status: "accepted"`이고 `date`, `volume`, `issue`, `pages`가 비어
  있으면 Acceptance 게시글을 한 번 생성합니다.
- 이후 같은 `id`에 실제 `date`, `volume`, `issue`, `pages`를 모두 입력하면
  Publication 게시글을 별도로 생성합니다. `status`도 `published`로 바꾸는 것을
  권장하지만, 게시 판정은 실제 게재 정보 네 필드를 기준으로 합니다.
- 제목의 학술지 약칭은 내장된 표를 사용합니다. 새 학술지의 약칭을 직접 정하려면
  해당 논문 레코드에 `"journal_abbr": "약칭"`을 추가합니다.
- Acceptance의 게시 날짜와 본문 월은 JSON에 실제 게재일이 아직 없으므로 업적
  변경 커밋 날짜를 사용합니다.

예시:

```json
{
  "id": 238,
  "type": "international-journal",
  "status": "accepted",
  "year": 2026,
  "month": null,
  "title": "Paper title",
  "authors": ["First Author", "Sungho Kang"],
  "journal": "IEEE Transactions on Very Large Scale Integration Systems",
  "volume": "",
  "issue": "",
  "pages": "",
  "date": ""
}
```

발행 후에는 같은 레코드를 다음처럼 갱신합니다.

```json
{
  "status": "published",
  "volume": "34",
  "issue": "10",
  "pages": "3100–3112",
  "date": "2026.10"
}
```

## 특허

- `patents_domestic_granted.json` 또는 `patents_international_granted.json`에 새
  등록 특허를 추가하면 Patent 게시글을 한 번 생성합니다.
- 출원 JSON은 자동 게시 대상이 아닙니다.
- 제목의 영문 제1발명자명은 `members.json`의 한글/영문 이름 대응표를 사용합니다.
  대응되는 사람이 없으면 특허 레코드에 `"lead_inventor_en": "English Name"`을
  추가할 수 있습니다.
- 국제특허 본문은 기존 사이트와 동일하게 `World Intellectual Property Office`
  문구를 사용합니다.

## 중복 및 수정

- 자동 게시글에는 `source_key`가 저장되어 같은 단계의 글이 두 번 생기지 않습니다.
- 같은 업적에 대한 기존 수동 게시글도 제목과 본문을 확인해 중복 생성을 피합니다.
- 업적 JSON을 고치면 이미 자동 생성된 게시글의 제목과 본문도 갱신됩니다. 게시글
  번호, 조회수, 이미지, 첨부파일은 그대로 유지합니다.
- 실행 결과는 저장소의 **Actions → Sync achievement news** 로그에서 확인합니다.

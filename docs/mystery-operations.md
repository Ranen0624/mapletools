# 미스터리 파일 최초 공개판 운영

## 현재 공개 상태

실제 PC 검색 결과 파일은 아직 제공되지 않았습니다. 최초 공개 JSON/CSV는 0명이며 기준일과 시상대는 `미수집`으로 표시합니다. 임의 캐릭터, 가상 전투력, 대체 코디 이미지를 공개 데이터에 추가하지 마세요. 검색 결과가 없다는 것은 캐릭터가 존재하지 않는다는 뜻이 아닙니다.

`mystery.html`은 GitHub Pages에서 그대로 동작하는 정적 페이지입니다. 빌드 서버나 유료 서비스, 브라우저 API 키가 필요 없습니다. 기존 CNAME과 Pages 설정을 유지합니다. PC 2.0.4 ZIP과 Android 1.0.5 APK는 이 기능과 별개이며 다시 빌드하지 않습니다.

## PC 결과 파일 받기

1. 실제 프로그램에서 280~300레벨의 원하는 직업·월드 범위를 검색합니다. 전체 결과 CSV 또는 JSON 배열을 사용합니다. 집계 통계 CSV는 사용할 수 없습니다.
2. 원본은 저장소 밖 또는 Git에서 제외한 `private-imports/`에 보관합니다. API 설정, 키, 로그, 계정정보를 제출할 필요가 없습니다.
3. 홈페이지의 **내 PC 검색 결과로 미리보기**에서 확인할 수 있습니다. 이 기능은 서버로 업로드하지 않으며 현재 탭의 메모리에서만 동작합니다. 다른 사람에게 공개하려면 아래 운영자 반영 절차가 필요합니다.
4. 날짜 열이 없으면 사용자가 실제 검색 시 선택한 **데이터 기준일**을 직접 입력합니다. 프로그램 실행일이나 오늘 날짜로 추정하지 않습니다. 서로 다른 기준일을 한 수집본에 섞지 않습니다.

필수 열은 `닉네임,월드,직업,레벨,전투력`입니다. `character_name,world_name,character_class,character_level,combat_power`도 지원합니다. 프로그램의 `본캐 후보,본캐 직업,본캐 레벨`도 인식합니다. 날짜는 `data_date,observedAt,observed_at,조회일,수집일,기준일,date` 중 하나로 `YYYY-MM-DD`를 사용합니다. 이미지 열은 `character_image,image_url,image,캐릭터 이미지`, 선택 식별자는 `ocid`입니다. `fetched_at` 같은 조회 시각은 데이터 기준일로 자동 사용하지 않습니다.

전투력은 정확한 양의 정수여야 합니다. 쉼표 표기는 CSV 따옴표로 감쌉니다. `1.8억`, 반올림값, 소수, 안전 정수 범위 초과는 거부합니다. 범위 밖 레벨, 행 열 개수 불일치, 잘못된 날짜, 같은 캐릭터·기준일의 수치 충돌도 파일 오류로 안내합니다. 동일 기록은 중복 제거합니다. 동률은 이름, 월드의 한국어 정렬로 표시하며 공동순위를 의미하지 않습니다.

CSV는 UTF-8/BOM 및 CP949, JSON은 UTF-8입니다. 최대 5MB·50,000행입니다. 빈 양식은 `data/mystery-template.csv`에 있으며 실제 캐릭터 행은 없습니다.

## 운영자 공개 반영

개발 브랜치에서 실행합니다. 경로의 원본 파일은 실제 파일 경로로 바꿉니다.

```powershell
node scripts/import-mystery.mjs --input private-imports/search-results.csv --date YYYY-MM-DD --scope private-imports/scope.json
node scripts/check-mystery.mjs
npm test
python tests/check_site.py
```

날짜 열이 모두 있으면 `--date`는 생략할 수 있습니다. `--scope`를 생략하면 행에서 확인한 직업·월드를 추출하고 `partial`로 표시합니다. `--output`으로 별도의 검토 경로를 지정할 수도 있습니다. 원본 경로를 출력 경로로 지정할 수 없습니다.

범위 메타데이터 파일은 아래 구조를 사용합니다. 값은 실제 검색 조건과 누락 사유에 맞게 고치세요. 이 예시는 캐릭터 데이터가 아닙니다.

```json
{
  "source": "PC 전체 검색 결과 · NEXON Open API",
  "coverage": {
    "status": "partial",
    "level_min": 280,
    "level_max": 300,
    "jobs": ["아델"],
    "worlds": ["루나"],
    "description": "PC 검색 조건과 수집 페이지 범위를 기재하세요.",
    "limitations": ["미응답·페이지 한도·검색 필터에 따른 누락을 기재하세요."]
  }
}
```

`jobs`/`worlds`의 `*`는 실제 전체 범위를 조사한 경우만 사용합니다. 기본은 일부 수집입니다. `complete`로 승격하려면 직업·월드 범위와 원본 대비 확인한 고유 대상 수 `expected_count`가 필요하고, 공개 행 개수와 같아야 합니다. 이는 운영자가 기재한 범위의 수집 완료 의미이며 공식 전체 랭킹 보증이 아닙니다. 필터가 수집 범위를 넓히면 화면은 다시 일부 수집으로 표시합니다. 빠진 행을 숫자로 채우거나 한 부문의 완료를 전 월드 완료로 확대하지 마세요.

변환기는 알려진 캐릭터 필드만 출력하며 API 설정 등 임의 필드는 제거합니다. 공개 파일에는 닉네임·월드·직업·레벨·전투력·외형 URL·기준일·선택 OCID만 남습니다. OCID는 캐릭터 공개 식별자이며 API 인증 키가 아닙니다. 공개 CSV는 수식 실행 접두어를 이스케이프합니다. 공개 JSON을 기준 원본으로 사용하세요.

검증 후 `data/mystery-rankings.json`과 같은 내용의 `.csv`를 **하나의 커밋**으로 반영하고 PR로 검토합니다. `check:mystery`는 두 파일의 일치와 알 수 없는 필드 유입을 확인합니다. 페이지·수집본·다운로드 파일 해시 검사를 모두 통과한 뒤 메인으로 병합합니다. Pages 배포 성공과 실제 `https://mapletools.kr/mystery.html`을 확인합니다. 문제 시 해당 기능 커밋을 되돌려 복원하며 배포 파일은 건드리지 않습니다.

## 코디 이미지

넥슨 `CharacterBasic.character_image`의 HTTPS 공식 주소만 재사용합니다. 누락 시 **외형 이미지 미수집**, 로드 실패 시 **이미지 확인 불가**입니다. 새 그림이나 대체 아바타는 만들지 않습니다. URL 사용자정보, 외부 호스트, 비밀정보 쿼리는 허용하지 않습니다. 지원 파라미터는 공식 문서의 action/emotion/wmotion/width/height/x/y입니다. 이미지는 수집본의 외형 주소이며 이후 닉네임·코디 변경 또는 넥슨 제공 상태에 따라 달라질 수 있습니다.

근거: [넥슨 캐릭터 외형 이미지 안내](https://openapi.nexon.com/ko/support/notice/2686587/).

## Cloudflare D1/Workers 확장 경계

최초 공개는 `mystery-config.json`의 `apiBase`를 비워 정적 JSON을 읽습니다. `mystery-source.js`가 연결만 담당하므로 화면·검증·정렬 코드를 바꾸지 않고 Worker로 교체할 수 있습니다. **현재 Cloudflare 계정·DB·자동 수집은 생성하거나 가동하지 않았습니다.**

준비된 선택 구성:

- `cloudflare/schema.sql`: 변경하지 않는 수집본 메타데이터/캐릭터 행, 공개 버전 포인터. 이전 버전을 남겨 복구 가능하게 합니다.
- `cloudflare/mystery-worker.js`: `GET /v1/mystery/snapshot`. 정적 JSON과 동일한 검증 계약, 허용한 사이트 원본에만 CORS, DB 오류는 503이며 가짜/이전 결과로 대체하지 않습니다. 외부 업로드·쓰기 API는 없습니다.
- `scripts/mystery-sql.mjs`: 검증한 공개 JSON을 D1 가져오기 SQL로 변환합니다. 모든 행 다음에 공개 포인터를 기록하며 수집본 ID는 내용의 SHA-256입니다. 동일 버전은 변경하지 않고 재사용합니다.
- `cloudflare/wrangler.example.toml`: DB ID를 직접 설정한 뒤 사용할 예시입니다. 실제 설정·`.dev.vars`·`.env`는 Git에서 제외합니다.

배포할 시점에 D1을 만들고 스키마와 검증한 SQL을 적용한 다음, Worker의 `PUBLIC_ORIGIN`을 실제 사이트 원본으로 설정합니다. Worker 응답을 검증한 후 `mystery-config.json`의 `apiBase`만 HTTPS 주소로 바꿉니다. `apiBase`는 공개 읽기 주소이며 키를 넣는 곳이 아닙니다.

```powershell
node scripts/mystery-sql.mjs data/mystery-rankings.json private-imports/mystery-publish.sql
```

향후 자동 갱신 수집기는 **서버 안에서만** 실행합니다. 별도 후보 목록을 기준일별 작업 큐로 만들고 캐릭터 기본정보/전투력을 모은 뒤 같은 `prepareSnapshot` 검증을 통과한 수집본만 공개합니다. 키는 [Worker Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)에 저장하고 브라우저, 정적 JSON, Git, 요청 URL에 넣지 않습니다. [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)는 검증된 수집기와 호출량 예산이 마련된 뒤 활성화합니다. 429/누락은 재시도 큐와 수집 누락 메타데이터로 처리하고 전일 값이나 0으로 채우지 않습니다. 여러 차례 실행해야 하는 수집은 날짜별 staging에 모은 후 공개 포인터를 마지막에 전환합니다. 무제한 전수 수집이나 무료 한도를 보장하지 않습니다.

정식 운영 전에는 실제 검색 결과 확보, 원본 대비 누락 확인, 동일 기준일 비교, 이미지 사용·API 정책 확인, 실패 알림과 복구 기록, 호출 한도 및 데이터 신선도 정책을 확정합니다. [D1 무료 제공 범위](https://developers.cloudflare.com/d1/reference/faq/)와 [Workers 한도](https://developers.cloudflare.com/workers/platform/limits/)는 운영 전 다시 확인하세요.

## 이번 인계에서 확인한 등록 상태

시작 시 `main`과 `feature/mystery-podium-v1`은 모두 `540f9f0e8c404ca2b284d224c680ab4cb5ab42cd`였습니다. 이전 커밋에 `mystery-core.js`, 빈 데이터, 연결 설정, `mystery.html` 총 5개 파일이 개별 등록돼 있었습니다. HTML이 참조한 `mystery.css`와 `mystery.js`는 없어 페이지가 완성되지 않은 상태였습니다. 기존 PR은 없었습니다. 이 상태는 Git 이력으로 확인했으며, 이전 도구의 파일 등록 실패 오류 로그 자체는 참조 대화에 노출되지 않아 확정하지 않았습니다.

자동화 테스트의 검증용 입력은 테스트 메모리/임시 검증 폴더에서만 사용하며 공개 수집본에 넣지 않습니다. 실제 랭킹·실제 코디 표시의 최종 검수는 사용자가 제공한 실데이터 파일을 받은 뒤 수행해야 합니다.

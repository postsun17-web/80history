# 자료 검색 운영과 복원

## 검색 자료

기존 역사관의 영락연계 CHATBOT 메뉴와 오른쪽 챗봇 빠른 메뉴를 자료 검색으로 교체했다. 두 메뉴에서 같은 전체 자료를 검색한다. 기념관이나 개별 전시에는 새 검색 버튼을 추가하지 않았다.

등록 기사 224건과 나라지식정보 출처 목록의 한글 문서 26건을 포함한다. 검색 결과는 제목, 출처, 실제 본문 발췌를 표시한다. 여러 단어는 문서 단위 AND 조건이며, 선택하면 정제 본문을 읽고 검색 문단으로 이동한다. 검색 화면·검색 Worker·본문 데이터는 검색 창을 처음 열 때 불러온다. 검색어를 처리하는 외부 API나 AI 답변은 없다.

사진·스캔 이미지·삽입 개체는 OCR하지 않았다. 원문에 들어 있는 텍스트와 설명이 있는 이미지 대체 텍스트만 포함한다. HWP 출처는 자료의 제목과 단원명이며 인쇄 페이지 번호를 추정하지 않는다. 원본 HWP와 챗봇 모델 파일은 웹 배포나 Git에 포함하지 않는다.

## 자료 갱신

`museum-web`의 형제 위치에 기존 `html` 폴더와 `챗봇/ypc-chatbot.20261106.tar`를 둔 현재 폴더 구조에서 실행한다.

```powershell
.\museum.ps1 import-search
.\museum.ps1 test
.\museum.ps1 build
```

추출기는 등록 기사 목록과 검토 제목, TAR 안의 출처 목록과 HWP 본문을 읽는다. 한글·한자를 보존하고 HWP 제어 코드를 구조에 따라 제외한다. 표 셀 좌표를 읽어 행·열 순서로 정렬한다. 원문 제목, 본문, 출처를 변경하면 세 산출물을 함께 검토하고 커밋한다.

- `src/search/corpus.json`: 정제 본문과 문서 메타데이터
- `src/search/catalogue.json`: 주소 검증용 문서 ID와 문단 수
- `docs/workspace/search-corpus-audit.json`: 입력·출력 해시, 문서별 문단 수와 추출 한계

현재 코퍼스는 13,479개 문단이다. 기사 문단은 1,103개, HWP 문단은 12,376개다. HWP 26건은 압축된 HWP 5.0 형식이며 표 200개의 셀 좌표를 확인했다. 원본 순서만 사용한 표와 제목만 남은 기사는 없다. 같은 입력을 두 번 수집한 세 산출물은 바이트 단위로 일치했다.

## 복원 지점

| 태그 | 의미 |
| --- | --- |
| `backup/pre-search-2026-11-06` | 자료 검색 변경 전 0.1.0. 현재 G드라이브 실행 도구와 작업 기록 포함 |
| `v0.2.0` | 자료 검색 구현과 검증을 마친 버전 |

변경 전 복원 태그의 커밋은 `deb6583cdfc60c442668d71b1713da902cf36e56`이다. 두 태그는 원격 `postsun17-web/80history`에 보존한다. 작업 중인 수정이 있으면 먼저 커밋하거나 별도로 보존한 후, 태그에서 새 복원 브랜치를 만든다.

다른 컴퓨터에서 새로 복제할 때는 파일 해시 검증을 위해 Git의 자동 줄바꿈 변환을 끈다. 기존 작업 폴더를 덮어쓰지 않고 비어 있는 위치에서 다음 명령을 사용한다.

```powershell
git clone --config core.autocrlf=false https://github.com/postsun17-web/80history.git museum-web
```

```powershell
git fetch origin --tags
git switch -c restore/pre-search backup/pre-search-2026-11-06
.\museum.ps1 test
.\museum.ps1 preview
```

미리보기 서버를 `Ctrl+C`로 종료한 뒤 배포한다. 다음 명령은 실제 운영 사이트를 해당 소스로 되돌린다.

```powershell
.\museum.ps1 deploy-production
```

다시 자료 검색 버전으로 복원하려면 `v0.2.0` 태그에서 다른 브랜치를 만든다. 공유 `main`에 강제 푸시하거나 로컬 수정 파일을 삭제할 필요는 없다. Git의 태그는 소스 복원 지점이다. 관람 자산과 실행 도구까지 보존하려면 `museum-web`과 `museum-workspace` 두 폴더가 필요하며 Google Drive 동기화와 오프라인 보관 여부는 별도로 확인한다.

로컬 `dist`에는 관람 자산 전체가 없다. 미리보기는 `museum.ps1 preview`, 배포는 `museum.ps1 deploy-preview` 또는 `museum.ps1 deploy-production`을 사용한다. Vercel에서는 기존 전체 자산 복원·빌드 절차를 유지한다.

# 영락교회 디지털역사관 · PSV 시범 구현

관람 주소: **https://youngnak-museum-poc.vercel.app**

기존 영락교회 디지털역사관의 제공 자료와 운영 사이트를 참고해 Photo Sphere Viewer로 다시 만든 관람용 시범 페이지입니다. 원본 ZIP을 열거나 기존 사이트를 수정하지 않았습니다.

## 구현 범위

- 로비 → A존 입구 → ‘복음의 문이 열리다’ 3개 공간
- 360도 회전·확대, 지도 위치/방향, 공간 선택, 원본 XML에 있는 안내판
- 전시 6쪽, 사진 10점 확대, 설명문 5개와 본문 이미지 3개
- A존 YouTube 소개 영상, 전자책 29종의 분류 및 외부 열기
- 시작 안내, 모바일 레이아웃, 대화상자 키보드 포커스와 Escape 닫기
- `startscene`, `startlookat`, `page`, `exhibit` 주소 복원 및 브라우저 뒤로/앞으로 이동

CMS·통계·챗봇·유물 회전·외부 입장 장면과 나머지 전시실은 포함하지 않습니다.

## 실행

Node.js 22.12 이상을 사용합니다. Google Drive 가상 드라이브에서 npm 패키지 쓰기가 실패해, 실제 개발·빌드 장소는 `C:\Users\user\Projects\youngnak-museum-poc`입니다. `G:\내 드라이브\영락역사관\psv-poc`에는 동일한 소스와 사용 자산을 보관합니다. 다른 컴퓨터에서도 일반 로컬 폴더에 복사해 실행하는 것을 권장합니다.

```powershell
npm ci
npm run dev
npm test
npm run build
```

개발 주소: http://127.0.0.1:5173/

## 수정할 파일

| 대상 | 파일 |
| --- | --- |
| 화면 구성, 자료 팝업, 내비게이션 | `src/main.ts` |
| 디자인과 모바일 레이아웃 | `src/style.css` |
| 파노라마·패널 배치·핫스팟 | `src/viewer.ts` |
| 주소 해석과 각도 변환 | `src/navigation.ts` |
| 브라우저 이력의 시점 복원 | `src/history.ts` |
| 장면·사진·전자책·설명 데이터 | `src/data/museum.json` |
| 자료 출처, 해시, 복원 판단 | `docs/source-map.json` |
| 검증 내용·한계 | `docs/VERIFICATION.md` |

`museum.json`은 생성 데이터입니다. 자산을 다시 생성하면 수동 변경이 덮어써지므로 지속할 변경은 `tools/prepare_assets.py`에도 반영합니다.

## 원본과의 차이

메인 tour.xml과 일부 동작 정의가 암호화되어 있어 초기 시점, 이동 버튼, 첫 역사 전시의 패널 사각형은 시범용으로 보정했습니다. 완전한 원형 복원을 주장하지 않습니다. 원본 폭·높이·회전·기준점이 있는 안내판은 XML 값을 변환해 배치합니다. 추가 교정은 `src/viewer.ts`에서 할 수 있습니다.

사진 연결은 주석을 제외한 `list_a02_action.xml`과 운영 사진 목록을 우선했습니다. 예전 조각 `a2_111.xml`의 사진 다각형은 이름과 번호가 일치하는 2개만 사용합니다. 2쪽 설명의 직접 연결은 시범 관람의 보조 탐색입니다. 전자책 제목의 기존 오탈자는 역사 자료를 임의 교정하지 않고 보존했습니다.

런타임에서 krpano 또는 원본 HTTP 서버를 불러오지 않습니다. 파노라마·패널·사진·지도·책 표지는 배포에 포함됩니다. YouTube, Heyzine, Google Fonts는 HTTPS 외부 서비스입니다. API 키나 비밀 환경변수는 필요하지 않습니다.

## 자산 재생성·검사

Python 3 + Pillow가 필요합니다. 전체 원본 폴더 경로를 지정합니다. ZIP은 사용하지 않습니다.

```powershell
$env:YOUNGNAK_SOURCE='G:\내 드라이브\영락역사관'
python tools/prepare_assets.py
python tools/test_articles.py
python tools/verify_assets.py
```

원본 3840px 큐브 면의 마지막 256px 타일을 올바르게 합친 다음, 480px 균등 타일로 무손실 WebP 변환합니다. 생성 과정에서 디코딩 픽셀을 비교합니다. 2048px 중간 타일은 원본 JPG를 그대로 복사합니다. 준비된 전체 자산은 약 75.86MiB입니다.

## Vercel

별도 프로젝트 `youngnak-museum-poc`, 팀 `postsun17-webs-projects`에 배포했습니다. 첫 배포는 Vercel 규칙상 이 새 프로젝트의 Production이 되었고, 기존 영락교회 도메인·프로젝트는 변경하지 않았습니다. 공개 주소에는 `noindex, nofollow`가 적용됩니다. 검색 제외는 접근 제한 기능이 아닙니다.

```powershell
npx vercel link --project youngnak-museum-poc --scope postsun17-webs-projects
npx vercel deploy                # 후속 Preview
npx vercel deploy --prod         # 위 테스트용 고정 주소 갱신
```

이 PC는 한글 컴퓨터 이름 때문에 Vercel CLI의 OAuth 헤더 오류가 발생합니다. `tools/vercel-safe-host.cjs`는 CLI 프로세스 안에서만 호스트 이름을 ASCII로 바꾸는 우회 파일입니다. Windows 컴퓨터 이름이나 계정 설정은 바꾸지 않습니다. 필요할 때 설치된 Vercel CLI 진입점에 `node --require ./tools/vercel-safe-host.cjs <vercel-cli-entry> deploy`를 사용합니다.

상위 사용자 폴더의 Git 저장소가 자동 연결되는 것을 막기 위해 개발 폴더를 독립 Git 저장소로 초기화했습니다. 배포 프로젝트는 GitHub 자동 배포에 연결하지 않았습니다.

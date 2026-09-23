# 영락교회 디지털역사관 · PSV 시범 구현

관람 주소: **https://youngnak-museum-poc.vercel.app**. C방 오른쪽에서 새 E 전시실로 이동할 수 있습니다.

기존 영락교회 디지털역사관의 제공 자료와 운영 사이트를 참고해 Photo Sphere Viewer로 다시 만든 관람용 시범 페이지입니다. 납품 ZIP의 평문 `tour.xml`로 A·C 구역의 원래 이동 경로를 확인했습니다. 기존 사이트와 납품 파일은 수정하지 않았습니다.

## 구현 범위

- 로비 → A존 입구 → A존 오른쪽 → C존 입구 → C존 중앙 → C존 오른쪽 → 새 E 전시실 입구 → E 전시실 중앙. ‘복음의 문이 열리다’ 포함 9개 시점
- C존 오른쪽 벽의 출입구와 E 전시실 왕복 이동. E방은 기존 공간의 마감과 조명을 참고해 새로 만든 빈 시범 공간
- 360도 회전·확대, 지도 위치/방향, 공간 선택, 원본 XML에 있는 안내판
- 전시 6쪽, 사진 10점 확대, 설명문 5개와 본문 이미지 3개
- A존 YouTube 소개 영상, 전자책 29종의 분류 및 외부 열기
- 시작 안내, 모바일 레이아웃, 대화상자 키보드 포커스와 Escape 닫기
- `startscene`, `startlookat`, `page`, `exhibit` 주소 복원 및 브라우저 뒤로/앞으로 이동

CMS·통계·챗봇·유물 회전·외부 입장 장면과 나머지 전시실은 포함하지 않습니다. C존은 이번 동선에 필요한 시점만 구현했으며, C존 전시 콘텐츠 팝업 전체는 포함하지 않습니다.

## 실행

Node.js 22.12 이상을 사용합니다. Google Drive 가상 드라이브에서 npm 패키지 쓰기가 실패해, 실제 개발·빌드 장소는 `C:\Users\user\Projects\youngnak-museum-poc`입니다. `G:\내 드라이브\영락역사관\psv-poc-e-room`에는 E방이 포함된 소스와 사용 자산을 보관합니다. 다른 컴퓨터에서도 일반 로컬 폴더에 복사해 실행하는 것을 권장합니다.

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
| 장면 사이의 이동·도착 방향 | `src/scene-links.ts` |
| 자료 출처, 해시, 복원 판단 | `docs/source-map.json` |
| 검증 내용·한계 | `docs/VERIFICATION.md` |

`museum.json`은 생성 데이터입니다. 기존 자산을 다시 생성한 뒤 `tools/prepare_e_room_assets.py`를 실행하면 새 시점과 지도가 다시 추가됩니다.

## 원본과의 차이

메인 `tour.xml`은 ZIP에 편집 가능한 상태로 있습니다. 새로 연결한 A·C 장면 이동 각도는 이 파일을 기준으로 했습니다. 처음 만든 A존 역사 전시의 패널 사각형과 일부 시점은 아직 시범 보정값입니다. E방은 납품 원본에 없는 확장 공간입니다. 원본 폭·높이·회전·기준점이 있는 안내판은 XML 값을 변환해 배치합니다.

사진 연결은 주석을 제외한 `list_a02_action.xml`과 운영 사진 목록을 우선했습니다. 예전 조각 `a2_111.xml`의 사진 다각형은 이름과 번호가 일치하는 2개만 사용합니다. 2쪽 설명의 직접 연결은 시범 관람의 보조 탐색입니다. 전자책 제목의 기존 오탈자는 역사 자료를 임의 교정하지 않고 보존했습니다.

런타임에서 krpano 또는 원본 HTTP 서버를 불러오지 않습니다. 파노라마·패널·사진·지도·책 표지는 배포에 포함됩니다. YouTube, Heyzine, Google Fonts는 HTTPS 외부 서비스입니다. API 키나 비밀 환경변수는 필요하지 않습니다.

## 자산 재생성·검사

Python 3 + Pillow, Chrome, Node.js가 필요합니다. 납품 ZIP 내용이 빠짐없이 준비된 원본 폴더를 사용합니다. E방의 두 360도 시점은 로컬 Vite 서버에서 3D 장면을 렌더링합니다.

```powershell
$env:YOUNGNAK_SOURCE='G:\내 드라이브\영락역사관'
python tools/prepare_assets.py
```

다른 터미널에서 `npm run dev`를 시작하고 출력된 포트를 확인합니다. 기본값은 5173이며 다르면 `$env:E_ROOM_RENDER_URL='http://127.0.0.1:<포트>/tools/render_e_room.html'`을 지정합니다. 생성 스크립트는 각 면의 3D 렌더 완료 신호를 확인한 뒤 이미지를 저장하며, Chrome 임시 파일은 개발 서버의 감시 대상 밖에 둡니다.

```powershell
python tools/prepare_e_room_assets.py
python tools/test_articles.py
python tools/verify_assets.py
```

기존 세 공간은 원본 3840px 면을 사용합니다. 새로 추가한 원본 A·C 시점은 2048px 면을 사용하고, 제안 공간 E방은 두 시점에 동일한 3D 구조를 적용해 1024px 면을 렌더링합니다. C방 출입구의 편집 원본은 `tools/assets/c-right-portal.png`입니다. 현재 전체 배포 자산은 약 87.73MiB입니다.

## Vercel

별도 프로젝트 `youngnak-museum-poc`, 팀 `postsun17-webs-projects`의 Production 주소에 E방을 반영했습니다. 기존 영락교회 도메인·프로젝트는 변경하지 않았습니다. 공개 주소에는 `noindex, nofollow`가 적용됩니다. 검색 제외는 접근 제한 기능이 아닙니다.

```powershell
npx vercel link --project youngnak-museum-poc --scope postsun17-webs-projects
npx vercel deploy                # 후속 Preview
npx vercel deploy --prod         # 위 테스트용 고정 주소 갱신
```

이 PC는 한글 컴퓨터 이름 때문에 Vercel CLI의 OAuth 헤더 오류가 발생합니다. `tools/vercel-safe-host.cjs`는 CLI 프로세스 안에서만 호스트 이름을 ASCII로 바꾸는 우회 파일입니다. Windows 컴퓨터 이름이나 계정 설정은 바꾸지 않습니다. 필요할 때 설치된 Vercel CLI 진입점에 `node --require ./tools/vercel-safe-host.cjs <vercel-cli-entry> deploy`를 사용합니다.

상위 사용자 폴더의 Git 저장소가 자동 연결되는 것을 막기 위해 개발 폴더를 독립 Git 저장소로 초기화했습니다. GitHub 원격 저장소는 설정하지 않았고, 배포 프로젝트도 GitHub 자동 배포에 연결하지 않았습니다. E방 변경은 로컬 Git `master`에 병합하고 Vercel CLI로 Production에 반영했습니다.

# 영락교회 디지털역사관 — 원사이트 전체 복원 버전

[역사관 관람](https://youngnak-museum-poc.vercel.app/) · [한경직목사기념관](https://youngnak-museum-poc.vercel.app/hkjmuseum.html) · [GitHub](https://github.com/postsun17-web/80history)

업체 전달 자료와 원사이트의 XML·이미지·음원을 바탕으로 관람 화면을 재구현합니다. krpano 런타임 대신 Photo Sphere Viewer를 사용하며, 확대 이미지는 OpenSeadragon Canvas로 표시합니다.

## 구현 범위

- 역사관 원본 62개 시점, A–D 21개 전시 주제·207페이지. 임의로 추가했던 E방은 제거했고 C방도 원본 구조로 복원했습니다.
- 사진집, 본문, 전자책, 영상, PDF 및 기존 자료의 결손 안내를 유지합니다.
- 전시·사진집·관람 안내·본문 이미지 확대 화면에서 이전/다음, 페이지 수, 방향키를 지원합니다. 같은 자료 묶음 안에서만 이동하며 첫/끝에서는 이동 버튼을 비활성화합니다. 독립 이미지는 1/1로 표시합니다.
- 확대 페이지와 주소·3D 전시 페이지가 동기화됩니다. 창을 닫으면 마지막으로 본 전시 페이지가 남습니다. 기존 투명 이미지 합성과 검토 제목도 유지합니다.
- `/hkjmuseum.html`: 29개 관람 지점, 원본 이동 67개, 자체 회전 유물 17개(각 36프레임), 장소 해설 10개. 기념관은 외부 krpano·Spinzam 화면을 호출하지 않습니다.
- 기념관 실내는 면당 8704px 또는 8960px 원본 해상도를 유지한 다단계 타일을 사용합니다.
- 공통 음소거, 입장 동작 후 배경음·안내 해설, 영상 소리, 전경 자료의 소리 우선 처리를 지원합니다. 브라우저가 자동 재생을 차단하면 ‘소리 켜고 관람’을 누릅니다.
- 두 관의 왕복 및 브라우저 뒤로/앞으로 이동 시 장면·시점·전시 페이지를 복원합니다.

CMS·관리자·통계 서버는 포함하지 않습니다. 챗봇은 답변 서버 연결 전의 시범 화면입니다. 역사관의 기존 YouTube·전자책·일부 Spinzam 자료는 외부 서비스 제공 상태에 의존합니다. 원본 사진 목록의 구조용 빈 슬롯 14개는 실제 사진으로 집계하지 않습니다.

## 실행

Node.js 22.12 이상과 npm을 사용합니다.

```powershell
git clone https://github.com/postsun17-web/80history.git
cd 80history
npm ci
node scripts/restore-deploy-assets.mjs
npm run dev
```

개발 주소는 `http://127.0.0.1:5173/`입니다. `deployment-assets.json`에 기록된 공개 아카이브에서 자산을 복원하고 SHA-256을 검사합니다. 별도 토큰은 필요하지 않습니다. 기존 역사관 아카이브는 Vercel Blob, 기념관 아카이브는 동일 GitHub 저장소의 자산 릴리스에 보관합니다. 이는 빌드 입력이며 완성된 관람 자산은 Vercel에서 제공합니다. 기념관 추가 자산은 58,427개, 약 2.55GB입니다. 복원 폴더와 빌드 출력에 충분한 디스크 공간이 필요합니다.

```powershell
npm test
npm run build:vercel
```

`build:vercel`은 자산 복원·해시 검사, TypeScript 검사, Vite 빌드를 수행합니다. 이미 복원된 자산은 검사 후 재사용합니다.

## 주요 소스

| 대상 | 파일 |
| --- | --- |
| 관별 진입과 왕복 | `src/main.ts`, `src/museum-route.ts` |
| 화면·메뉴·전시 탐색 | `src/full-main.ts` |
| 파노라마·패널·핫스팟 | `src/full-viewer.ts`, `src/museum-viewer-data.ts` |
| 확대·본문·유물 | `src/full-content.ts` |
| 확대 묶음·주소 동기화 | `src/content-sequence.ts`, `src/content-route.ts` |
| 공통 사운드 | `src/museum-audio.ts` |
| 관별 데이터 | `src/data/full-museum.json`, `src/data/memorial-museum.json` |
| 검토 제목·판단 근거 | `src/data/content-titles.json` |
| 자산 복원·해시 | `deployment-assets.json`, `scripts/restore-deploy-assets.mjs` |
| 기념관 수집·변환·검증 | `tools/build_memorial_assets.py` |

`index.html`은 `src/main.ts`를 실행합니다. 전달받은 원본 ZIP 없이도 검증된 자산 아카이브로 실행할 수 있습니다. 원본에서 다시 생성하려면 수집 캐시가 필요합니다.

## 배포와 검증

Vercel 프로젝트는 `youngnak-museum-poc`, 팀은 `postsun17-webs-projects`입니다. `/hkjmuseum.html`도 같은 앱으로 연결됩니다. GitHub 자동 배포는 연결하지 않았으며 CLI로 미리보기 검증 후 공개합니다.

```powershell
npx vercel link --project youngnak-museum-poc --scope postsun17-webs-projects
npx vercel deploy
npx vercel promote <검증한-미리보기-주소>
```

- [기념관·사운드·확대 이동 구현 및 검증](docs/memorial-implementation.md)
- [기념관 원본·자산 검사](docs/memorial-source-audit.json)
- [확대 이미지·콘텐츠 제목 검토](docs/content-zoom-titles-verification.md)
- [전달 자료의 결손 재검증](docs/SOURCE-DEFECTS.md)
- [교회 상단·파노라마 방향 보정](docs/ENTRANCE-ORIENTATION-FIX.md)

물리적인 iPhone·Android 기기는 연결되지 않아 모바일 검증은 Chrome 화면·터치 에뮬레이션 기준입니다.

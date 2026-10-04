# 영락교회 디지털역사관 — 원사이트 최초 전체 복원 버전

[관람하기](https://youngnak-museum-poc.vercel.app/) · [GitHub 저장소](https://github.com/postsun17-web/80history) · [원사이트](http://youngnakdhm.net/)

업체에서 전달한 자료와 원 운영 사이트를 바탕으로 영락교회 디지털역사관의 관람 화면을 재구현한 첫 번째 전체 복원 기준 버전입니다. krpano 런타임 대신 Photo Sphere Viewer를 사용하며, 원본 XML의 공간·전시·자료 연결을 해석해 표시합니다.

2026년 10월 4일 기준 Vercel 관람 버전을 보관합니다. 전체 전시 복원, C방 오른쪽의 E방 확장, 전달 자료 재검증에 따른 빈 사진 위치 보강, 입장 전 교회 상단과 파노라마 위·아래 면의 방향 수정을 포함합니다.

## 구현 범위

- 원본 62개 시점과 새 E방 2개 시점: 실외, 로비, A–D 전시실, C방과 연결되는 E방
- 전시 207쪽, 사진 목록 598건, 기사 224건, 전자책 29권, YouTube 영상 ID 55개
- 원본 이동 경로·지도·메뉴·전시 페이지, 사진 및 기사 이미지 확대, 유물 회전, 음성·영상·PDF
- 시작 장면·시선·전시 페이지를 포함하는 주소, 브라우저 뒤로·앞으로 이동, 모바일 화면
- C03의 빈 사진 위치 6개에 전달 자료의 동일 사진 3개와 관련 주제 사진 묶음 3개 연결
- 원본 62개 파노라마의 위·아래 면 방향 보정으로 교회 첨탑·지붕과 천장·바닥 연결 수정

여기서 전체 복원은 **관람 화면과 제공 전시 콘텐츠**를 뜻합니다. E방은 원본에 없는 확장 공간입니다. CMS·관리자·통계 서버는 재구현 대상이 아니며, 챗봇은 답변 서버가 연결되지 않은 시범 화면입니다. YouTube·전자책·Spinzam은 외부 서비스의 제공 상태에 의존합니다. 원본 사진 목록의 구조용 빈 슬롯 14개는 실제 사진으로 집계하지 않습니다.

## 실행

Node.js 22.12 이상과 npm을 사용합니다. 저장소를 일반 로컬 폴더에 복제한 뒤 실행합니다.

```powershell
git clone https://github.com/postsun17-web/80history.git
cd 80history
npm ci
node scripts/restore-deploy-assets.mjs
npm run dev
```

개발 주소는 `http://127.0.0.1:5173/`입니다. 대용량 이미지·파노라마는 공개 Vercel Blob 아카이브에서 복원합니다. `deployment-assets.json`에 다운로드 주소와 SHA-256이 기록되어 있으며, 복원에는 별도의 토큰이 필요하지 않습니다. 활성 자산은 8,028개, 약 770MiB입니다. `public/media/full/`은 복원 결과이므로 Git에서 제외합니다.

```powershell
npm test
npm run build:vercel
```

`build:vercel`은 자산 복원·해시 검사, TypeScript 검사, Vite 빌드를 수행합니다. 이미 복원된 자산은 검사 후 재사용합니다.

## 주요 소스

| 대상 | 파일 |
| --- | --- |
| 화면 구성·메뉴·전시 탐색 | `src/full-main.ts` |
| 파노라마·패널·핫스팟 | `src/full-viewer.ts` |
| 사진·기사·전자책 등 자료 표시 | `src/full-content.ts` |
| 화면 및 콘텐츠 스타일 | `src/full-style.css`, `src/full-content.css` |
| 공간·전시·콘텐츠 데이터 | `src/data/full-museum.json` |
| 배포 자산 목록·해시 | `deployment-assets.json` |
| 대용량 자산 복원 | `scripts/restore-deploy-assets.mjs` |
| 원본 XML 컴파일·자산 변환 | `tools/compile_full_museum.py`, `tools/build_full_assets.py` |

`index.html`은 `src/full-main.ts`를 실행합니다. 초기 시범 구현의 소스와 검증 기록도 이력 확인을 위해 남겨 두었습니다. 생성된 자료를 실행하는 데에는 업체 원본 ZIP이 필요하지 않습니다. 원본에서 데이터를 다시 생성하려면 별도의 납품 자료와 XML 캐시가 필요합니다.

## 배포와 검증 기록

고정 관람 주소는 [youngnak-museum-poc.vercel.app](https://youngnak-museum-poc.vercel.app/)입니다. Vercel 프로젝트는 `youngnak-museum-poc`, 팀은 `postsun17-webs-projects`이며, `vercel.json`의 빌드 명령은 `npm run build:vercel`입니다. 현재 배포는 Vercel CLI를 사용하며 GitHub 자동 배포는 연결하지 않았습니다.

```powershell
npx vercel link --project youngnak-museum-poc --scope postsun17-webs-projects
npx vercel deploy
npx vercel deploy --prod
```

관람 화면의 기준 커밋은 `ff029f0`입니다. 이 버전은 자동 테스트 45개, TypeScript 검사 및 Vercel 빌드를 통과했습니다. 데스크톱·모바일 교회 상단, 원본 사이트와의 비교, 로비·E방 천장과 실제 입장 동작을 확인했습니다. 테스트 사이트에는 검색 제외 설정이 적용되어 있습니다.

- [전체 복원 범위와 실행 안내](docs/FULL-RESTORATION-README.md)
- [교회 상단 연결 수정과 배포 검증](docs/ENTRANCE-ORIENTATION-FIX.md)
- [전달 자료의 빈 파일 재검증 및 보강 근거](docs/SOURCE-DEFECTS.md)
- [전체 복원 작업 기록](docs/FULL-RESTORATION-PROGRESS.md)

# 운영 소스 복구 검증 기록

확인일: 2026-10-25. 편집 기준은 `G:\내 드라이브\영락역사관\museum-web`, 실행 위치는 `E:\CodexAssets\youngnak-workspace\source`다.

## 소스 일치 근거

- 저장소: https://github.com/postsun17-web/80history
- 복구한 `main`: `bdeb3d2139aec34183f3688b31d759752f1f938e`
- 운영 배포 코드: `c6eb8f2f142f8acd8a04b28438eba30b97e4e2fa`
- 두 커밋의 차이는 `docs/pinch-direction-progress.md` 한 개이며 실행 코드는 같다.
- 운영 배포: `dpl_4DB7s9th9xw6RBWfC5PcjvL1515h`
- 로컬 작업 브랜치: `chore/local-workspace-20261025`

복구한 잠금 파일로 의존성을 설치하고 TypeScript 검사 및 Vite 번들을 생성했다. 다음 세 파일은 운영 URL에서 다시 받아 비교했으며 크기와 SHA-256이 일치했다.

| 빌드 파일 | 바이트 | SHA-256 |
| --- | ---: | --- |
| `index-zuoaoP2H.js` | 2,242,413 | `c902ac94cbc9c310fbbacbf7a838ec64fafb6ae7f943273457aaad76c2073fb9` |
| `index-aODj3v8-.css` | 37,409 | `f7c179d1bb5c279730db783d963af0e7ad9d3d0f3b163a6a9303b5d7392fb216` |
| `memorial-museum-FiMmMWSj.js` | 57,674 | `45bcb7d577a06241c4677724c09a5ee2e3bc4decda3b3dc7a2857904c91f8d2f` |

이전 배포 로그에서 추출한 근거는 [deployment-source-evidence.json](deployment-source-evidence.json)에 있다. 해당 로그는 업로드된 변경 파일 12개만 열거하므로 전체 소스 파일의 해시 목록으로 사용하지 않는다.

## 환경과 권한

- Node.js `24.22.1`, npm `12.2.1`, Vercel CLI `65.2.0`.
- 프로젝트 `youngnak-museum-poc`: `prj_r5Q33OKub3j7U0OFzTYz06K8YAkz`.
- 팀 `postsun17-webs-projects`: `team_APvLc6mVLVOiWui8NxDgLzA2`.
- 사용자가 CLI 기기 인증을 완료했고 `whoami`와 해당 팀의 `project inspect`가 성공했다.
- 인증 정보는 작업 소스와 이 기록에 저장하지 않았다.
- 환경 정리 중 Preview 또는 Production 배포는 실행하지 않았다.

## 브라우저 확인 범위

로컬 Vite에서 실제 파노라마 표시와 다음 동작을 확인했다.

- 역사관 입구와 A 전시실 이동.
- 전시 이미지 확대, 다음 자료로 이동, `page=2` 주소 반영, 전시로 복귀.
- 역사관에서 한경직목사기념관으로 이동.
- 기념관 외부 입구, 1층 입구·다음 관람 지점, 2층 입구 표시.

초기 자료 복원 도중 켠 개발 서버는 새 공개 파일 목록을 반영하지 못했다. 복원 완료 후 서버를 다시 시작하여 정상 표시를 확인했다. 이 기록은 데스크톱 대표 동작 검사이며 모든 전시·모바일 제스처의 전체 회귀 검사를 의미하지 않는다.

## 최종 검사

| 항목 | 결과 |
| --- | --- |
| 전체 자동 테스트 | 175개 통과, 실패·건너뜀 0개 |
| Windows 명령 잠금 프로세스 검사 | 5개 통과 |
| 공개 관람 자산 | 66,557개, 3,360,539,007바이트의 크기·SHA-256 전체 일치 |
| 원격 아카이브 | 38개 모두 HEAD 200, 응답 크기와 매니페스트 일치 |
| `museum.ps1 build` | 종료 코드 0, TypeScript 및 Vite 성공 |
| 최종 `dist/assets` | 위 운영 번들 3개와 크기·SHA-256 일치 |
| `museum.ps1 dev --port 5173` | 검증 결과 재사용 후 정상 시작 |
| 실제 편집 동기화 | 임시 TypeScript 파일 추가·수정·삭제가 G → E 및 HTTP 응답에 반영됨, 서버 유지 |
| 최종 빌드 브라우저 검사 | `dist` 미리보기에서 역사관 입장, 기념관 이동, 역사관 복귀 성공; 콘솔 오류·경고 0개 |

전체 검사와 빌드는 이 E: 환경에서 759초 걸렸으며 그중 Vite 빌드는 약 4분 50초였다. Vite 빌드 시간의 대부분은 관람 자산을 출력 폴더로 복사하는 데 쓰였다. 일상적인 편집은 검증된 자료를 재사용하는 `dev`로 확인한다. `setup`, `build`, `preview`와 배포 명령은 전체 파일 검사를 유지한다.

개발 전용 캐시를 추가하기 전 시작한 전체 빌드가 성공한 뒤, 검증 기록에 **그 빌드가 검사한 실행 폴더의 매니페스트 SHA-256**을 추가했다. 이후 실제 `dev` 실행에서 동일 매니페스트·카탈로그의 캐시 재사용을 확인했다. 캐시 로직 추가 후 전체 175개 테스트도 다시 통과했다.

기존 애플리케이션의 큰 번들 및 중복 정적·동적 import 경고는 남아 있지만 빌드는 성공했다. 애플리케이션 코드·의존성 잠금·Vercel 빌드 명령은 복구 기준과 동일하며, 로컬 작업 도구와 안내 문서 및 로컬 표식 업로드 제외 규칙을 추가했다.

Windows에서 복사 도중 새 파일을 감시하면 `EBUSY`로 개발 서버가 종료되는 현상을 확인했다. 감시 폴더 밖에서 복사를 마치고 원자적으로 교체하도록 보완한 후 실제 추가·수정·삭제 검사를 통과했다. 명령 간 잠금은 문서화된 `Ctrl+C` 종료 흐름으로 확인했다.

상세 실행 기록은 `E:\CodexAssets\youngnak-workspace\logs`의 `build-final.log`, `tests-final.log`, `check-final.log`, `verified-bundles.json`, `remote-archives.json`, `dev-sync-smoke.json`에 있다. 독립 코드 리뷰에서 지원하는 작업 흐름의 차단 문제는 남지 않았다.

## 업체 원본

`E:\CodexBackups\youngnakdhm-2026-10-12`와 기존 납품 자료는 보존했다. 업체 사이트 및 백업의 역할과 검증 범위는 [vendor-baseline.md](vendor-baseline.md)에 기록했다.

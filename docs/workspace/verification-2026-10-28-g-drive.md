# G드라이브 통합 검증 기록 — 2026-10-28

상태: **G드라이브 통합 및 실제 실행 검증 완료.** E드라이브가 없는 상태에서 자산 66,557개 전체 디스크 해시 검사, 테스트 193개, 실제 빌드·미리보기·개발 동기화·Vercel 접근 확인을 통과했다. 실제 Vercel 배포·커밋·Git push는 수행하지 않았다.

## 구성

- 편집 원본: `G:\내 드라이브\영락역사관\museum-web`
- 실행·자산·도구: 형제 폴더 `G:\내 드라이브\영락역사관\museum-workspace`
- 복원한 공개 자산: 66,557개 / 매니페스트 기준 3,360,539,007바이트. ZIP 38개는 중복 보관하지 않는다.
- Node.js 24.22.1, npm 12.2.1, Vercel CLI 65.2.0을 G에 배치했다. npm 배포 압축 파일은 공식 레지스트리의 SHA-512 integrity와 대조했다.
- `museum.ps1`과 도구는 드라이브 문자를 하드코딩하지 않고 편집 폴더의 형제 위치를 계산한다. 소유권 마커, 경로 이탈·링크 검사, Windows 실행 잠금, 고정 Vercel 팀·프로젝트 검증을 유지한다.

## 저장 공간과 설치 방식

사용자가 C 공간을 추가로 확보하지 않고 현재 공간에서 진행하도록 지시했다. 로컬 빌드는 `copyPublicDir: false`로 화면 코드만 생성하고, 미리보기는 `source/public`의 원래 자산을 함께 제공한다. `dist`는 독립 배포 파일 묶음이 아니다. Vercel의 `vercel.json`은 기존 `npm run build:vercel`을 유지하여 서버에서 자산을 복원하고 전체 사이트를 빌드한다.

G에 직접 실행한 npm 설치는 `TAR_ENTRY_ERROR UNKNOWN` 및 `EBADF` 쓰기 오류로 실패했다. 동일 Node/npm/package-lock의 OS 임시 폴더 설치는 24개 패키지, 25초로 성공했다. 따라서 의존성 설치기는 임시 폴더에서 정확한 잠금 파일로 설치 후 닫힌 파일을 G의 후보 폴더에 복사하고, 성공 시 기존 의존성과 교체한다. 실패 시 이전 의존성을 보존하거나 복구한다. 자체 임시 폴더만 정리한다.

npm 실행 자체도 Google Drive의 전체 모듈 로더에 의존하지 않도록 바꿨다. G에 보관한 고정 버전 npm `.tgz`의 SHA-512와 버전을 검증하고 OS 임시 폴더에 풀어 설치에 사용한다. `check`는 npm 전체 로더를 실행하는 대신 설치된 `npm/package.json`의 버전을 표시한다. 따라서 `check`의 npm 버전 표시는 설치 정보 확인이며, 실제 설치 성공 근거는 아래의 별도 설치 기록이다.

Google Drive의 클라우드 할당량과 G 가상 볼륨의 로컬 캐시 여유 공간은 다르다. F는 USB/exFAT로 확인되어 NTFS가 필요한 Windows Google Drive 캐시를 이전하지 않았다. 캐시·레지스트리 설정 변경과 디스크 포맷은 수행하지 않았다. [Google 캐시 안내](https://support.google.com/drive/answer/13470231?hl=en), [지원 파일 시스템](https://knowledge.workspace.google.com/admin/drive/advanced-drive-for-desktop-configuration?hl=en).

## 완료된 확인

- 모든 자산 아카이브 URL 38개가 HTTP 200 및 매니페스트 크기와 일치했다: `museum-workspace/logs/remote-archives-g.json`.
- 38/38 아카이브에서 66,557개 자산을 G의 `source/public`에 복원했다. 기존 복원기의 아카이브 해시와 ZIP 내부 파일별 크기·해시 검사를 통과했다: `restore-progress.json`, `restore-g-assets-parallel.log`.
- G에 저장된 모든 파일을 다시 읽어 크기·SHA-256을 대조했고 **66,557/66,557개가 일치**했다: `preview-g-final.log`.
- 실제 G 의존성 설치를 완료했다. 1,725개 파일 / 90,395,439바이트가 기록되어 있다: `dependency-install-g.json`, `dependency-install-g-final.log`.
- G에서 실제 `museum.ps1 test` 최신 실행: **193개 통과, 실패 0, 건너뜀 0**: `tests-g-final.log`. 앞선 작은 격리 검사와 구분되는 실제 작업 환경의 전체 테스트 결과다.
- G에 설치한 Vercel CLI의 esbuild 네이티브 실행 파일이 `--version`에서 `0.27.0`을 출력했다. 이는 해당 실행 파일의 동작 확인이며 실제 배포 결과가 아니다.
- 최신 관련 집중 검사 26개 통과.
- 한글·공백 경로와 다른 작업 디렉터리 실행, 자식 프로세스 환경 변수 적용·복원을 포함한 격리 Windows 잠금·환경 검사 7개 통과.
- 의존성 설치기 격리 검사 6개 통과. 별도 검토자가 다시 검사했다.
- 실제 Vite 8.3.0을 사용한 작은 빌드·HTTP 통합 검사 2개 통과. 빌드 HTML/JS/CSS와 미디어 HTML/CSS/JS의 바이트 일치, 동영상 Range 206, HEAD, 두 관 진입 주소, 개발 소스 경로 차단을 확인했다.
- G의 CLI가 정상 실행되고 기존 로그인 계정 및 `youngnak-museum-poc` 접근을 확인했다: `vercel-auth-g.log`, `vercel-project-g.log`.
- CLI 파일 7,401개 / 324,964,119바이트를 G로 복사하고 파일 크기를 대조했다: `cli-copy.json`. 최초 실패 설치 사본은 보존했다.
- 독립 코드 검토에서 경로 이전, 설치기, 작은 빌드·미리보기의 차단 문제를 찾지 못했다.
- 실제 `museum.ps1 preview --port 4173`에서 TypeScript 검사를 통과하고 Vite 빌드에 성공했다. Vite 자체 빌드 시간은 **3.71초**이며, 앞선 전체 자산 검사 시간은 이 수치에 포함되지 않는다: `preview-g-final.log`.
- 빌드한 운영 JS·CSS 3개 모두 크기와 SHA-256이 운영본과 일치했다. `dist/media`가 없어 자산을 중복 복사하지 않는 것도 확인했다: `build-parity-g.json`.
- 데스크톱 브라우저에서 역사관 입구 파노라마, 안내도 이동(`scene_a-c-w-1`), 전시 이미지 확대(`sector_a03_01`)와 닫기, 기념관(`scene_vr11`) 파노라마 및 21초 음성 메타데이터, 원래 역사관 시점으로 복귀를 확인했다. 콘솔 오류는 0개였다: `browser-qa-g.json`. 모바일 화면과 음성 전체 청취를 포함하는 전수 관람 검사는 이번 범위가 아니다.
- 실제 MP3·MP4·기존 전시 HTML의 HEAD 요청은 200, 범위 요청은 206이었다. 기존 HTML은 원본과 바이트 해시가 같았다: `http-preview-g.json`.
- `museum.ps1 dev`는 검증한 66,557개 자산의 캐시를 재사용했다. 편집 원본에 시험 파일을 추가·수정하면 HTTP 200으로 반영됐고, 삭제 후 JavaScript Accept 헤더 요청은 404이며 원본·실행 사본 모두에서 제거됐다: `dev-g-final.log`, `dev-sync-g.json`.
- 미리보기와 개발 서버는 검증 후 `Ctrl+C`로 종료했다. 각 종료 코드 1은 의도적인 서버 중단 결과이며 빌드·검증 실패가 아니다.
- 최종 `check`에서 Node 24.22.1, 설치된 npm 12.2.1, Vercel CLI 65.2.0, 의존성 준비, CLI 로그인과 정확한 프로젝트 접근을 확인했다: `check-g-final.log`. 프로젝트는 `youngnak-museum-poc` / `prj_r5Q33OKub3j7U0OFzTYz06K8YAkz`, 팀은 `team_APvLc6mVLVOiWui8NxDgLzA2`다.
- `E:/`가 존재하지 않는 상태에서 위 검증을 수행했다. 마지막 확인 시 C 여유 공간은 약 1.98GB였으며 이 값은 시점에 따라 달라진다.
- `git diff --check`를 통과했다. HEAD 대비 `src`, `package.json`, 잠금 파일, Vite 설정, `vercel.json`, 운영 자산 복원 스크립트, 자산 매니페스트의 변경이 없음을 확인했다.

## 전체 디스크 검사와 성능 조정

첫 `preview`는 검사 작업자 8개와 기본 libuv 스레드 풀에서 5,000/66,557개까지 약 14분이 걸렸다. 검사한 5,000개는 모두 일치했으나 성능 개선을 위해 `Ctrl+C`로 의도적으로 중단했다. 종료 코드 1은 이 중단 결과이며 전체 자산 검증 완료를 뜻하지 않는다. 당시 로그는 `preview-g-before-parallel.log`에 보존했다.

검사 동시 작업을 최대 32개로 조정하고, 동시에 읽는 파일 버퍼의 합계를 128MiB 이내로 제한했다. **128MiB는 파일 버퍼 예산이며 프로그램 전체 RAM 사용량의 상한이 아니다.** `UV_THREADPOOL_SIZE=32`는 래퍼가 실행하는 자식 프로세스 범위에 적용하고 종료 후 원래 환경으로 복원한다. 이 변경 후 전체 테스트 193개, 관련 집중 검사 26개, Windows 잠금·환경 검사 7개를 통과했으며 독립 검토에서도 차단 문제를 발견하지 않았다.

조정 후 새 `preview`의 전체 디스크 해시 검사는 66,557/66,557개 일치로 끝났고, 이후 TypeScript 검사·Vite 빌드·브라우저 확인까지 완료했다. 최종 근거는 `preview-g-final.log`와 위의 개별 검증 기록이다. 기존 Vite의 동적·정적 동시 import 경고와 500kB 초과 청크 경고는 남아 있으며 빌드는 성공했다.

다시 다운로드한 운영본과 G 빌드 결과가 모두 일치한 SHA-256:

| 파일 | SHA-256 |
| --- | --- |
| `assets/index-zuoaoP2H.js` | `c902ac94cbc9c310fbbacbf7a838ec64fafb6ae7f943273457aaad76c2073fb9` |
| `assets/index-aODj3v8-.css` | `f7c179d1bb5c279730db783d963af0e7ad9d3d0f3b163a6a9303b5d7392fb216` |
| `assets/memorial-museum-FiMmMWSj.js` | `45bcb7d577a06241c4677724c09a5ee2e3bc4decda3b3dc7a2857904c91f8d2f` |

## 최종 확인표

- [x] 모든 자산 복원과 아카이브·ZIP 내부 파일 해시 검증
- [x] G의 실제 의존성 설치 및 최신 전체 테스트 193개 통과
- [x] G 파일 전체를 다시 읽는 디스크 해시 검사
- [x] 실제 로컬 빌드와 운영본 파일 해시 비교
- [x] 두 관 데스크톱 화면 및 편집 자동 동기화
- [x] 최종 CLI 로그인·프로젝트 접근 확인
- [x] 최종 안내 문구 갱신

## 보존 사항

외주 업체 백업, 기존 납품 자료, 이전 PSV 폴더를 변경하지 않았다. 실제 운영 배포·Git push는 하지 않았다.

G의 시험용 `io-probe`와 실패한 `npm-cache` 정리 명령은 자동 승인 검토에서 `blocked by policy`로 거부되어 보존했다. C의 임시 설치본 `C:\Users\선익님\AppData\Local\Temp\museum-g-install-20261028` 삭제도 같은 이유로 거부되어 보존했다. 이 수동 정리 미완료 항목을 최종 실행 파일·관람 자산과 구분한다. 최종 일상 실행은 이 C 임시 설치본이나 E드라이브를 요구하지 않는다.

Google Drive 클라우드 업로드 완료나 전체 오프라인 고정은 로컬 파일 존재와 별도로 확인해야 한다.

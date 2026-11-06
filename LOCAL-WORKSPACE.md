# 이 컴퓨터에서 수정·실행·배포하기

**편집할 폴더는 `G:\내 드라이브\영락역사관\museum-web`입니다.** 기존 `psv-museum-full`, `psv-poc`, E드라이브의 예전 배포 폴더는 현재 편집 기준이 아닙니다.

2026-10-25에 기존 E드라이브 환경에서 운영 소스 복구, 자산 검증, 빌드, 실제 편집 동기화, CLI 로그인과 프로젝트 접근 확인을 완료했습니다. [당시 복구·검증 기록](docs/workspace/verification-2026-10-25.md)은 과거 환경의 근거입니다.

**2026-10-28에 G드라이브 통합을 완료했습니다.** E드라이브가 없는 상태에서 관람 자산 66,557개 전체 해시 검사, 테스트 193개, 실제 빌드·두 관 화면·편집 자동 동기화, Vercel 로그인·프로젝트 접근을 확인했습니다. 빌드한 JS·CSS 3개는 운영본과 바이트·해시가 일치합니다. [G 환경 검증 기록](docs/workspace/verification-2026-10-28-g-drive.md)에 상세 결과와 범위를 남겼습니다. 실제 운영 사이트를 새로 배포하지는 않았습니다.

## 복구한 소스

- GitHub: https://github.com/postsun17-web/80history
- 복구 기준: `main`의 `bdeb3d2139aec34183f3688b31d759752f1f938e`
- 현재 운영 코드: `c6eb8f2f142f8acd8a04b28438eba30b97e4e2fa`
- 두 커밋의 차이는 배포 검증 문서 한 개뿐이며 실행 코드는 같습니다.
- 운영 사이트: https://youngnak-museum-poc.vercel.app/
- 한경직목사기념관: https://youngnak-museum-poc.vercel.app/hkjmuseum.html
- Vercel 프로젝트: `youngnak-museum-poc` / 팀 `postsun17-webs-projects`
- 원격 Git 저장소는 연결되어 있지만 Vercel의 Git 자동 배포는 연결되어 있지 않습니다. Git push만으로 운영 사이트가 바뀌지는 않습니다.

최신 버전은 역사관 62개 시점과 한경직목사기념관 29개 시점을 포함합니다. 옛 복원본에 있던 가상 E방은 제거되었습니다. 벽면 접근, 두 손가락 확대를 이용한 시선 방향 이동, 확대 화면의 페이지·주소 동기화와 공통 사운드가 포함됩니다.

## 저장 위치

| 위치 | 용도 |
| --- | --- |
| 이 `museum-web` 폴더 | 소스 편집, Git 기록, 작업 문서 |
| `G:\내 드라이브\영락역사관\museum-workspace\source` | 명령이 자동으로 동기화하는 실행·검증용 사본 |
| 위 폴더의 `public` | 매니페스트로 검증한 공개 관람 자산 |
| 위 폴더의 `dist` | 빌드한 HTML·JS·CSS. 관람 자산은 중복 저장하지 않음 |
| `G:\내 드라이브\영락역사관\museum-workspace\toolchain` | 이 작업용 Node.js, npm, Vercel CLI |
| `G:\내 드라이브\영락역사관\museum-workspace\npm-cache` | 실행 도구용 다운로드 캐시 |
| `G:\내 드라이브\영락역사관\museum-workspace\logs` | 설치·검증 기록 |

명령은 `museum-web`의 위치를 기준으로 형제 폴더 `../museum-workspace`를 찾습니다. **`museum-workspace/source`의 코드를 직접 편집하지 마세요.** 다음 동기화 때 `museum-web`의 소스가 기준이 됩니다. 일상 수정·실행·빌드·배포에 E드라이브를 사용하지 않습니다.

사진·파노라마·음원 등 공개 관람 자산은 매니페스트 기준 66,557개, 약 3.36GB입니다. 자산 복원용 ZIP 38개를 별도로 계속 보관하지 않아도 됩니다. 필요한 자산이 없거나 손상되면 매니페스트의 공개 URL에서 ZIP을 내려받아 검증 후 복원합니다. 최초 복원 및 손상 복구에는 인터넷 연결이 필요합니다.

자산은 `source/public`에 한 벌만 보관합니다. 로컬 빌드는 자산을 `dist`에 다시 복사하지 않고, 미리보기에서 같은 `public`을 읽습니다. **`dist`는 관람 자산을 포함한 독립 배포 묶음이 아닙니다.**

Google Drive에서 직접 `npm ci`를 실행할 때 파일 쓰기 오류가 발생하여, 작업 도구는 OS의 고유 임시 폴더에서 의존성을 설치한 뒤 닫힌 파일을 G로 복사합니다. 설치용 임시 폴더와 캐시는 작업 후 정리하며, 최종 `node_modules`와 실행 도구는 G에 둡니다. 따라서 E드라이브는 필요 없지만 설치 중 임시 C 공간은 사용합니다. 사용자별 Vercel 로그인 정보도 Windows 사용자 프로필에 유지하며 G의 프로젝트 폴더에 복사하지 않습니다.

## G드라이브 용량 표시와 클라우드 5TB

Google Drive의 **5TB는 클라우드 저장 할당량**입니다. Windows에 표시되는 G는 스트리밍 가상 드라이브여서, 파일을 쓰거나 읽는 동안 이 컴퓨터의 로컬 캐시를 사용합니다. G의 사용 가능 공간 표시는 캐시가 있는 로컬 드라이브의 여유 공간에 제한될 수 있습니다. 이 컴퓨터에서는 C의 캐시 공간과 관계가 있으며, 클라우드 5TB가 C의 여유 공간을 늘려 주지는 않습니다. [Google Drive 캐시 설명](https://support.google.com/drive/answer/13470231?hl=en)

현재 F드라이브는 USB 연결의 exFAT 볼륨으로 확인되었습니다. Google Drive는 Windows 콘텐츠 캐시 위치로 NTFS를 지원하므로 이번 작업에서 F로 캐시를 옮기거나 포맷하지 않았으며, Drive 설정도 변경하지 않았습니다. [지원 파일 시스템 안내](https://knowledge.workspace.google.com/admin/drive/advanced-drive-for-desktop-configuration?hl=en)

## 자주 쓰는 명령

PowerShell에서 이 폴더로 이동합니다.

```powershell
cd 'G:\내 드라이브\영락역사관\museum-web'
.\museum.ps1 check
.\museum.ps1 dev
```

개발 서버는 `http://127.0.0.1:5173/`입니다. 기념관은 같은 주소 뒤에 `/hkjmuseum.html`을 붙입니다. 종료는 `Ctrl+C`입니다. 실행 중 소스 변경은 자동으로 실행 폴더에 동기화됩니다. 의존성이나 실행 설정을 바꿨다면 서버를 종료하고 `setup` 후 다시 시작하세요.

`dev`는 매니페스트 파일의 SHA-256과 현재 두 관의 카탈로그가 이전 성공 기록과 일치하면 검증된 자산을 재사용합니다. 공개 자산 폴더와 링크 경로는 다시 확인합니다. 기록이 없거나 매니페스트가 바뀌었거나 자산 폴더가 없으면 전체 검사·복원을 실행합니다. `setup`, `build`, `preview`, 두 배포 명령은 이 재사용 기록으로 검사를 생략하지 않고 모든 자산의 크기와 SHA-256을 다시 확인합니다.

전체 검사는 최대 32개 파일을 동시에 처리하고 읽기 중인 파일 버퍼 합계를 128MiB 이내로 제한합니다. 이 수치는 프로그램 전체 메모리 상한은 아닙니다. 파일 처리용 `UV_THREADPOOL_SIZE` 설정은 해당 명령의 자식 프로세스에만 적용한 뒤 복원합니다.

**다른 창에서 `test`, `build`, `preview`, `deploy-preview`, `deploy-production`을 실행하기 전에 개발 서버 창에서 `Ctrl+C`로 `dev`를 종료하세요.** `preview` 실행 중에도 먼저 종료해야 다른 명령을 사용할 수 있습니다. 모든 `museum.ps1` 명령은 실행이 끝날 때까지 같은 Windows 잠금을 잡습니다. 이미 실행 중이라는 오류가 나오면 해당 명령이 끝날 때까지 기다리거나 실행 중인 창에서 `Ctrl+C`를 누른 뒤 다시 실행하세요. 명령이 완료되거나 오류로 끝나면 잠금이 해제되므로 PID·잠금 파일을 직접 지울 필요가 없습니다. 이 컴퓨터에서는 `tools/local-workspace.mjs`를 Node로 직접 실행하지 말고 `museum.ps1`을 사용하세요.

```powershell
.\museum.ps1 setup    # 잠금 파일 기준 의존성 설치와 관람 자산 복원/검사
.\museum.ps1 test     # 기존 기능 및 로컬 작업 도구 검사
.\museum.ps1 build    # 관람 자산 검사, TypeScript 검사, 자산 중복 없는 로컬 빌드
.\museum.ps1 preview  # 빌드 결과 확인: http://127.0.0.1:4173/
```

`build`는 66,557개 자산을 모두 검사하되 빌드 출력에 중복 복사하지 않습니다. 미리보기는 반드시 `museum.ps1 preview`로 실행하세요. 이 명령은 빌드한 화면 코드와 기존 `public`의 사진·파노라마를 함께 제공합니다. 표준 `npm run build`는 이 로컬 절약 방식을 사용하지 않고 자산을 다시 복사하므로, 이 컴퓨터의 평소 작업에는 위의 `museum.ps1` 명령을 사용하세요. 실행 시간은 디스크와 Google Drive 상태에 따라 달라집니다.

Windows에서 스크립트 실행이 차단되면 시스템 설정을 바꾸지 않고 해당 실행에만 다음과 같이 지정할 수 있습니다.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\museum.ps1 check
```

## Vercel에 반영하기

브라우저 로그인과 CLI 로그인은 별개입니다. `check` 결과에서 CLI 로그인이 필요하다고 나오면 다음 명령으로 본인 계정의 로그인을 완료합니다.

```powershell
.\museum.ps1 login
.\museum.ps1 check
.\museum.ps1 deploy-preview
```

미리보기에서 역사관·기념관, 공간 이동, 사진·전시 확대, 음성·영상과 모바일 화면을 확인한 뒤 운영 반영 명령을 실행합니다.

```powershell
.\museum.ps1 deploy-production
```

`deploy-production`은 실제 공개 사이트를 갱신합니다. `setup`, `test`, `build`, `dev`, `preview`, `check`는 사이트를 배포하지 않습니다. 이번 환경 정리 자체로 운영 사이트를 변경할 필요는 없습니다.

두 배포 명령은 소스를 Vercel에 올리고, Vercel 서버에서는 기존 `build:vercel` 절차로 관람 자산을 복원한 뒤 전체 사이트를 빌드합니다. 로컬의 작은 `dist`만 업로드하는 방식이 아니며, 서버의 자산 검증과 전체 빌드는 그대로 유지합니다.

## 무엇을 수정할지

| 변경 | 주요 파일 |
| --- | --- |
| 첫 진입, 역사관과 기념관 왕복 | `src/main.ts`, `src/museum-route.ts` |
| 메뉴·화면·전시 선택 | `src/full-main.ts` |
| 색상·배치 | `src/full-style.css`, `src/full-content.css` |
| 파노라마·패널·핫스팟 | `src/full-viewer.ts` |
| 자료 확대·기사·영상·유물 | `src/full-content.ts` |
| 전시 목록·내용·연결 | `src/data/full-museum.json`, `src/data/memorial-museum.json` |
| 검토된 전시 제목 | `src/data/content-titles.json` |
| 벽면 접근·손가락 확대 이동 | `src/wall-approach*.ts`, `src/pinch-*.ts` 및 같은 이름의 데이터 |

자산 복원 스크립트는 두 관의 데이터와 `deployment-assets.json`에 기록된 해시를 대조합니다. **전시 JSON을 바꾸면 해당 해시와 자산 연결도 검토해야 합니다.** 그림·음원·동영상을 교체할 때는 파일만 바꾸지 말고 자산 아카이브와 매니페스트를 함께 갱신하고 검사하세요. 검사 실패를 건너뛰는 방식으로 배포하지 않습니다.

## 업체 원본과의 관계

`http://youngnakdhm.net/`과 `E:\CodexBackups\youngnakdhm-2026-10-12`는 외주 업체 krpano 사이트의 비교 기준입니다. Vercel 편집 소스는 이 저장소의 Photo Sphere Viewer 구현입니다. 백업 ZIP에는 운영 설정과 비공개 관리 자료도 포함되므로 통째로 `public`에 복사하지 않습니다. 상세 근거는 [업체 원본 기록](docs/workspace/vendor-baseline.md)에 있습니다.

이 업체 백업은 G 실행 환경의 필수 입력이 아닙니다. 기존 `tools` 안의 일부 과거 조사·가공 스크립트에도 E 경로가 남아 있지만, 위의 `museum.ps1` 일상 명령에서는 호출하지 않습니다.

## 백업과 Google Drive 동기화

프로그램 소스와 관람 자산을 함께 보존하려면 **`museum-web`과 `museum-workspace` 두 폴더를 함께 백업**하세요. `museum-web`만 복사하면 대용량 관람 자산과 실행 도구가 빠집니다. Git 저장소도 관람 자산 전체를 포함하는 백업과는 다릅니다.

G드라이브에서 파일이 보인다고 클라우드 업로드까지 끝난 것은 아닙니다. Google Drive에서 두 폴더의 동기화 완료를 확인하세요. 인터넷 없이도 로컬 작업을 하려면 두 폴더를 오프라인 사용 가능으로 지정하고 다운로드가 끝났는지 확인해야 합니다. 배포와 로그인 확인, 필요한 의존성·자산의 추가 다운로드에는 인터넷이 필요합니다.

## 다른 컴퓨터에서

Windows에서는 두 폴더를 같은 상위 폴더의 형제 구조로 유지합니다. Vercel 로그인은 사용자별이므로 다른 컴퓨터에서 `check` 후 필요하면 `login`을 실행하세요. 기존 실행 사본의 등록 정보는 편집 원본의 절대 경로도 확인하므로, 복사 과정에서 원본 경로가 바뀌면 실행 사본의 등록을 다시 정리해야 할 수 있습니다.

실행 도구까지 복사하지 않는 새 환경에서는 Node.js 22.12 이상과 npm을 준비한 뒤 원래의 표준 절차(`npm ci`, `node scripts/restore-deploy-assets.mjs`, `npm run dev`)를 사용할 수 있습니다. 공개 자산 아카이브를 내려받는 데 별도 토큰은 필요하지 않습니다. 설치·자산·빌드 출력을 합쳐 충분한 디스크 여유 공간을 확보하세요.

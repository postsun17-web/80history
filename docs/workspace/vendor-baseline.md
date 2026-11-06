# 업체 운영본 참고 기준

확인일: 2026-10-25. 이 문서는 업체 백업을 읽기 전용으로 조사한 결과다. 원본 파일은 수정하지 않았고, ZIP 전체 추출이나 비밀번호·인증 설정 내용 열람은 하지 않았다.

## 현재 개발 기준과 자료의 역할

현재 개발 기준은 GitHub [`postsun17-web/80history`](https://github.com/postsun17-web/80history)의 `main` 커밋 `bdeb3d2`에서 복구한 최신 Vercel 소스다. 런타임 버전은 `c6eb8f2f`이며, 역사관 62개 장면과 기념관 29개 장면을 포함하고 E 확장 전시실은 제거된 상태다. 아래의 옛 `psv-museum-full` 설명과 수치를 현재 구현의 기준으로 사용하지 않는다.

| 자료 | 역할 |
| --- | --- |
| 업체 사이트 `http://youngnakdhm.net/` | 업체 운영 화면과 동작을 비교하는 외부 기준 |
| `E:\CodexBackups\youngnakdhm-2026-10-12` | 2026-10-12 업체 운영본의 보존 스냅샷과 후속 조사 자료 |
| `G:\내 드라이브\영락역사관`의 납품 ZIP·XML | 전시 구조, 본문, 연결 관계를 해석하는 원문 자료 |
| `G:\내 드라이브\영락역사관\psv-museum-full` | 과거 Photo Sphere Viewer 복원 구현 및 조사 기록; 최신 개발 소스가 아님 |
| `G:\내 드라이브\영락역사관\museum-web` | 최신 복구 소스를 기준으로 작업하는 현재 저장소 |

## 백업의 날짜와 검증 범위

`verified_summary.json`에는 다음과 같이 기록되어 있다.

- 캡처 시작: 2026-10-12 13:54:16 KST, 검증 완료: 같은 날 15:26:36 KST.
- 보존 파일: `youngnakdhm_업체운영본_2026-10-12.zip`.
- ZIP 크기: 6,014,945,260바이트. 원본 155,528개 파일, 23,870개 디렉터리.
- 다운로드 실패 0건, 전체 파일 해시 검증 성공.
- 캡처 범위: `html`, `.webalizer`, `.htpasswd`.

이번 조사에서는 위 **검증 기록을 읽고**, ZIP의 목록과 선택한 공개 HTML·XML·JS를 직접 확인했다. 6GB ZIP 전체의 SHA-256이나 모든 내부 파일을 독립적으로 다시 검증한 것은 아니다. 이 백업의 시점은 10월 12일이며 현재 업체 사이트와 모든 파일이 동일하다고 단정하지 않는다.

`changes_during_backup.json`의 변경 9개 경로는 모두 `.webalizer` 방문 통계에 속한다. `chatbot_audit_2026-10-16`과 `cost_review_2026-10-16`은 이후의 조사 결과이므로 10월 12일 운영 파일과 구분한다.

## 업체 사이트의 파일 구성

ZIP 내부의 `html/`이 웹 루트다. `html/index.html`은 `tour.js`와 `tour.xml`을 불러오는 krpano 진입 화면이다.

| ZIP 내부 경로 | 용도 |
| --- | --- |
| `html/front/` | 입구 화면 |
| `html/tour.xml`, `action.xml`, `pannel.xml`, `list_*_action.xml` | 공간, 패널, 전시 연결 및 화면 동작 |
| `html/html/` | 기사와 상세 설명 HTML 및 관련 이미지·스타일 |
| `html/panos/` | 공간 파노라마 타일 |
| `html/photo/` | 사진 갤러리와 타일 |
| `html/images/`, `img/`, `floorplan_SM/`, `info/` | 전시 이미지, 안내, 평면도 등 |
| `html/ovr/`, `object_hotspot/`, `mov/`, `mp3/` | 회전 유물, 핫스폿, 영상, 음성 등 |
| `html/plugins/`, `skin/`, `usvrplugins/` | 원 krpano 실행기의 플러그인과 UI |

운영 백업에서 검사한 `tour.xml`, `action.xml`, `pannel.xml`, `list_a02_action.xml`, `list_a04_action.xml`은 krpano의 `<encrypted>` 형식이다. 반면 G:의 납품 폴더에 있는 `action.xml`, `pannel.xml`, `list_a04_action.xml`은 평문이다. 암호화된 운영 XML을 평문 XML 컴파일 입력으로 그대로 대체하면 안 된다. 모든 XML이 암호화된 것은 아니며 `front/tour.xml`, `hgj.xml`은 평문이었다.

느슨하게 풀린 납품 폴더의 `list_a02_action.xml` 등 일부 파일은 0바이트였다. 이런 파일만 보고 콘텐츠가 없다고 판정하지 말고 납품 ZIP과 검증된 텍스트 캐시를 함께 확인한다. `index.html`, `html/a02_01.html`, `html/c02_02.html`, `html/styles.css`의 네 샘플은 BOM과 개행을 정규화하면 납품 폴더와 운영 백업의 내용이 동일했다. 이는 선택 샘플의 결과이며 전체 자료 동일성을 뜻하지 않는다.

## 공개 배포에서 제외할 것

업체 백업은 전시 콘텐츠와 운영 자료를 함께 보존한다. **백업 디렉터리나 ZIP 전체를 `public/` 또는 공개 Vercel Blob에 넣지 않는다.** 현재 구현에서 필요한 공개 콘텐츠만 선택하고 경로와 해시를 검증하여 배포한다.

- 백업 ZIP·분할본, FTP·전달 스크립트, 운영 매니페스트와 조사 기록.
- `.htpasswd`, `.webalizer`, 방문 통계 원본과 인증 관련 README.
- `visit_config.php`, `visit_auth.php`, `visit_data.php` 등 방문 통계 관리 파일.
- `youngnak_cms.js`, `youngnak_cms.xml` 등 기존 관리 기능 코드와 모든 자격증명·환경변수.

원 krpano 실행기와 플러그인도 Photo Sphere Viewer 구현에 필요하다는 검증 없이 복사하지 않는다. 과거 `psv-museum-full`의 README와 자산 빌더는 납품 ZIP 및 `.cache/full-source`에서 공개 콘텐츠만 선택 변환하는 방식을 명시한다. 이는 자료 처리 방식의 참고이며 과거 배포 주소·장면 수·E 전시실 상태를 최신 구현으로 간주하는 근거가 아니다.

## 대소문자 충돌

`path_compatibility.json`에는 다음 두 파일이 **서로 다른 바이트와 해시를 가진 이미지**로 기록되어 있다.

- `html/html/photo/d04_11.jpg`
- `html/html/photo/d04_11.JPG`

일반적인 Windows 압축 해제에서는 이름이 충돌할 수 있다. ZIP 원본을 보존하고 정확한 대소문자로 선택해서 읽는다. 배포 자산으로 변환할 때도 두 파일을 임의로 덮어쓰거나 같은 파일로 취급하지 않는다.

## 근거 파일

- 백업 폴더: `verified_summary.json`, `changes_during_backup.json`, `path_compatibility.json`, `staging_cleanup_check.json`.
- ZIP에서 선택 확인: `html/index.html`, `html/front/index.html`, 관련 XML, `html/youngnak_cms.js`, 위 HTML·CSS 비교 샘플.
- 과거 구현 설명: `psv-museum-full/README.md`, `tools/compile_full_museum.py`, `tools/build_full_assets.py`, `tools/package_deploy_assets.py`.

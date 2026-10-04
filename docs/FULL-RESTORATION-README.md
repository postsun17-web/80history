# 영락교회 디지털역사관 전체 복원본

기존 Vercel 프로젝트 `youngnak-museum-poc`의 전체 전시 복원 소스다. krpano를 실행하지 않고 Photo Sphere Viewer와 명시적으로 해석한 원본 XML 데이터로 표시한다. 원본 A–D/로비/실외 공간과 승인된 C 오른쪽 E 확장 전시실을 포함한다.

## 실행 및 배포

Node.js 22 이상과 npm을 사용한다.

```powershell
npm ci
node scripts/restore-deploy-assets.mjs
npm run dev
```

큰 자산은 Git 대신 공개 Vercel Blob 아카이브에 보관한다. `deployment-assets.json`에 원본 카탈로그·아카이브·개별 파일의 SHA-256과 공개 다운로드 주소가 있다. 복원 스크립트는 해시와 상대 경로를 검사하며, 토큰 없이 내려받을 수 있다. `public/media/full/`은 생성 결과이므로 Git에서 제외된다. 기존 `public/media/v1/` 중 활성 C/E 자산도 같은 아카이브에 포함된다.

```powershell
npm test
python tools/test_compile_full_museum.py
npm run build:vercel
npx vercel deploy
```

Vercel은 `npm run build:vercel`을 실행한다. 업로드 소스는 약 2.8MB이며, 빌드 과정에서 약 770MiB의 활성 자산을 복원한다. `.vercelignore`는 media, 환경변수, 개발 도구/문서/캐시를 업로드에서 제외한다. 환경변수나 저장소 토큰을 커밋하지 않는다. `deployment-assets.json`의 URL에는 인증 토큰이 없다.

현재 Windows 작업본의 `public/media/full`은 `E:/CodexAssets/youngnak-full`을 가리키는 정션이다. 빌드·배포 스테이징은 `E:/CodexAssets/youngnak-full-deploy`에서 수행했다. Google Drive의 업체 원본은 변경하지 않았다.

## 자료 범위와 확인된 한계

- 원본 공간 62개와 E 공간 2개, 전시 페이지 207개.
- 사진 목록 598건 중 실제 이미지 578건, 원본 공백 20건. 관람안내 5건 별도.
- 기사 224건, 전자책 29권의 표지/원본 독서 링크, YouTube 영상 ID 55개.
- 기사 이미지 확대, 유물 회전, 음성·영상·PDF, 원본 전시 페이지 및 메뉴를 복원했다.
- 챗봇은 답변 서버를 연결하지 않은 시범 화면임을 표시한다.
- 외부 YouTube/전자책/Spinzam 서비스의 제공 상태는 외부 서비스에 의존하며 새 창 링크를 제공한다.
- 원본 공백 20건의 증거와 업체에 확인할 실제 사진 6건은 `SOURCE-DEFECTS.md` 및 `source-blank-evidence.json`에 기록했다.
- C02의 기존 전시 패널은 E 출입구를 가리지 않도록 오른쪽 벽에 축소 배치하고 자료 버튼도 함께 이동했다. 모든 8페이지는 하단 선택·크게 보기로 읽을 수 있다.

## 원본 재생성

`tools/compile_full_museum.py`, `tools/build_full_assets.py`, `tools/verify_full_museum.py`, `tools/package_deploy_assets.py`가 컴파일·변환·검증·패키징을 담당한다. 원본 ZIP 전체를 디스크에 풀지 않으며 공개 콘텐츠만 산출한다. CMS/관리자 코드와 자격증명은 배포 대상이 아니다. 컴파일러 재실행 시 원본 XML 텍스트 캐시가 필요하다. 이미 생성된 자료를 실행할 때는 위 아카이브 복원만으로 충분하다.

## GitHub

현재 저장소에 GitHub 원격 저장소가 연결되어 있지 않으며, GitHub 푸시는 수행하지 않았다. 배포는 Vercel CLI로 직접 수행한다.

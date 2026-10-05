# 확대 화면 화살표 겹침 배치

2026-10-05, 기준 main `6432f4b`. 모바일 수정 계획에 이어 사용자가 PC에도 같은 적용을 요청했다.

## 변경

- 공통 이미지 확대 영역의 PC 60px / 모바일 48px 좌우 여백을 제거했다.
- 이전·다음 버튼은 44×44px 원형으로 이미지 위에 배치한다. 어두운 배경의 불투명도는 기본·호버 48%, 누를 때 65%이며 흰 화살표를 사용한다.
- 안전 영역, 비활성 상태, 키보드 포커스와 버튼 밖 드래그·핀치를 유지한다.
- OpenSeadragon 전체 보기 계산, 제목·주소·페이지·3D 동기화와 사운드 코드는 변경하지 않았다. 높이에 제한되는 사진은 전체 표시를 위해 좌우 여백이 남는다.

## 검증

- 기존 자동 테스트 95개, TypeScript 검사, Vite 프로덕션 빌드 통과. 기존 번들 크기 및 동적 import 경고는 유지된다.
- 실제 Chrome의 표시 영역: 모바일 390px에서 294→390px, PC 1280px에서 1078→1198px. 360·640·844px에서도 화살표용 여백 0px 및 44×44px 버튼 확인.
- D02 3/5, D01 2/9, 세로 사진 a03 19/20, 관람 안내 1/5, 본문 d04_04 사진 1/2의 초기 실제 viewport 경계가 전체 이미지 경계를 포함하는지 검사했다.
- D02 이전·다음·닫은 뒤 외부 page3 일치, D01 첫/마지막 버튼 비활성, 확대 및 전체 보기 복귀 확인.
- Chrome 터치 에뮬레이션에서 두 손가락 확대 약 2배와 드래그 이동 확인. 버튼 이외 중앙 영역의 포인터 대상은 이미지 Canvas이다.
- 독립 코드 리뷰에서 수정 필요 항목 없음. 물리적인 iPhone/Android 검증은 수행하지 못했다.

캡처 및 브라우저 기록: `E:/CodexAssets/youngnak-visitor-qa/output/playwright/`

- 수정 전: `mobile-overlay-before.png`, `mobile-overlay-desktop-before.png`
- 수정 후: `overlay-D02-initial.png`, `overlay-desktop-initial.png`, `overlay-portrait-initial.png`
- 공유 확대 경로 검사: `overlay-shared-viewers.log`

## 공개 반영

미리보기 검증 후 GitHub main 및 기존 Vercel 공개 주소에 반영 완료했다. 별도 이동 편의 기능 브랜치는 포함하지 않았다.

첫 미리보기에서 기존 Blob 보관소가 HTTP 403 `Your store is blocked`를 반환하여 자산 복원이 실패했다. 역사관 ZIP 10개(809,845,371 bytes)를 기념관에서 사용하는 같은 GitHub 릴리스 `museum-assets-20261005`에 추가하고 manifest의 URL 10개만 변경했다. 각 ZIP의 로컬 SHA, 업로드된 API 크기·digest와 익명 전체 다운로드 SHA가 모두 일치한다. 총 38개 ZIP 및 내부 파일의 기존 해시·연결은 그대로다. 런타임 이미지는 계속 Vercel의 동일 경로에서 제공한다.

이관 증거: `E:/CodexAssets/youngnak-visitor-qa/history-github-assets-verification.json`.

- UI 구현 커밋 `9e7d802`, 자산 보관 경로 복구 커밋 `5b2ef4f`를 GitHub `postsun17-web/80history` main에 fast-forward 반영했다.
- 검증 미리보기: `https://youngnak-museum-aq0qyr7x3-postsun17-webs-projects.vercel.app` (`dpl_5oFzSgXnyeSEQBEzz5oJC8TBsiAH`).
- 공개 배포: `dpl_5noMujD2QdF7CemGwTjag6cT3rN1`, `https://youngnak-museum-eoaqdl136-postsun17-webs-projects.vercel.app`.
- 기존 주소 `https://youngnak-museum-poc.vercel.app/`에서 PC·모바일 세로·가로 모두 44×44px 반투명 버튼, 전체 표시 영역, D02 3→4→3 및 닫은 뒤 page3 일치를 확인했다. 페이지 오류 및 미디어 HTTP 실패 없음.
- 익명 요청으로 역사관·기념관·예시 이미지 HTTP 200 확인. 공개 JS/CSS는 검증 미리보기와 동일한 `index-BtJmcuO6.js` / `index-PZx63bka.css`이다.
- 최종 캡처: `overlay-production-desktop.png`, `overlay-production-mobile.png`, `overlay-production-landscape.png`. 결과 기록: `overlay-preview-smoke.log`, `overlay-production-smoke.log` (위 브라우저 증거 폴더).

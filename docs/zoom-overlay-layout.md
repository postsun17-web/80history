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

미리보기 검증 후 GitHub main 및 기존 Vercel 공개 주소에 반영한다. 별도 이동 편의 기능 브랜치는 포함하지 않는다.

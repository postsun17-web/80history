# 목적지가 보이는 3D 이동 화살표

## 범위

- 역사관 188개, 한경직목사기념관 67개 유효 이동 연결의 공통 표시만 변경.
- 원본 장면 데이터, 좌표, 목적지, 도착 시선 처리, 지도, 전시 페이지 및 확대 화면은 변경하지 않음.
- 44×44px 원형 버튼, 흰 화살표, 반투명 배경. 별도 절대 위치 이름표는 최대 두 줄이며 포인터 이벤트를 받지 않음.
- 전체 목적지명은 접근성 이름과 상단 툴팁에 제공. Enter/Space 자동 반복 입력은 무시.

## 로컬 검증

- 기존 자동 테스트 95개 통과. 독립 코드 리뷰에서 차단 사항 없음.
- 로비 및 A/B/C/D/기념관 입구에서 이름과 실제 목적지 일치 확인.
- 브라우저 실측 버튼 44×44px. 마커 좌표를 카메라 중앙에 맞춘 여섯 장면 모두 버튼 중심 (640, 450) 확인.
- 클릭, Enter, Space, CDP 터치 탭: 각각 history.pushState 한 번. 반복 keydown은 이동하지 않음.
- 이름표의 hit test는 PSV canvas에 도달. 이름표 위 터치 드래그로 약 7.89도 회전하고 같은 장면 유지.
- 두 손가락 터치 확대, 반투명 hover/active, 전체 제목 툴팁 확인.
- 390×844, 844×390, 1280×900에서 대표 장면과 긴 이름 확인. 모바일은 Chromium 터치 에뮬레이션으로 검증했으며 실기기 검증은 아님.
- 안내데스크 장면의 원본 중복 이동 지점 두 개(동일 목적지, 약 3.21도 간격)는 기존 좌표 유지 조건에 따라 그대로 보존. 회전 시 기존 지도·자료 UI 뒤로 가는 마커의 기존 가림 동작도 유지.

## 캡처

로컬 증거: `E:/CodexAssets/youngnak-visitor-qa/output/playwright/movement-*.png`

- 수정 전: `movement-before-desktop.png`
- 로비·A–D·기념관 PC: `movement-{lobby,a,b,c,d,memorial}-desktop.png`
- 긴 이름, 기념관 입구 및 실내의 세로·가로: `movement-{long,memorial-entrance,memorial-interior}-{390,844}.png`
- 이름표 터치 드래그: `movement-label-touch-drag.png`

배포 결과는 검증 후 아래에 기록.

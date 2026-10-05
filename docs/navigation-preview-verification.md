# 최소 3D 이동 편의 기능 미리보기

공개 운영 주소에는 원본 방 구조 복원만 반영했다. 이 문서의 이동 편의 기능은 `feat/3d-navigation-assist` 브랜치에서 별도로 검토하며, 사용자 확인 전 운영 주소에 배포하지 않는다.

## 사용 방법
- 기존 바닥 화살표의 작은 이름표에서 목적지를 확인하고 누른다. 드래그는 시선 변경으로 유지한다.
- 좌하단의 `이전 위치`를 누르면 이전에 있던 방, 전시 페이지, 바라보던 방향으로 돌아간다. 같은 방에서 전시 페이지나 자료 팝업만 바꾼 것은 이동 기록에 넣지 않는다. 기록은 현재 탭에서 최대50개이며 새로고침 시 초기화한다.
- 기존 안내도를 열면 로비·A·B·C·D 바로가기가 있다. 기존 메뉴와 동일한 전시 지점 및 시선으로 이동한다. 모바일에서는 안내도가 처음에 접혀 있다.

## 검증
- 데스크톱 화살표: 드래그는 이동하지 않음; 클릭·Enter·Space는 한 번만 이동.
- 모바일390×844: 안내도 열기→방 선택 두 단계, 새 이동 버튼44×44px 이상, 가로 넘침 없음.
- Chrome 터치 에뮬레이션: 화살표에서 손가락 드래그는 시선만 변경하고 탭은 공간 이동.
- C02 5페이지에서 드래그·자료 팝업 후 A실로 이동하고 복귀: 페이지와 실제 출발 시선이 정확히 일치.
- 로비·A–D 바로가기5개: 기존 메뉴의 목적지 및 도착 시선과 일치.
- 실패 주입: 이전 공간 이미지 로딩 실패 시 현재 방 복구 및 이동 기록 보존; 재시도 성공 시 원래5페이지로 복귀하고 기록을 한 번만 소비.
- 연속 요청: B실의6개 기초 이미지 요청을 지연하고 D실을 선택하면 최종 D실에 도착; 돌아가기 기록은 중간 B실을 건너뛰고 원래 로비로 복귀.
- 취소/실패된 파노라마 변경 후 원래 파노라마를 다시 로드해 잘못된 타일 설정·오류 표시·누락된 자료 버튼이 남지 않도록 회귀 검사.
- 원본 카탈로그와 배포 파일 목록은 복원 커밋14b0309와 동일.

실제 모바일 기기 대신 Chrome에서 화면 크기 및 터치를 에뮬레이션해 확인했다.

## 미리보기와 화면 비교
- 로컬 미리보기: http://127.0.0.1:4176/?startscene=scene_f-c-0&page=1&startlookat=0,10,100
- 공개 복원본: https://youngnak-museum-poc.vercel.app/?startscene=scene_f-c-0&page=1&startlookat=0,10,100
- 기존 화면: E:/CodexAssets/youngnak-visitor-qa/output/playwright/restoration-navigation-baseline.png
- 이동 편의 기능(PC): E:/CodexAssets/youngnak-visitor-qa/output/playwright/navigation-preview-desktop.png
- 이동 편의 기능(모바일): E:/CodexAssets/youngnak-visitor-qa/output/playwright/navigation-preview-mobile.png
- 모바일 안내도: E:/CodexAssets/youngnak-visitor-qa/output/playwright/navigation-preview-mobile-map.png

로컬 서버 종료 후에는 `C:/Users/user/Projects/youngnak-e-room`에서 `npm run dev -- --port 4176 --strictPort`로 다시 실행한다. 이 작업공간은 기존 전체 이미지가 연결된 상태다.

최종 검사: Node 테스트64/64, TypeScript 검사, UI 운영 빌드 및 독립 코드 리뷰 통과. 701~1280px의12가지 화면 폭에서 긴 전시 제목·페이지 조작부 사이 겹침이 없고, 미디어센터는390/701/844/1051/1280px에서 기존 영상 목록과 위치 버튼이 겹치지 않음을 확인했다.

UI 빌드: E:/CodexAssets/youngnak-navigation-preview-build (미디어 복사를 생략한 코드 빌드). 실제 관람 미리보기는 위 Vite 로컬 주소를 이용한다.

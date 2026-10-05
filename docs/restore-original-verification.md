# 2026-10-05 원본 방 구조 복원 검증

## 반영 범위
- 임의 E실 두 시점(scene_ext-e-entry, scene_ext-e-center)과 C실 합성 출입구를 제거했다.
- 업체 원본 scene_e-* 8개(로비·이벤트 공간)는 보존했다.
- 원본과 같은 62개 시점, 188개 직접 연결, 51개 안내도 지점, 207개 전시 페이지를 확인했다. 원본의 중복 연결 레코드도 보존한다.
- C02는 원본 벽면 사진, 전시판 각도/크기/클릭 위치, 8페이지를 복원했다. 안내도는 1733×2220 비율 및 원본 좌표로 복원했다.
- 이전 결손 자료 보강과 교회 상단 방향 보정(flipTopBottom)은 유지했다.
- 옛 E실 주소는 C02 1페이지, 시선 90,0,105로 정규화한다.

## 원본 근거
- 업체 사이트: http://youngnakdhm.net/?startscene=scene_c-s-e+1&startlookat=90,0,105
- 전달된 tour.xml, outside.xml, list_c02_action.xml, floorplan_SM/setting_FP.xml.
- C02 전시판: ath=90, atv=15.91, width=759.36, rx=16.7, edge=bottom.
- C02의 업체 원본 JPEG 타일 96개를 전달 ZIP 중앙 디렉터리의 크기·CRC와 대조해 일치 확인. 캐시 WebP와 비교한 최대 평균 채널 오차는 1.26663/255.

## 배포 자료
기존 9개 공유 아카이브를 바꾸지 않고 원본 C02 WebP 102개(934,266바이트)를 보충했다. 새 아카이브는 950,800바이트이며 업로드 후 다시 내려받아 SHA-256을 확인했다.

- 파일: assets-688143de0a2f2745cad9.zip
- SHA-256: 688143de0a2f2745cad973f649959d43fca460324fcd93faccb6a772194bcef1
- 전체 매니페스트: 10개 아카이브 / 8,130개 파일. 기존 9개 아카이브 메타데이터는 기준 fa87431과 동일하다.
- sourceDataSha256은 복원된 카탈로그에 맞춰 갱신했다.

## 확인 결과
- TypeScript/Node 테스트: 46/46 통과.
- Python 원본 컴파일·검증 테스트: 14/14 통과(구현 담당 실행).
- 전체 원본/자료 검사: 오류·누락 없음, 원본 62개 공간 도달 가능.
- TypeScript 검사 및 Vite 운영 빌드 통과.
- 배포 복원 스크립트: 8,130개 파일 무결성 검증 통과.
- 실제 브라우저: C02 8페이지 전환, 인접 C존 2 이동, 두 옛 E실 주소 정규화, raw + 주소, 51개 지도점 및 62개 공간 목록 확인.
- 애플리케이션·자료 로딩 오류 없음. 기존 favicon.ico 404는 이 복원 범위 밖이며 관람에는 영향이 없다.

## 화면 증거 (로컬 E 드라이브)
- E:/CodexAssets/youngnak-visitor-qa/output/playwright/vendor-c02-front-restoration-reference.png
- E:/CodexAssets/youngnak-visitor-qa/output/playwright/restored-c02-page1.png
- E:/CodexAssets/youngnak-visitor-qa/output/playwright/restored-c02-page8.png
- E:/CodexAssets/youngnak-visitor-qa/output/playwright/restored-c02-mobile.png

최소 이동 편의 기능은 후속 별도 브랜치와 로컬 미리보기에서 구현한다. 이 복원 배포에는 추가하지 않는다.

## 공개 배포 확인
2026-10-05 원본 복원 커밋 `14b0309`를 GitHub `postsun17-web/80history`의 `main` 및 `fix/restore-original-rooms`에 푸시했다.

- 기존 주소: https://youngnak-museum-poc.vercel.app/
- 배포 ID: dpl_FThN8fzNSX9WTiZKKUxvheMC4P26
- 빌드 진입 파일: /assets/index-hatQmsBJ.js
- 공개 주소의 C02 원본 파일 102개를 다시 다운로드해 모든 크기와 SHA-256 일치를 확인했다.
- 공개 주소에서도 C02 8페이지, 인접 이동, 옛 E 링크, raw + 주소, 지도51점/공간62개를 확인했다.
- 교회 지붕과 십자가가 보이는 첫 공간의 위쪽 시선 화면도 확인했다.
- 제거된 youngnak-museum-ux 주소는 HTTP404이다.

# 업체 원본 공간 복원 및 최소 이동 개선

승인: 2026-10-05 대화의 proposed_plan. 기준 fa87431. 사용자는 별도 UX 사이트 삭제, 임의 E실 제거, C실 업체 원상복구, 기존3D 안의 최소 이동 개선을 승인했다.

## 완료 조건
- UX Vercel 프로젝트 youngnak-museum-ux만 삭제. 원본프로젝트 youngnak-museum-poc 및 공유Blob자료 보존.
- 원본62촬영지점/188직접연결/51지도점/207전시페이지. scene_ext-e-entry/center 제거; 원본scene_e-* 로비/이벤트 보존.
- C02 원본 panorama 및 panel geometry/8페이지/클릭영역 복원. 원본지도1733x2220 및 x좌표복원. 교회극점방향 및결손보강보존.
- C원본102WebP 파일934266B 소형보충archive배포, 기존9archive불변, 카탈로그hash동기화. 원격102파일검증.
- 옛E링크는 C02 scene_c-s-e+1,page1,look90,0,105로정규화.
- 원상복구를기존공개주소에먼저반영. 이후 최소이동개선(화살표목적지/44px,이전위치scene-page-look복원,안내도로비A-D바로가기)을별도브랜치/로컬미리보기로구현. 추가이동UI는사용자확인전기존공개주소에반영하지않음.
- 이동개선은새첫화면/읽기/검색/큰하단바/자동관람을추가하지않음. 팝업/페이지변경은공간기록에서제외. 성공공간이동만기록;복귀실패시기록유지.
- 원사이트같은시선의C02캡처비교,인접이동/옛URL/자료/모바일회귀검증.

## 확인한 원본
http://youngnakdhm.net/ 실제C02: ath90,atv15.91,width759.36,rx16.7,edge bottom; source XML일치. C02화살표 spot1→scene_c-c-s-0,spot3→scene_c-c-s-1. 원본C사진은 E:/CodexAssets/youngnak-full/panos/scene_c-s-e+1 에존재.

원본출처 .cache/full-source/tour.xml,outside.xml,list_c02_action.xml,floorplan_SM/setting_FP.xml 및 G:/내 드라이브/영락역사관. 기존public/media/full은공유junction이므로재귀삭제하지않는다. E드라이브는junction불가. C여유부족으로빌드와배포staging은E사용.

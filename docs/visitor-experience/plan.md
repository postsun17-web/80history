# 영락교회 디지털역사관 UI·UX 및 성능 개선 Implementation Plan

> 구현 현황과 실제 검증 결과는 [최종 구현·검증 보고서](implementation.md)를 참고하세요. 이 문서는 제안 당시의 계획을 보존합니다. 사용자 지시에 따라 기존 원본 주소는 유지하고 개선본은 별도 프로젝트로 배포합니다.
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 처음 온 관람객이 PC·모바일에서 쉽게 입장하고, 길을 찾고, 내용을 읽고, 원래 위치로 돌아오는 관람 경험을 만든다.

**Architecture:** Photo Sphere Viewer와 OpenSeadragon을 유지한다. 공간 관람과 글·사진 관람이 같은 전시 연결 데이터·URL을 사용하도록 연결하고, 화면·데이터·고해상도 자료를 필요한 시점에 로딩한다. 기존 소스를 전면 교체하지 않고 독립적으로 확인 가능한 4단계로 나눈다.

**Tech Stack:** 기존 TypeScript, Vite, Photo Sphere Viewer 5.15.1, OpenSeadragon, Vercel, 공개 Blob 자산. Node.js 22.12 이상.

**Spec:** [관람 편의·성능 개선 설계안](design.md)

**상태:** 2026-10-04 제안 플랜. 현재 공개 사이트와 GitHub 제품 코드는 변경하지 않았다. 구현 전 아래 제안 우선순위와 화면 규칙을 기준으로 해당 단계의 작업 범위를 확정한다.

## 먼저 적용할 추천 묶음

**한 번에 입장 + 큰 모바일 버튼 + 현재 위치/다음 전시 + 자료 보기 + 읽던 곳으로 복귀.**

원사이트 복원본을 유지하면서 관람객이 직접 느낄 수 있는 변화부터 적용한다. 이후 편한 읽기·검색을 확장하고 성능을 다듬는다. 읽기 모드의 기반과 WebGL 실패 대안은 초기에 설계하여 나중에 다시 뜯어고치지 않도록 한다.

## Global Constraints

- 기존 64개 공간, 207개 전시 페이지, 자료, C–E 이동, 교회 상단 방향 보정을 보존한다.
- 기존 startscene/page/startlookat/exhibit URL을 계속 연다. 새 기능의 URL 매개변수는 선택사항으로 추가한다.
- 주요 터치 영역 최소 44×44 CSS px. 본문 글자 18/21/24px, 행간 1.7, 문장 폭 최대 68ch.
- 360×800, 390×844, 768×1024, 1440×900와 휴대폰 가로 화면을 확인한다.
- 회원가입 없이 모든 핵심 관람을 제공한다. 이어보기·북마크·설정은 기기 저장부터 시작한다.
- 원본 내용과 새로운 탐색용 제목·분류를 구분한다. 기존 파일명·역사 자료를 근거 없이 수정하지 않는다.
- 모든 기존 HTML이 정확히 한 전시 페이지와 연결된다고 가정하지 않는다. 이미지 전용 글의 추출은 일부부터 검수한다.
- 코드의 기존 이미지/뷰어 정리, 모달 Escape·포커스 복귀, 브라우저 이력을 유지한다.
- 전체 770MiB 자료의 일괄 선로딩·일괄 오프라인 저장은 하지 않는다.
- 현재 테스트 사이트의 검색 제외는 유지한다. 정식 공개를 결정한 단계에서만 검색 노출을 변경한다.
- 비용·인력 추정은 개발자 1명 기준의 작업 규모이며 확정 견적이 아니다. 콘텐츠 교정량과 실제 기기 검사에 따라 달라진다.

## Review Focus

1. 직접 공유 링크·과거 URL·잘못된 저장 위치: 가능한 현재 전시로 열고 방문자를 빈 화면에 남기지 않는다.
2. 자료 → 사진 확대 → 뒤로가기: 설명의 스크롤 위치와 원래 전시 시선이 유지된다.
3. 작은 화면·가로 화면·큰 글자·키보드: 닫기·이동·자료 버튼이 접근 가능하다.
4. 빠른 연속 이동·느린 이미지·실패하는 외부 영상: 마지막 선택이 화면에 남고 다른 자료는 계속 볼 수 있다.
5. 새 배포·기기 저장 불가·WebGL 불가: 오래된 캐시나 localStorage 오류가 관람 진입 전체를 막지 않는다.

## 단계와 결과물

| 단계 | 결과물 | 대략적인 작업 규모 | 끝났다고 판단하는 기준 |
| --- | --- | --- | --- |
| 1. 입장·이동 편의 | 한 번에 입장, 모바일 도구 정리, 큰 버튼, 큰 방 목록, 명확한 복귀 | 3~5일 | 초보자가 첫 전시를 열고 자료를 본 뒤 돌아옴 |
| 2. 읽기·찾기 | 편한 읽기, 자료 카드, 제목 정리, 기본 검색 | 5~10일 | A실·C실 대표 자료에서 검증 후 전체 자료로 확대 |
| 3. 속도·안정성 | 모듈 분할, 사진 미리보기, 자동 화질, 캐시, 실패 대안 | 3~6일 | 같은 조건의 전후 측정에서 개선되고 원본 기능 회귀 없음 |
| 4. 관람 완성도 | 이어보기, 공유, 소수 추천 코스, 공개 준비 | 2~4일 | 실제 관람객 테스트 후 불필요한 기능을 덜어낸 상태 |

합계 약 13~25개 작업일이 초기 추정이다. 각 단계는 독립 배포 가능하며, 1단계만 먼저 적용해도 입장과 모바일 조작의 개선을 확인할 수 있다. 역사 콘텐츠 교정·자막 제작·모든 이미지의 문자화는 별도 범위다.

## 소스와 데이터 역할

기준 소스 폴더: C:/Users/user/Projects/youngnak-e-room

| 작업 대상 | 역할 |
| --- | --- |
| src/full-main.ts, src/full-style.css | 입장, 모바일 도구, 현재 위치, 전시/자료 패널 |
| src/full-content.ts, src/full-content.css | 본문·사진·영상, 글자 크기, 자료 내부 복귀 |
| src/full-navigation.ts, tests/full-navigation.test.ts | 기존 URL 호환, mode 파라미터, 공유·이어보기 |
| src/full-viewer.ts | 시점·타일 화질·마커 준비·이동 취소/무효화 |
| 신규 src/visitor-catalog.ts | 공간/페이지/자료의 표시용 연결 모델 |
| 신규 src/visitor-reader.ts | WebGL 없이 동작하는 읽기 화면 |
| 신규 src/visitor-search.ts | 정적 검색과 결과 정렬 |
| 신규 src/visitor-preferences.ts | 글자·화질·최근 위치·북마크 |
| 신규 tools/build_visitor_catalog.py | 기존 HTML에서 제목·본문·검색 자료를 추출하고 연결 검사 |
| tools/build_full_assets.py, tools/package_deploy_assets.py | 미리보기·중간 화질·자산 해시 생성 |
| scripts/restore-deploy-assets.mjs, deployment-assets.json, vercel.json | 자산 검증·복원·캐시 정책 |

신규 모듈은 각 단계에서 실제 필요할 때 만든다. 초기 화면 정리만을 위해 전체 파일을 동시에 분해하지 않는다.

## Task 1: 기준 측정과 입장·모바일 도구 정리

**Files:** full-main.ts, full-style.css, full-viewer.ts; 신규 tests/visitor-entry.test.ts.
**Interfaces:** 기존 perform(SourceAction), navigate(FullRoute) 경로를 재사용한다. 새로운 입장 동작은 한 번의 사용자 요청만 수락하고, 직접 전시 링크에는 입장 안내를 강제하지 않는다.

- [ ] 현재 배포를 기준으로 입장→로비→A실 설명→사진 확대→복귀→C실→E실 동선을 기록한다. 실제 첫 접속 전송량/관람 가능 시간/사진 표시 시간을 측정한다.
- [ ] 입장 버튼이 안내만 닫는 현재 동작을 보여주는 검사와, 연속 두 번 누를 때 중복 이동하지 않는 회귀 검사를 만든다.
- [ ] '관람 시작'을 실제 로비 입장과 연결한다. 외관 감상, 연출 건너뛰기, 동작 줄이기를 반영한다.
- [ ] 모바일 주요 도구를 전시실/자료 보기/더보기로 정리한다. 검색 탭은 Task 4가 완료되면 추가한다. 현재 도움말은 더보기에서 항상 찾을 수 있게 한다.
- [ ] 주요 버튼을 최소 44px로 만들고, 기기 하단 안전영역·가로 방향·큰 글자 상태를 확인한다.
- [ ] 입장 안내·도구 패널의 포커스 이동/복귀와 키보드 동작을 확인한다. 기존 대화상자 동작을 훼손하지 않는다.
- [ ] npm test와 npm run build:vercel을 통과시키고 Preview에서 직접 링크 및 실제 입장을 검증한다. 이 단계만 묶어 커밋한다.

**완료:** 입장 버튼 1회로 로비에 도달. 좁은 화면에서도 자료·전시실·닫기를 누를 수 있음.

## Task 2: 큰 전시실 선택과 다음 행동 연결

**Files:** full-main.ts, full-style.css, 신규 visitor-catalog.ts; 신규 tests/visitor-catalog.test.ts.
**Interfaces:** VisitorEntry={id,title,scene,page,kind,sourceAction}; getRoomEntries(roomId:string):VisitorEntry[], getAdjacentExhibit(entryId:string,direction:'previous'|'next'):VisitorEntry|null. 목록 순서는 검수한 전시 순서이며 JSON 파일 순서로 추정하지 않는다.

- [ ] 기존 메뉴/페이지/핫스폿으로 목록을 만들고 표시용 제목·연결 정보를 분리한다. E실은 확장 공간으로 분류한다.
- [ ] 임의의 중간 전시에서 로비·다른 방에 선택 2회 이내로 도달하는 동선을 검사한다.
- [ ] 지도와 별도로 로비/A/B/C/D/E/외부의 큰 목록을 제공한다. 현재 위치·전시 제목·페이지 수를 함께 표시한다.
- [ ] 전시 페이지 넘기기, 다음 주제로 이동, 실제 방 이동을 서로 다른 문구로 표시한다.
- [ ] '이 공간의 자료'를 제목·유형·작은 이미지가 있는 목록으로 개선하고, 같은 핫스폿 자료가 열리는지 대조한다.
- [ ] 메뉴 이동은 전시를 정면으로 보게 하고, 공간 화살표 이동은 기존 동선 방향을 유지한다.
- [ ] C–E 왕복, 모든 방 목록, 전시 마지막 페이지에서 다음 전시, 접근성 이름을 검증하고 커밋한다.

**완료:** 방문자가 현재 위치와 다음 행동을 이해하며, 기존 자료가 새 목록에서도 동일하게 열림.

## Task 3: 편한 읽기와 자료 내부 복귀

**Files:** full-main.ts, full-content.ts/css, full-navigation.ts, 신규 visitor-reader.ts, build_visitor_catalog.py; 신규 tests/visitor-reader.test.ts 및 기존 full-navigation.test.ts.
**Interfaces:** FullRoute에 선택적 mode?:'tour'|'read' 추가. 이전 URL은 tour로 해석한다. ReaderEntry={id,title,scene,page,articlePaths:string[],mediaActions:SourceAction[]}; read 모드는 FullViewer를 생성하지 않고 열릴 수 있다.

- [ ] 기존 URL 호환, tour/read 전환 후 scene/page/exhibit 보존, WebGL 비활성 상태의 읽기 진입을 검사한다.
- [ ] full-main.ts의 뷰어 생성 시점을 tour 진입으로 옮긴다. read에서는 파노라마 초기화에 실패해도 읽기가 열리는 경계를 만든다. 나머지 상세 모듈 분할은 Task 5에서 수행한다.
- [ ] A실과 C실의 대표 주제를 시범 연결한다. 기사 HTML을 우선 사용하고 연혁처럼 이미지에만 있는 설명은 필요한 범위를 원본과 대조해 정리한다.
- [ ] 본문·사진·음성·영상의 목록을 구성한다. 실제 자료가 없는 유형 버튼은 표시하지 않는다.
- [ ] 본문 글자 18/21/24px와 행간 1.7을 적용한다. 원본 전시판 이미지도 별도 열 수 있게 한다.
- [ ] 본문→사진 확대→본문 복귀에서 스크롤을 유지한다. '전시로'는 이전 공간·시선·페이지로 복귀한다.
- [ ] iframe 본문을 직접 화면으로 옮길 경우 허용한 HTML/URL만 출력하고 스크립트·원본 XML 명령을 실행하지 않는다.
- [ ] 대표 사례 검증 후 나머지 자료를 연결한다. 연결되지 않은 자료를 누락시키지 말고 자료 목록에서 접근 가능한 상태로 남긴다.
- [ ] 모바일, 키보드, 텍스트 확대, 과거 공유 링크를 검증하고 커밋한다.

**완료:** 확대 제스처 없이 대표 역사 설명을 읽고 정확한 위치로 돌아옴. WebGL 없이도 설명과 사진에 접근.

## Task 4: 정확한 검색과 읽기 데이터 정리

**Files:** build_visitor_catalog.py, visitor-catalog.ts, 신규 visitor-search.ts; 신규 tests/visitor-search.test.ts.
**Interfaces:** searchEntries(query:string,filters?:{room?:string;kind?:string}):SearchResult[], SearchResult={entryId,title,locationLabel,snippet,route}. 검색 인덱스는 검색 열기 시점에 준비한다.

- [ ] 제목·연대·인물·본문을 정적 인덱스로 만들고 중복 자료를 식별한다. 첫 문단을 잘라 만든 제목과 '자료 1' 같은 이름은 표시용 제목으로 보완한다.
- [ ] '한경직', '1950', '선교', 공백/빈 검색, 결과 없음, 같은 제목의 다른 전시를 검증한다.
- [ ] 검색 결과에 자료 유형·위치·짧은 발췌와 '자료 읽기 / 공간에서 보기'를 제공한다.
- [ ] 검색 창 열기·닫기·키보드 표시가 모바일 하단 도구와 충돌하지 않는지 확인한다.
- [ ] 기존 본문에 없는 설명·정답을 생성하지 않는다. 새 AI 서비스 없이 검색이 작동하도록 한다.
- [ ] 이 단계 완료 시 모바일 검색 탭을 노출하고 커밋한다.

**완료:** 대표 검색어에서 올바른 자료와 위치로 이동하고, 처음부터 360도를 조작할 필요가 없음.

## Task 5: 필요한 자료만 로딩하고 실패에서 복구

**Files:** full-main.ts, full-content.ts, full-viewer.ts, build_full_assets.py, package_deploy_assets.py, restore-deploy-assets.mjs, vercel.json; 기존 deploy-assets.test.ts와 신규 tests/visitor-loading.test.ts.
**Interfaces:** QualityMode='auto'|'high'|'economy'. 사용자 선택이 자동 판단보다 우선한다. 비동기 이동은 단조 증가하는 요청 식별자로 마지막 선택만 적용한다. 기존 자산 검증/주소 변환과 버전 경로를 함께 갱신한다.

- [ ] Task 1 기준 측정과 같은 조건에서 분석한다. 오래된 local dist를 현재 배포 번들로 취급하지 않는다.
- [ ] 읽기/검색/사진 확대 코드와 전시 상세 데이터를 분할하고, 첫 화면에 필요하지 않은 프로그램은 늦게 로딩한다.
- [ ] 큰 사진 10개부터 작은 미리보기와 확대용 파일을 시험한다. 최초 사진 전송량 50% 감소를 목표로 시각 품질과 요청 수를 비교한다.
- [ ] 360도 중간 화질을 추가하고 auto/high/economy를 제공한다. 선로딩은 다음 방 기본 이미지 1곳으로 제한하며 economy에서는 끈다.
- [ ] 음악 버튼을 누르기 전 BGM 요청이 없는지 확인한다.
- [ ] 자산 주소의 버전/해시를 먼저 적용한 뒤 장기 캐시를 켠다. 수정 후 새 그림 표시와 기존 배포 복구를 함께 검증한다.
- [ ] 빠른 3연속 이동, 보조 마커 한 개 지연, 사진 404, 파노라마 실패, WebGL 실패를 시험한다. 재시도·이전 공간·읽기 전환을 제공한다.
- [ ] 초기에 비해 JS 전송량 30% 감소를 목표로 측정하되, 읽기 진입과 장면 이동이 실제 빨라지는지도 확인한다.
- [ ] 저장 공간·배포 다운로드·관람 전송량·요청 수를 보고한다. npm test, 자산 해시 검사, TypeScript/Vite 빌드와 실제 휴대폰 관람을 통과한 변경만 커밋한다.

**완료:** 느린 환경에서도 조작과 읽기를 계속할 수 있고, 캐시로 오래된 전시가 남지 않음.

## Task 6: 이어보기·공유·추천 코스와 공개 준비

**Files:** 신규 visitor-preferences.ts, visitor-catalog.ts, full-navigation.ts, full-main.ts; 신규 tests/visitor-preferences.test.ts.
**Interfaces:** Preferences={schemaVersion:1,fontSize:18|21|24,quality:QualityMode,lastRoute?:FullRoute,bookmarks:string[]}; readPreferences():Preferences, savePreferences(value:Preferences):void. 저장 차단·오류 시 기본값으로 관람은 계속한다.

- [ ] 저장소 접근 거부·손상된 저장 값·삭제된 자료·옛 URL에서 앱이 정상 시작하는 검사를 만든다.
- [ ] '이어서 보기 / 처음부터', 북마크, 제목 포함 링크 복사를 제공한다. 실제 공유 전송은 방문자가 선택한다.
- [ ] 본문과 사진 설명을 검수한 뒤 핵심 5~10분/역사 순서/주요 사진의 소수 코스를 구성한다. 자동 회전 대신 다음 전시와 진행 상태를 보여준다.
- [ ] 읽기 가능한 안내·검색을 중심에 두고, 답변이 연결되지 않은 챗봇은 준비 상태를 명확히 정리한다.
- [ ] 초보 관람객 5~8명으로 입장·검색·자료 확대·다른 방·복귀를 확인한다. 성공률과 막힌 지점을 기록하고 한 차례 수정한다.
- [ ] 정식 공개 시에만 검색 노출·SNS 미리보기·공식 사이트 링크·QR·외부 전자책/영상 연결 상태를 점검한다.
- [ ] 모바일/PC 기준과 이전 배포 복구 경로를 문서화하고 커밋한다.

**완료:** 다시 들어와 이어 볼 수 있고, 짧은 관람 코스를 끝까지 진행할 수 있음.

## 검증과 배포 순서

1. 각 단계의 논리 테스트와 실제 관람 동선을 함께 확인한다. CSS 값을 그대로 베끼는 테스트만으로 UI 통과를 판정하지 않는다.
2. 성능은 첫 방문/재방문을 나눠 같은 기기·네트워크에서 대표 경로를 5회 측정하고 중앙값을 비교한다. 실제 방문자 데이터가 쌓이면 모바일/PC별 75백분위를 본다.
3. LCP 2.5초, INP 200ms, CLS 0.1을 목표로 삼되 파노라마가 관람 가능한 시간과 장면 전환 지연을 따로 기록한다. 아직 측정 결과나 개선 보장은 아니다.
4. Preview에서 대표 자료와 기존 링크를 확인한 뒤 단계별로 고정 Vercel 주소에 반영한다. 현재 fa87431 복원 버전은 비교·복구 기준으로 보존한다.
5. 고급 애니메이션, 앱 설치, 전 자료 오프라인 저장, 회원가입, 유료 AI 챗봇, 새로운 3D 공간 제작은 관람 편의 개선이 확인된 뒤 별도로 판단한다.

## 참고

- [전체 설계와 현황 근거](design.md)
- [W3C 44px 터치 영역 강화 기준](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html)
- [Core Web Vitals 평가 기준](https://web.dev/articles/vitals)


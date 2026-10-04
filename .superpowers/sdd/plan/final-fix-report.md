# Final integration fix report

Implemented all seven findings from final-fix-brief.md on base de8b1bb:

1. E classification uses approved-e-extension scene metadata. Only scene_ext-e-entry and scene_ext-e-center are E; the direct shortcut selects the actual entry. Original e-/f- scenes remain lobby/events and all existing scenes remain accessible. No source graph or museum JSON edits.
2. Photo course has five explicit unique existing galleries: a03, a04, b02, c01, d01. The selected material/gallery index is validated against source assets; course description uses actual gallery titles. Full contextual catalog/search coverage remains.
3. Same-page Back clears remembered article when the route has no article/media action. Temporary media overlays retain article state, and close restores its existing URL/DOM/scroll behavior.
4. Shared image loading performs one derivative-to-original fallback. FullContent terminal failure provides readable photo failure/retry, original expansion and current-screen reload. Generation plus current image membership ignores stale failure after gallery changes; retry does not duplicate original controls.
5. Main load errors, reader article errors, content engine/article errors and search data errors expose explicit 현재 화면 새로고침. This preserves the current URL and recovers browser cached ESM failures after connectivity resumes. No automatic reload loop.
6. Search submit prevention binds immediately, before awaiting article data. Submit is disabled and form busy until ready; typed query persists and is searched on readiness. Terminal load errors clear busy and expose reload.
7. Header menus use hamburger drawer at <=1100px. Landscape reading hides duplicate context and starts at the 58px header, leaving206px of scroll viewport at844x390; page/nav/footer remain44px accessible. Portrait/desktop reading start positions tighten the previous blank gap. Original menus and reading return/location title remain reachable.

Changed source: full-main.ts, full-style.css, visitor-catalog.ts, full-content.ts, visitor-reader.ts, visitor-media.ts, new visitor-ui-state.ts and visitor-image.ts. New tests: visitor-integration.test.ts.

Verification:
- npx tsc --noEmit: passed.
- node --experimental-strip-types --test tests/visitor-integration.test.ts:5/5 passed. Actual catalog assertions cover only two metadata-approved E scenes, real shortcut, bounded unique valid gallery stops and source context progression. State/event regressions cover same-page history vs media overlay, deferred submit prevention/query preservation, and one fallback plus one terminal failure with fresh successful retry.
- Root conducts final complete suite/build and real browser viewport/failure recovery QA. Browser reload recovery requires the browser tests; no physical iOS/Android validation claim is made.
- Source full-museum.json, delivered media junction and deployment manifest remain unchanged. No deployment, nested agents or new service.

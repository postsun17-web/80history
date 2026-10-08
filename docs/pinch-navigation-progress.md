# Pinch navigation implementation

Plan: user-approved two-finger spread, release to approach, both museums (2026-10-08).
Baseline: main/origin/main 02f744f, 111 tests pass. Branch: feat/pinch-approach.

## Requirements

- Freeze the destination at the midpoint when the second contact starts. Only actual touch contacts qualify.
- Minimum initial span 40 CSS px; span ratio >=1.35 and increase >=24 px continuously for 150 ms arms. No maximum duration. Below 1.15 disarms. Midpoint drift >max(40, shorter viewport side*0.1), third contact, cancel, orientation/visibility, popup, or remaining-finger drag cancels.
- Release all contacts before navigating once on the next frame. Preserve native PSV zoom/pan, stop its inertia on committed navigation, suppress synthetic clicks. Protected UI, objects, modals never navigate.
- Reuse history wall catalogue. Add separate, visually reviewed passage regions referencing original adjacent movement links, with explicit arrival looks and accurate labels. Both museums; no new nodes or API/URL forms.
- Audio/entrance actions preserved. New exhibit starts page 1. Back restores pre-pinch scene/look/page. Loading locks and errors release input.
- Browser QA with real multi-contact emulation, source/arrival screenshots, regression suite, staged Vercel build then promote existing public domain. Physical device limitation disclosed.

## Tasks and interfaces

| Tasks | Shared interface | Decision |
| --- | --- | --- |
| Gesture + integration | Candidate, origin snapshot, commit | Controller owns gesture lifecycle; main saves origin route rather than post-pinch view. |
| History + memorial mapping + picking | Passage JSON | Separate files `pinch-passages-history.json`, `pinch-passages-memorial.json`; `{museum,scenes:{[sceneId]:[{source,scene,title,look,points}]}}`. `source` is original hotspot name; points use source yaw/atv degrees. All scenes accounted for, empty arrays when no valid passage. |
| Wall + pinch picking | Source degree polygon tests | Reuse containsWallPoint; walls take priority. Protected controls and independent content are excluded. No passage overlay or change to ordinary clicks. |
| Gesture + history | pre-pinch source route | Snapshot before native touch move; stop delayed source view save before navigate. |

Ruling: use approved separate branch in the existing clean checkout, preserving asset junctions and prior workflow. No extra worktree needed. Parallel workers own disjoint catalogue files only; parent owns runtime and tests.
Ruling: user has explicitly approved push/production deployment in this plan; no extra approval checkpoint.

## Progress

- Baseline complete: 111/111 tests.
- Runtime complete: native touch observer, pure gesture state machine, destination picker, shared raycast stabilization, pre-pinch history restoration.
- History mapping complete: 62 reviewed scenes, 188 regions (187 unique original links plus entry door); no wall/passage overlap in diagnostic sampling.
- Memorial mapping complete: 29 reviewed scenes, 64 regions. Three original links through furniture remain ordinary-arrow only; see pinch-memorial-review.md.
- Review fix: finalize the continuous 150 ms hold at two-finger release even if the next animation frame has not run. Two failing regressions verified before fix, 24 gesture cases now pass.
- Final independent runtime/data review: no actionable findings. Full suite 145/145 passes; TypeScript passes.

## Browser verification (local source and production build)

Chromium with actual CDP two-contact events, not synthetic zoom-change events. Portrait 390×844, landscape 844×390, desktop 1280×900. Physical iOS/Android devices were not available.

- Before implementation: same spread on A03 stayed in scene_a-n-w-1 with no hint. After implementation: A03 page 4 → A02 page 1, hint and one navigation; Back restores original scene, page 4, yaw 180, atv -2 and FOV 110.
- Passing: shrink below 1.15 cancels, midpoint drift cancels, third contact cancels, staggered release commits, remaining-finger drag cancels, near exhibit keeps normal zoom, maximum zoom still approaches.
- Passing: memorial 1f01 → 1f02, landscape history wall, A central floor → A inner passage, original entrance door video → lobby.
- Passing: modal opening cancels, standalone memorial medal does not navigate or open from a pinch, museum remount leaves one hint element, PC wheel remains zoom, PC wall hover/click and enlarged image still work.
- Failure injection: abort destination cubemap requests → existing error appears → retry after removing abort loads correct destination and clears error.
- Screenshots and diagnostics: E:/CodexAssets/youngnak-pinch-qa/. The seven browser console errors during failure injection were intentional aborted image requests plus the existing scene-load error.

## Release

- Feature commit: dc15e7157882e607e1894eacf42f9ea5a8ca9c70, fast-forwarded and pushed to GitHub 80history/main. Previous version remains at 02f744f.
- Production-mode local browser verified both museums using minified bundle index-DsVTbU5V.js, without runtime errors. Memorial 2f01 → 2f02 narration h02.mp3 plays, advances, and respects the global mute control.
- Vercel staged production deployment dpl_6EsRZpJsKRgFGffoXQHk9Skxp56c: all 66557 media assets verified; TypeScript/Vite build successful. Existing large-chunk/static+dynamic import warnings remain unchanged.
- Protected staging HTTP checks use authenticated `vercel curl`, without saving credentials: main JS, memorial HTML and memorial base panorama return 200. Staged JS SHA256 matches the locally browser-tested production bundle: 1047FA2823C4A2ED025549CB355AF37B273EDEF1BFBF3C7B30604EBBC58E36DD.
- Promoted the same build to https://youngnak-museum-poc.vercel.app/ and /hkjmuseum.html. Immutable deployment: https://youngnak-museum-88ew120rw-postsun17-webs-projects.vercel.app.
- Public mobile-emulation checks pass for history A03 page 4 → A02 page 1 → Back and memorial 1f01 → 1f02 → Back. Both restore pre-pinch look/page, show the release hint, use the expected bundle, and produce no runtime or scene errors.
- Public screenshots: public-history-armed.png, public-history-arrived.png, public-memorial-armed.png, public-memorial-arrived.png in the evidence directory above.
- No physical-phone verification was possible. The three explicitly blocked memorial seating links retain their existing click/tap arrows.

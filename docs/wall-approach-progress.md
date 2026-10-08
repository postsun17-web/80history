# Wall approach implementation — 2026-10-08

Approved plan: clicking a distant content-bearing wall approaches the existing front viewpoint and stops in 3D. History museum interiors only; memorial and freestanding objects excluded. Preserve near content, controls, gestures and original data. Publish reviewed implementation to GitHub main and existing Vercel domain.

- Baseline main: 46695bb. Clean feature branch: feat/wall-approach-navigation.
- Source inventory: 51 tour.xml viewpoints (50 interiors plus the exterior entrance scene_vr02), 21 page-based exhibits; no existing distant-wall navigation polygons or shared wall mesh. Author camera-local angular polygons with per-scene visual evidence.
- Work split: A; B/C; D/E/F wall calibration in separate data files. Root owns interaction, hit testing, integration, browser QA and release.
- Runtime polygons are inert data, not SVG hit areas. Central history click arbitration protects UI controls and independent objects; only catalogued wall images may be intercepted before arrival.
- Calibration complete: 344 visible-wall polygons in 50 interiors, with scene_vr02 explicitly reviewed and empty. Thirty-four destinations retain existing viewpoints; all 21 zones use exact menu arrival views. See the A, B/C and D/E/F review notes. Panorama/XML/assets remain unchanged.
- PSV's triangle-based invisible picking sphere missed an exact cardinal seam (yaw 270°, pitch 5°, center pixel; adjacent pixels worked). The history controller replaces only that tagged sphere's raycast with analytic sphere intersection, respecting world transform and near/far clipping, and restores it on destroy. Rendered marker geometry is untouched. Regression test covers cardinal and polar directions.
- Independent code review checked click arbitration, timeline gallery overlays, transition locking, cleanup and raycast scope. Found null-coordinate handling and far gallery polygon surfaces were corrected before QA.

## Local validation

- `npm test`: 109/109 passing after the additional catalogue overlap test; `npx tsc --noEmit` passing. Vite production code build passed (static asset copying omitted locally; full asset restore/build is verified on Vercel). Existing bundle-size/static-vs-dynamic import warnings remain.
- All 344 regions have reachable interiors. An independent 36×36 sampling audit checked 409,483 interior points with no wrong destinations. Every edge midpoint is checked; the sole shared A02/A03 physical corner can select either adjoining face and has zero overlap area. Tests retain representative interior grids and checks on both sides of this corner.
- Desktop 1280×900: A center, exact west-bearing wall → A03 front, page1, no dialog; next click opens native image dialog. Hover hint/cursor captured.
- Mobile emulation 390×844 and landscape 844×390: real CDP touch events reach A03 front, then open its image. Swiping and long press keep the source scene. Pinch changed zoom from 31.08 to 100 without movement. Three rapid taps result in one arrival, no dialog.
- Desktop right-click, mouse drag and floor click keep the source scene.
- History: A03 page4 facing A06 → A06 page1 → Back restores A03 page4 and yaw90/pitch3 view.
- Failure recovery: aborted target panorama requests show the existing retry message; after restoring requests, retry succeeds and content opens (input lock released).
- Independent browser checks passed: B civil-organization, C social-welfare and D education walls approach and stop in 3D; C next-page control stays in its scene/page2; E far portrait approaches the timeline and the near portrait opens its gallery; the B movement arrow and A freestanding object retain their original action. These runs had no console errors.
- Screenshots and calibration atlases: `E:/CodexAssets/youngnak-wall-qa/`. Key screenshots: `desktop-wall-hover.png`, `desktop-arrival-a03.png`, `mobile-far-a03.png`, `mobile-arrival-a03.png`, `mobile-near-open.png`, `mobile-landscape-arrival.png`.
- Mobile checks use browser/CDP emulation. No physical phone was available.

Release: pending independent static-wall smoke checks and Vercel staging verification.

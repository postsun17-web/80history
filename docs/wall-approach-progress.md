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
- Static-wall browser review passed F welcome/media, E event mural/institution photographs and A introductory wall. All five desktop arrivals use the configured scene/look and leave the content visible without opening dialogs. E event mural also passed touch at 390×844. Evidence: `qa-<target>-before.png`, `qa-<target>-after.png`, `qa-e-events-touch-before.png`, `qa-e-events-touch-after.png`.
- Screenshots and calibration atlases: `E:/CodexAssets/youngnak-wall-qa/`. Key screenshots: `desktop-wall-hover.png`, `desktop-arrival-a03.png`, `mobile-far-a03.png`, `mobile-arrival-a03.png`, `mobile-near-open.png`, `mobile-landscape-arrival.png`.
- Mobile checks use browser/CDP emulation. No physical phone was available.

## Release

- Feature commit: `9b0d2b5`.
- Staged production deployment (public domain not yet promoted): `dpl_B8y298FUYivHTN3dE3a42hUyfUzU`, `https://youngnak-museum-6gn273lh0-postsun17-webs-projects.vercel.app`.
- Vercel verified all 66,557 museum assets and ran the full TypeScript/Vite production build successfully. Code bundle `index-1Fhp05Db.js`, stylesheet `index-VK9_XlPy.css` match the local production build.
- Staged browser verified desktop A wall hover → A03 front → image dialog, mobile touch C wall → C02 front → image dialog. No application errors. Memorial first floor still loads, has 1F/2F controls, and has no wall-approach controller. `stage-desktop-hover.png`, `stage-desktop-open.png`, `stage-mobile-arrival-c02.png`, `stage-mobile-open-c02.png` saved with the other evidence.
- The same staged production deployment was promoted successfully, then `https://youngnak-museum-poc.vercel.app/` and `/hkjmuseum.html` both returned HTTP 200 with the verified bundle hashes.
- Public desktop D education wall → front viewpoint/page1 → image dialog passed with no application errors (`public-desktop-d-hover.png`, `public-desktop-d-open.png`). Public mobile touch C social-services wall → front viewpoint/page1 passed with no dialog (`public-mobile-c-arrival.png`).
- GitHub `postsun17-web/80history` main includes the implementation and verification records. No source panorama, source XML, source museum manifest, sound file or deployment-asset archive changed.

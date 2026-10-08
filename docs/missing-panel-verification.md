# Omitted-coordinate exhibition panels — 2026-10-08

## Problem and cause

User screenshot: church planting (C04), page 1/9, showed a blank stone wall while page and more-info controls remained visible. Reproduced on the public deployment `c777c70` using `scene_c-n+1`.

The primary `sector_c04_01` source hotspot specifies `atv=29.542` and intentionally omits the default `ath=0`. The renderer rejected it before applying zero-coordinate defaults. The same source pattern occurs for B04 (`sector_b04_01`, Christian democratization). An audit of 1,437 history and 84 memorial hotspots found exactly these two exclusions, affecting C04's 9 and B04's 8 pages. All 17 WebPs exist, decode at 2148×1245, and contain visible pixels. No source image repair is needed.

## Fix

The shared eligibility check accepts either horizontal or vertical coordinates (including existing aliases), or polygon points. Existing zero defaults and source geometry are preserved. Non-spatial helpers remain excluded. No source XML, image, room structure, sound, route or wall-approach catalogue changes.

## Validation

- Regression tests failed on B04/C04 before adding vertical-coordinate support, then passed. The tests cover all 21 primary panels, either missing axis, polygon coordinates and non-spatial helpers.
- Full suite: 111/111 passed; TypeScript check and Vite production code build passed. Existing bundle warnings unchanged.
- Actual browser: all 17 C04/B04 pages load the correct visible 3D image texture through the page selector.
- Mobile emulation: 390×844, C04 wall approach arrives at its original front viewpoint and displays its content; the enlarge button opens the correct image.
- Desktop 1280×900: both first pages visible; B04 panel click opens its image and Escape closes it.
- C04's original `morespot_1` button still opens `html/c04_01.html` (church-planting principles and support methods) above the restored panel.
- Independent source/data and diff review: no findings; eligibility changes only for the two intended source panels.
- Screenshots and test output: `E:/CodexAssets/youngnak-panel-qa/` (`before-mobile-c04.png`, `after-mobile-c04.png`, `after-desktop-c04.png`, `after-desktop-b04.png`, `mobile-c04-last.png`, `mobile-b04-last.png`, and zoom captures).
- Mobile testing is browser emulation, not a physical device test.

## Deployment

- Fix commit: `8b92c09`.
- Staged production: `dpl_BGVzSjipKhn4fqynKNx2csvnbSox`, `https://youngnak-museum-osoh4zvv2-postsun17-webs-projects.vercel.app`.
- Full Vercel build passed and verified all 66,557 source assets. Staged HTTP checks returned 200 for C04/B04 first images (`image/webp`, 106,022 and 481,064 bytes).
- Staged JavaScript `index-DG5SBMqq.js` SHA-256 matches the locally tested production bundle: `8bec69647db633285cd2aef4810733ff884b601d1a3493580634200b592befde`.
- Promoted the same deployment to `https://youngnak-museum-poc.vercel.app/`. Public browser verified C04 mobile 3D content + enlargement and B04 desktop 3D content; both have visible decoded 2148px textures and no application errors. Public JavaScript is the verified `index-DG5SBMqq.js`.
- Public captures: `public-mobile-c04.png`, `public-mobile-c04-zoom.png`, `public-desktop-b04.png` in the evidence folder above. Fix and verification are on GitHub `postsun17-web/80history` main.

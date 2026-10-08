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
- Independent source/data and diff review: no findings; eligibility changes only for the two intended source panels.
- Screenshots and test output: `E:/CodexAssets/youngnak-panel-qa/` (`before-mobile-c04.png`, `after-mobile-c04.png`, `after-desktop-c04.png`, `after-desktop-b04.png`, `mobile-c04-last.png`, `mobile-b04-last.png`, and zoom captures).
- Mobile testing is browser emulation, not a physical device test.

Deployment verification pending.

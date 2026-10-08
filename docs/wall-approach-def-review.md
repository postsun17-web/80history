# D / E / F wall approach calibration

Reviewed 2026-10-08 against `full-museum.json` and the original `tour.xml` panorama assets. The catalogue contains **20 indoor source viewpoints plus one explicitly empty outdoor entry, 155 regions, 13 destination definitions, and 91 explicitly permitted source wall surfaces** (80 wall images and 11 far portrait polygons).

## Evidence and method

Every D, E and F angular atlas was rendered with `tools/render_wall_calibration.py` and individually viewed. Coordinates use source yaw and source atv, with the 2880 × 640 atlas covering yaw −180…180° and atv −40…40°. Each final D outline was rendered again with the tool's `--regions` option and visually checked. E/F base atlases omit the original image overlays, so their image-plane composites were also rendered and individually checked, both before and after outlines.

Local review evidence is under `E:/CodexAssets/youngnak-wall-qa/`:

- `<scene>.jpg`: original panorama plus angular grid.
- `<scene>-regions.jpg`: catalogue outlines produced by the shared calibration tool.
- `<scene>-composite.jpg`: E/F panorama plus original wall-image overlays.
- `<scene>-composite-regions.jpg`: E/F composite with final regions.
- `def-scenes.json`: scenes-only catalogue passed to `--regions`.
- `build-def.py`, `write-def.py`, `validate-def.py`: transient diagnostic generation and structural/geometry checks; these are outside the repository and do not modify source assets.

D polygons follow visible title plaques, photographs and explanatory text. Lower edges stop above floor kiosks; portal-side regions are clipped around columns. Review tightened the lower edges beside the kiosks in `scene_d-n-0`, `scene_d-n-w-1`, and `scene_d-n-w-2`, and narrowed the A-room views through the D entrance around its dark and white columns.

E/F wall images use their actual resolved source transform: scale, dimensions, anchor edge, yaw/atv and local rotations. The resulting final angular points are stored explicitly in the catalogue. Curved angular edges are sampled along the physical image plane. The event wall's church-campus collage follows the visible roof/building silhouette, excluding its transparent sky. A route is never inferred from a nearby floor arrow or from the order of source hotspots.

## Coverage ledger

All rows below were visually reviewed. Region counts include separately projected information labels and TV thumbnails belonging to the same wall destination.

| Source scene | Regions | Visible wall coverage |
| --- | ---: | --- |
| `scene_d-c-0` | 7 | All five essential ministries, introduction and history |
| `scene_d-n-0` | 6 | Four other ministries, introduction and history |
| `scene_d-n-e+1` | 6 | Four other ministries, introduction across ±180°, history |
| `scene_d-n-e+2` | 6 | Four other ministries, introduction across ±180°, history |
| `scene_d-n-w-1` | 6 | Four other ministries, introduction, history across ±180° |
| `scene_d-n-w-2` | 6 | Four other ministries, introduction, history across ±180° |
| `scene_d-s-0` | 13 | Five ministries, introduction/history, identifiable A02–A07 walls through the two portals |
| `scene_d-s-e+1` | 7 | Five ministries, history, A04 through portal |
| `scene_d-s-w-1` | 7 | Five ministries, introduction, A05 through portal |
| `scene_e-c-0` | 11 | Timeline, church campus, related institutions, A/B/C/D entrance information |
| `scene_e-c-e+1` | 9 | Timeline, campus, institutions, A/B/D information |
| `scene_e-c-n+1` | 11 | Timeline, campus, institutions, A/B/C/D information |
| `scene_e-c-w-1` | 9 | Projected timeline and portraits, campus, institutions, A/C/D information |
| `scene_e-n-w-1` | 8 | Campus, institutions and A/C/D information; timeline is already the destination |
| `scene_e-c-n-w` | 11 | Projected timeline and portraits, campus, institutions, A/C/D information |
| `scene_e-c-n-e` | 8 | Campus, timeline and A/B/D information; institution photographs are already near |
| `scene_e-n-e+1` | 11 | Four individual institution photographs, timeline, A/B/D information; campus is already near |
| `scene_f-c-0` | 9 | Documentary panel, media screen, welcome screen, visible timeline/institutions, A/D information |
| `scene_f-c-e+1` | 3 | Documentary panel, media screen and visible timeline |
| `scene_f-c-w-1` | 1 | Welcome screen across the lobby; documentary/media wall is already near |
| `scene_vr02` | 0 | Outdoor church entrance: inspected original atlas shows architecture, doors, steps and street furniture, with no indoor exhibition wall |

## Destinations and interaction boundaries

`d01`–`d05` use the exact `zone.scene` and menu `look`, including the source's 270° worship heading. The eight static destinations are:

| ID | Destination | Look `[yaw, atv, fov]` |
| --- | --- | --- |
| `d-intro` | `scene_d-s-e+1` | `[180, -13, 110]` |
| `d-history` | `scene_d-s-w-1` | `[180, -13, 110]` |
| `e-timeline` | `scene_e-n-w-1` | `[-90, 0, 110]` |
| `e-events` | `scene_e-n-e+1` | `[90, 0, 110]` |
| `e-buildings` | `scene_e-c-n-e` | `[91, -5, 110]` |
| `f-documentary` | `scene_f-c-w-1` | `[-90, -10, 110]` |
| `f-media` | `scene_f-c-w-1` | `[0, 0, 110]` |
| `f-welcome` | `scene_f-c-e+1` | `[90, 0, 110]` |

Cross-room `a02`–`a07` and `info-a`–`info-d` reference the shared definitions owned by the A/common catalogues. The D introduction in this catalogue is its physical D-room wall, separate from the internal A-side `info-d-north` copy. A-room wall identification through the D portals was cross-checked with the A calibration owner.

No source scene has a region whose destination is itself. In particular, `scene_e-n-w-1` retains the original near portrait/gallery interactions, and `scene_f-c-w-1` retains its original documentary and media interactions. The source portrait polygons on `scene_e-c-w-1` (`poly_1`, `poly_2`, `poly_3`, `poly_4`) and `scene_e-c-n-w` (`poly_1` through `poly_7`) lie inside the far timeline region and are explicitly listed in its `surfaces`; the runtime can approach before opening those far galleries. This catalogue contains no arrow, page button, video/audio control, callout, visitor, kiosk, chair, door, floor or column surface overrides. TV thumbnails and far portrait polygons are permitted wall surfaces; explicit controls are not listed.

## Validation

`validate-def.py` passed with all 20 indoor scenes plus the outdoor entry, 155 valid polygons, 91 existing permitted wall surface names, 13 valid targets, exact D zone/menu destinations, no self-destination regions, finite coordinates, and 12 positive plus 13 negative geometry cases. All 11 far portrait polygon centres are covered and permitted; the near timeline has no self approach. Positive cases cover all five D ministries, seam-crossing introduction/history walls, E timeline/campus, and F documentary/media/welcome. Negative cases cover floor, ceiling, blank marble, D kiosks, portal columns, the E passage, transparent sky, the F column/desk, and the already-near F media wall. `scene_vr02` is explicitly empty after visual review; its existing entry-door control remains outside this feature.

This review verifies source calibration and hit-region geometry. Integrated browser event arbitration, loading state and content-modal regressions are verified by the main runtime task.

# History pinch passage review

Reviewed 2026-10-08. Catalogue: `src/data/pinch-passages-history.json`.

The catalogue accounts for **all 62 history scenes**, with **188 regions**: **187 unique original adjacent movement links and one original entry-door action**. Every scene has a reviewed navigation lane; no empty scene was needed. This includes 51 `tour.xml` views (the outdoor museum entrance and indoor A–F galleries) and 11 `outside.xml` church-grounds views. There are no new nodes or multi-scene hops.

## Evidence and calibration

All 62 actual original cubemap panoramas were rendered and visually inspected, first with original movement links and existing wall outlines, then with passage outlines. Every repaired final outline was viewed again. Evidence is under `E:/CodexAssets/youngnak-pinch-qa/history/`:

- `<scene>.jpg` contains the actual panorama, original link labels, and purple wall boundaries.
- `<scene>-regions.jpg` is the final reviewed green passage outline for that scene.
- `sheet-all-00.jpg` through `sheet-all-30.jpg`, and their `-regions` counterparts, pair the 62 scenes for review.
- `arrival-review.json` records each original movement source, reverse-link draft heading, final arrival heading, and deliberate corner/door turns.
- `build.py`, `render.py`, `validate.py`, and `validation.json` reproduce the authoring input and source/geometry checks without modifying original assets.

The diagnostic rasterizer is adapted from `tools/render_wall_calibration.py` and resolves each source through its `pano.root`, matching `panoramaSource`. Its final polar projection also accounts for `flipTopBottom:true`: top and bottom faces rotate 180 degrees relative to the original wall-only diagnostic. This matters for floor angles near/below 40–45 degrees; it removes misleading duplicated bench fragments. Coordinates are source yaw/atv degrees, with the atlas covering yaw −180…180 and atv −10…60. Seam polygons keep a short continuous yaw span and are drawn at both atlas edges.

The polygons identify visible floor, paving, steps, and the original wooden entry door. Exhibition walls, column faces, benches, plinths, kiosks, visitors, planters, handrails, the independent `object_87`, and protected content remain outside the authored regions. The separate wall catalogues were loaded into every diagnostic so passage boundaries could be checked against them. No wall surface overrides are introduced.

## Source and arrival rules

Each `source` is an original hotspot name from `full-museum.json`, and each destination is exactly its original adjacent `linkedscene` under the viewer's existing lowercase normalization. The sole uppercase source spelling, `scene_f-c-0` / `spot4` → `scene_F-c-w-1`, resolves to existing `scene_f-c-w-1`; original data is retained. `scene_f-c-e+1` has two identical `spot1` source names for the same return destination; one floor region represents that original action.

The entrance polygon references original `scene_vr02` / `open_b`. It targets `scene_f-c-0`, which is explicitly loaded by original `open_door1.onvideocomplete`. The runtime must execute the existing entry procedure, including its door video/audio behavior, when committing this candidate. It must not replace that procedure with an immediate scene load. Arrival `[0,0,110]` faces the indoor lobby, consistent with the original entry's forward look. The outside wooden door polygon stays inside its visible wood and excludes surrounding stone pillars.

All regions have explicit `[yaw,0,110]` arrival looks. Reverse-link bearing +180 was used only as a draft. Every destination panorama was visually reviewed; aligned indoor through-routes retain a rounded travel heading, while gallery corners and outdoor bends turn toward the next visible walk space. For example, A east/west inner corners turn toward the D portal or the return corridor, D north corners follow the open side aisles around kiosks, the playground arrival follows the side passage rather than facing its entrance wall, and the church-side stair arrivals face the stairs or parking continuation. Korean labels name the adjacent room or passage and all end in `이동` for the runtime's release hint.

## Coverage ledger

Every row was visually checked. Counts include the door action in `scene_vr02`.

| Source scene | Regions | Reviewed boundaries |
| --- | ---: | --- |
| `scene_vr02` | 4 | Wood door entry; left/right paving and descending steps; stonework and railings excluded. |
| `scene_a-c-0` | 6 | Six floor lanes; centre starts below round seat; side benches excluded. |
| `scene_a-c-e+1` | 2 | Two clear floor lanes; long foreground bench excluded. |
| `scene_a-c-n+1` | 4 | D doorway plus three floor lanes; both side benches excluded. |
| `scene_a-c-w-1` | 2 | Two clear floor lanes; long foreground bench excluded. |
| `scene_a-n-0` | 4 | Four lanes; seam lane starts below round seat, side lanes below benches. |
| `scene_a-n-e+1` | 3 | Narrow D-bound lane beside bench; central return lane starts below bench. |
| `scene_a-n-w-1` | 3 | Two return lanes start below bench; seam passage stays clear of wall corner. |
| `scene_a-s-0` | 4 | Four doorway/cross-gallery floor lanes; white entry pillars excluded. |
| `scene_a-s-e+1+` | 2 | Central return lane narrowed beside foreground bench; other lane clear of visitor. |
| `scene_a-s-e+1` | 3 | A/lobby/C portal floor lanes; striped pillar and blank white wall excluded. |
| `scene_a-s-w-1+` | 2 | Central return lane moved to visible floor beside bench; west lane avoids bench. |
| `scene_a-s-w-1` | 4 | B/lobby/A portal floor lanes; striped pillar and blank white wall excluded. |
| `scene_b-c-n+1` | 3 | Three floor lanes; visitor on west seam remains outside. |
| `scene_b-c-n-0` | 5 | Five floor lanes; child, vase and wall bases excluded. |
| `scene_b-c-s-0` | 4 | Four lanes; centre starts below round plinth and west lane avoids brown pillar. |
| `scene_b-c-s-1` | 4 | Four floor lanes; portal plant, striped pillar and near wall excluded. |
| `scene_b-e-s+1+` | 3 | Three floor lanes; foreground bench excluded after corrected bottom-face projection. |
| `scene_b-e-s+1` | 4 | Four floor lanes; striped pillar and side bench excluded. |
| `scene_b-n-e+1` | 3 | Three floor lanes; child, vase and near wall base excluded. |
| `scene_b-n-w-1` | 2 | Two floor lanes; visitor and near wall base excluded. |
| `scene_b-w-s-1` | 2 | Two floor lanes; brown pillar and near wall base excluded. |
| `scene_c-c-s-1` | 4 | Four lanes; portal-bound lane starts below visitor feet. |
| `scene_c-s-e+1` | 2 | Two clear floor lanes; white central mass and benches excluded. |
| `scene_c-n-e+1` | 2 | Two clear floor lanes; near wall base, vase and child excluded. |
| `scene_c-n+1` | 3 | Three clear floor lanes; brown wall mass and visitor excluded. |
| `scene_c-n-w-1` | 3 | Three clear floor lanes; wall base, bench and visitor excluded. |
| `scene_c-c-s-0` | 5 | Five lanes; centre starts below plinth, east lane stays beside foreground man. |
| `scene_c-n-0` | 4 | Four floor lanes; visitors, vase and wall bases excluded. |
| `scene_c-s-w-1` | 4 | Four lanes; A-bound lane starts below independent object_87; pillar/bench excluded. |
| `scene_c-s-w-1+` | 3 | Three floor lanes; foreground bench and distant plinth excluded. |
| `scene_d-c-0` | 6 | Six floor lanes; northwest lane starts below visitor feet; kiosks excluded. |
| `scene_d-n-0` | 3 | Three floor lanes; central kiosk and nearby visitors excluded. |
| `scene_d-n-e+1` | 2 | Two lanes; east corner lane starts below kiosk legs. |
| `scene_d-n-e+2` | 3 | Three lanes; west/centre return starts below foreground man; kiosk bases excluded. |
| `scene_d-n-w-1` | 2 | Two lanes; west corner lane starts below kiosk legs. |
| `scene_d-n-w-2` | 3 | Three lanes; north lane starts below kiosk legs; visitors excluded. |
| `scene_d-s-0` | 4 | Four floor lanes; central visitor and portal pillars excluded. |
| `scene_d-s-e+1` | 3 | Three floor lanes; wall bases, kiosks and visitors excluded. |
| `scene_d-s-w-1` | 2 | Two floor lanes; kiosk, visitor and near wall base excluded. |
| `scene_e-c-0` | 5 | Five floor lanes; marble wall bases, portrait/gallery planes and visitors excluded. |
| `scene_e-c-e+1` | 2 | Two floor lanes; event wall, corner mass and columns excluded. |
| `scene_e-c-n+1` | 4 | Four floor lanes; A entry pillars and lobby wall bases excluded. |
| `scene_e-c-w-1` | 2 | Two floor lanes; timeline wall, corner mass and columns excluded. |
| `scene_e-n-w-1` | 4 | Four floor lanes; near timeline interactions and visitor remain outside. |
| `scene_e-c-n-w` | 2 | Two floor lanes; close foreground visitor remains outside. |
| `scene_e-c-n-e` | 2 | Two floor lanes; close child and near image planes remain outside. |
| `scene_e-n-e+1` | 4 | Four floor lanes; near event wall and visitors excluded. |
| `scene_f-c-0` | 4 | Four floor lanes; desk, sofas, columns and exit-door visitor excluded. |
| `scene_f-c-e+1` | 1 | One floor lane for duplicated original spot1; desk and columns excluded. |
| `scene_f-c-w-1` | 1 | One floor lane; sofa, media wall and columns excluded. |
| `scene_vr03` | 3 | Three paved plaza lanes; wall reliefs, trees and distant stairs excluded. |
| `scene_vr01` | 2 | Two paved plaza lanes; central stair facade remains outside. |
| `scene_vr04` | 4 | Four paved lanes; signs, planted border and building wall excluded. |
| `scene_vr05` | 2 | Two grass/paving lanes; lowered below playground wall, planters and ramp wall. |
| `scene_vr06` | 2 | Two paved lanes beside benches; tree trunks, seats and stage excluded. |
| `scene_vr07` | 2 | Two paved church-side lanes; monument, stone pillars and railings excluded. |
| `scene_vr08` | 2 | Two paved lanes; descending route starts below handrails, side door/wall excluded. |
| `scene_vr09` | 2 | Two paved parking lanes; cones, rails and stone facade excluded. |
| `scene_vr10` | 2 | Two clear parking lanes; buildings and planted beds excluded. |
| `scene_vr11` | 3 | Three clear parking lanes; tree beds, stairs, green tent and building entrances excluded. |
| `scene_vr12` | 2 | Two lanes on front steps/paving and parking approach; handrails/planters excluded. |

## Validation and limits

`validate.py` passes with 62 exact scene keys, 188 finite nondegenerate polygons, all 187 unique original movement links accounted for, valid adjacent targets, no self destinations, and explicit finite arrival looks with FOV 110. Polygon checks found **zero intersections with existing wall regions**, **zero passage-to-passage intersections**, and **zero independent hotspot centers covered**. The 28 positive/negative angular cases cover the entry wood/stone boundary, round seats, benches, visitors, a kiosk, `object_87`, the desk, playground wall, handrails, and steps.

Reproduce with:

```powershell
python E:/CodexAssets/youngnak-pinch-qa/history/validate.py
python E:/CodexAssets/youngnak-pinch-qa/history/render.py --regions
```

This review verifies mapping, original adjacency and visual geometry. Browser touch arbitration, original entry/audio execution, loading/error state, and back restoration are verified by the parent runtime task. A few regions start low or narrow to avoid a foreground bench, visitor or original object marker; these conservative gaps are intentional. E/F raster evidence uses the actual cubemap bases plus projected wall boundaries, and does not redraw dynamic image overlays; all authored floor lanes lie outside those wall/image planes.

Only the passage catalogue and this review were added to the repository by this calibration task. Original XML, full museum data and panorama/assets were retained unchanged.

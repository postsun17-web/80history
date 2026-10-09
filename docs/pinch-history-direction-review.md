# History view-direction navigation data review

Reviewed 2026-10-09. This refines the 2026-10-08 floor-polygon catalogue without changing the original museum data, destinations, arrival views or ordinary wall-click regions.

## Original movement bearings

`src/data/pinch-passages-history.json` now records `direction: [ath, atv]` for all **188 entries across 62 scenes**. Each value is copied as a number from the matching original hotspot in `full-museum.json`, including the entrance's `open_b` bearing `[0.5613, 1.2642]`. Selection can use the original arrow's horizontal direction without requiring the user to aim at a narrow floor polygon.

The existing catalogue already deduplicates the two `scene_f-c-e+1` / `spot1` records with the same destination. Their bearings differ slightly; the recorded direction is the first source entry, `[-92.287, 24.297]`, preserving original-order deduplication. The original second entry is not edited. All previous `source`, `scene`, `title`, `look` and `points` values are unchanged, verified against `HEAD` before the refinement.

## Near exhibit surfaces

All **34 canonical wall destinations** were reviewed against their actual cubemap bases and source hotspot metadata. The visual sheets cover 31 distinct scenes. Image overlays are separate from the cubemap: blank wall areas on these diagnostic renders are the intended surfaces occupied by the runtime image layers, not missing deployed content.

| Canonical targets | Existing near-surface evidence |
| --- | --- |
| A02–A07, B01–B05, C01–C05, D01–D05 (21 targets) | Each has its own `sector_<zone>_01` projected dynamic image plane, updated with the current page. |
| E timeline, E events | `sector_a011` and `sector_a01_03a` projected wall image planes; timeline also has original photo polygons. |
| E buildings | Four projected `other_build` image panels on the front wall. |
| F documentary | `dacuspot_1` wall image plus original story/video hotspots. |
| F media | Original `iframe` wall video plane. |
| F welcome | Welcome video and information image planes above the reception desk. |
| A/B/C/D room introductions (4 targets) | Original `pannelspot_*` heading and `tvspot_*` video planes. |
| D north introduction | Baked wall heading/reading area extending beyond the small original video plane. |
| D south introduction, D south chronology | Baked panorama text/photo content, with no nonmovement source hotspots. |

Runtime near-surface detection must include real projected image planes with no `SourceAction`, such as `sector_a011`, `sector_a01_03a`, `pannelspot_1` and `dacuspot_1`. A missing action does not make those visible exhibits a passage. Distant registered wall targets must still be evaluated before treating their image layers as near surfaces.

Only the three baked surfaces require additional data. `src/data/pinch-zoom-history.json` contains:

- `scene_a-n-w-1` / `baked-info-d-north`: the visible north introduction wall, stopping before the D doorway and above the floor.
- `scene_d-s-e+1` / `baked-d-intro`: the five-essential-ministries introduction and portrait, with the adjacent floor excluded.
- `scene_d-s-w-1` / `baked-d-history`: the curved history photograph/date panel, with the floor excluded.

These are local reading surfaces, not scene exclusions. The polygons contain the canonical reading centers `[-3, 0]`, `[180, -13]` and `[180, -13]` respectively. None contains any original movement-arrow center in its scene, so turning toward the adjacent passage remains eligible. The two south polygons cross the yaw seam using continuous coordinates; the existing `containsWallPoint` implementation handles the wrap.

## Evidence and validation

Evidence is stored under `E:/CodexAssets/youngnak-pinch-direction-qa/history/`:

- `targets-00.jpg` through `targets-08.jpg`: all 34 canonical target views, with yaw/atv reference grids, rendered from the original cubemap bases with the existing corrected face projection.
- `<target>.jpg`: separate canonical target images.
- `info-d-north-zoom.jpg`, `d-intro-zoom.jpg`, `d-history-zoom.jpg`: final green reading-surface outlines and original movement-arrow centers.
- `validation.json`: 188 original bearings matched, all preexisting fields preserved, three added zoom-only regions.

The three final outlines were visually inspected. An independent geometry check using the application's `containsWallPoint` function confirmed all canonical reading centers are included and all original arrow centers in these scenes are excluded. Runtime gesture arbitration and mobile interaction are verified by the main implementation task; this data review does not claim physical-device testing.

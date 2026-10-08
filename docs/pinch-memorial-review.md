# Memorial pinch passage review

Reviewed 2026-10-08. The separate `src/data/pinch-passages-memorial.json` catalogue accounts for all 29 memorial viewpoints and all 67 original directed movement links. It registers 64 passage regions; three furniture-blocked links are intentionally omitted. `scene_hkj_1f_06` has an explicit empty array. No source XML, source museum data, panorama asset, runtime, or test file was changed by this mapping task.

## Evidence and method

- Read `src/data/memorial-museum.json`, `src/museum-viewer-data.ts`, and the passage interface in `docs/pinch-navigation-progress.md`. Every region references the name and exact `linkedscene` of an existing source hotspot.
- Loaded the six actual cubemap base images for each scene from `public/media/memorial/panos/<scene>/{f,b,r,l,u,d}/base.webp` and visually inspected angular atlases for all 29 scenes. Coordinates are source yaw/atv degrees; positive atv points down.
- Inspected magenta polygon overlays against the actual floor, door opening, or stair treads, then tightened edges to remove sofas, chairs, coffee tables, glass display cases, door leaves/frames, walls, and the independent sculptural/object displays. The standalone object hotspots are outside these passage regions.
- Checked all 64 saved arrival directions using four labelled contact sheets. Reverse-hotspot yaw plus 180 degrees was a useful draft, then turns at doorways and junctions were adjusted to face the onward corridor. Every saved arrival includes explicit yaw, atv, and FOV 110.
- Diagnostic files are outside the repo at `E:/CodexAssets/youngnak-pinch-qa/memorial/`: `render.py`, `create.py`, `arrivals.py`, `validate.py`, 29 source atlases, 29 region overlays, `arrivals-1.jpg` through `arrivals-4.jpg`, and `validation.json`.
- The diagnostic adapts the side-face projection in `tools/render_wall_calibration.py`. Its top/bottom projection is rotated 180 degrees to agree with the viewer's `flipTopBottom:true`: the down face uses `u=x/abs(y), v=-z/abs(y)`. This was checked against the continuous entrance mat, display-case bases, and wood floor at the 45-degree cube boundary; it avoids the rotated floor/furniture placement in the unmodified example.

## Entrance, floor connectors, and junctions

- `vr11` separates the ground-floor glass entrance from the exterior stair treads. The column, stair rail, and building wall between the two destinations are outside both polygons.
- Arrival from `vr11` into either floor entrance faces yaw 0 into the entrance. A mechanical inverse-link rotation would face a closed side door or a stone wall.
- `2f_01` registers the existing outward stair link to `vr11` and the open entrance into `2f_02`. There is no original direct 1F-to-2F interior movement edge. The interior stair visible in `2f_02`/`2f_03` therefore has no invented pinch shortcut; changing floors still follows the original exterior connector.
- The `1f_08` bedroom/receiving-room entries, `1f_11`/`1f_12` sickroom door, and `2f_03` gallery doorway use clear floor strips within the opening rather than large frame rectangles.
- At `2f_14`, the original arrow for `2f_13` lies on a chair. Its registered region instead uses the visibly open, narrow outside floor lane beside the social-service display. It still follows the same original adjacent link. At `2f_12`, the lane to `2f_13` ends before the foreground chair.

## Explicit omissions

| Source | Original hotspot | Original destination | Visual reason |
| --- | --- | --- | --- |
| `scene_hkj_1f_05` | `spot1801103717` | `scene_hkj_1f_06` | Arrow falls on the tabletop within the roped seating cluster; no visible passage reaches the camera through that furniture. |
| `scene_hkj_1f_06` | `spot1801103760` | `scene_hkj_1f_05` | Arrow falls on an upholstered armchair; the camera is within the furniture group. |
| `scene_hkj_1f_06` | `spot1801103843` | `scene_hkj_1f_03` | Arrow falls on another armchair before the corridor; a small floor patch beyond the chair would require approaching through the blocked seating group. |

These remain available through their original ordinary movement hotspots. The pinch catalogue adds no region over the obstructing furniture.

## Scene and original-link coverage

Short ids in this table expand to `scene_hkj_<id>`; `vr11` expands to `scene_vr11`. The original-destination column lists every original movement edge, including the three exclusions above. Registered destinations show the saved arrival yaw in parentheses; the complete atv/FOV and source hotspot identities are in JSON.

| Source | Original destinations | Registered destinations (arrival yaw) | Regions/original links |
| --- | --- | --- | --- |
| `vr11` | `1f_01`, `2f_01` | `1f_01` (0), `2f_01` (0) | 2/2 |
| `1f_01` | `vr11`, `1f_02` | `vr11` (-101), `1f_02` (-4) | 2/2 |
| `1f_02` | `1f_03`, `1f_01` | `1f_03` (-5), `1f_01` (-98) | 2/2 |
| `1f_03` | `1f_04`, `1f_07`, `1f_08`, `1f_02` | `1f_04` (-93), `1f_07` (86), `1f_08` (1), `1f_02` (-178) | 4/4 |
| `1f_04` | `1f_05`, `1f_03` | `1f_05` (-93), `1f_03` (90) | 2/2 |
| `1f_05` | `1f_06`, `1f_04` | `1f_04` (89) | 1/2 |
| `1f_06` | `1f_05`, `1f_03` | Empty: blocked furniture group | 0/2 |
| `1f_07` | `1f_03` | `1f_03` (-98) | 1/1 |
| `1f_08` | `1f_09`, `1f_10`, `1f_03`, `1f_11` | `1f_09` (-93), `1f_10` (-86), `1f_03` (-179), `1f_11` (0) | 4/4 |
| `1f_09` | `1f_10`, `1f_08` | `1f_10` (-1), `1f_08` (0) | 2/2 |
| `1f_10` | `1f_08`, `1f_09` | `1f_08` (0), `1f_09` (87) | 2/2 |
| `1f_11` | `1f_12`, `1f_08` | `1f_12` (70), `1f_08` (-180) | 2/2 |
| `1f_12` | `1f_11` | `1f_11` (179) | 1/1 |
| `2f_01` | `2f_02`, `vr11` | `2f_02` (86), `vr11` (-80) | 2/2 |
| `2f_02` | `2f_03`, `2f_01` | `2f_03` (0), `2f_01` (-93) | 2/2 |
| `2f_03` | `2f_04`, `2f_02` | `2f_04` (-3), `2f_02` (-94) | 2/2 |
| `2f_04` | `2f_05`, `2f_16`, `2f_15`, `2f_03` | `2f_05` (8), `2f_16` (-55), `2f_15` (-18), `2f_03` (-94) | 4/4 |
| `2f_05` | `2f_06`, `2f_15`, `2f_04` | `2f_06` (-3), `2f_15` (-18), `2f_04` (177) | 3/3 |
| `2f_06` | `2f_07`, `2f_05`, `2f_15` | `2f_07` (-2), `2f_05` (-172), `2f_15` (-18) | 3/3 |
| `2f_07` | `2f_08`, `2f_06` | `2f_08` (-89), `2f_06` (179) | 2/2 |
| `2f_08` | `2f_09`, `2f_07` | `2f_09` (-92), `2f_07` (-178) | 2/2 |
| `2f_09` | `2f_10`, `2f_14`, `2f_08` | `2f_10` (-176), `2f_14` (-178), `2f_08` (169) | 3/3 |
| `2f_10` | `2f_11`, `2f_09` | `2f_11` (179), `2f_09` (91) | 2/2 |
| `2f_11` | `2f_12`, `2f_10` | `2f_12` (130), `2f_10` (85) | 2/2 |
| `2f_12` | `2f_13`, `2f_11` | `2f_13` (90), `2f_11` (-1) | 2/2 |
| `2f_13` | `2f_14`, `2f_12` | `2f_14` (2), `2f_12` (-58) | 2/2 |
| `2f_14` | `2f_09`, `2f_15`, `2f_13` | `2f_09` (-89), `2f_15` (162), `2f_13` (-89) | 3/3 |
| `2f_15` | `2f_14`, `2f_04`, `2f_05`, `2f_06` | `2f_14` (-5), `2f_04` (170), `2f_05` (8), `2f_06` (-2) | 4/4 |
| `2f_16` | `2f_04` | `2f_04` (62) | 1/1 |

## Validation

- `node --experimental-strip-types --test --test-name-pattern memorial tests/pinch-catalogue.test.ts`: 3/3 tests pass. They verify all scene keys, original adjacent-link identity, explicit valid arrival views/labels, seam-safe polygons, and selectable interiors through the actual picker.
- `python E:/CodexAssets/youngnak-pinch-qa/memorial/validate.py`: 29 scene keys, 67 original links, 64 unique valid regions, exactly three declared omissions; all 17 independent object hotspot anchors excluded; no pair of passage regions overlaps on the 0.25-degree diagnostic sample grid.
- This catalogue review uses source-image diagnostics. Browser multi-touch behavior, popup protection, history restoration, and physical-device behavior are validated by the parent integration/QA task rather than claimed here.

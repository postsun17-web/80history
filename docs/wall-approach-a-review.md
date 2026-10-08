# A viewpoint wall calibration

Reviewed 2026-10-08. `src/data/wall-approach-a.json` covers all 12 original `tour.xml` A viewpoints with 109 regions and 22 explicitly identified source-image surfaces. The original `full-museum.json`, panorama assets, controls, and exhibit objects were not edited.

## Evidence and method

- Rendered every A cubemap using `python tools/render_wall_calibration.py --prefix scene_a` and visually inspected all 12 complete angular atlases.
- Authored the visible A wall outlines against the 15° yaw / 10° source-atv grid. Black columns, marble plinths, floors and door openings remain outside those outlines. Several lower edges have notches around photographed people.
- Rendered the authored regions with `--regions E:/CodexAssets/youngnak-wall-qa/a-regions.json` and visually inspected every outlined atlas, then re-rendered and rechecked changed views.
- For atrium introduction signs and TVs, projected the original image corners using the same edge, natural dimensions, scale, rx/ry/rz and 500-unit convention as `source-projection.ts`. The region hull joins only the sign and corresponding TV. This corrected initial envelopes that included adjacent doorway space.
- Cross-room B/C labels were checked with the B/C calibration owner against that room's complete atlases. D portal patches are separate wall sections between the white framing; enlarged portal crops confirm the identities. Lobby timeline and event IDs were confirmed with the D/E/F calibration owner.

## Coverage

All six A displays are mapped when visible from another A front or centre viewpoint. A target's own viewpoint deliberately has no approach polygon for that target, preserving its existing near content interaction.

| Source viewpoint | Regions | Additional visible destinations beyond A displays |
| --- | ---: | --- |
| `scene_a-c-0` | 10 | D05, D02, D04, north D introduction |
| `scene_a-c-e+1` | 8 | D05, D02, north D introduction |
| `scene_a-c-n+1` | 12 | All five D displays, north D introduction |
| `scene_a-c-w-1` | 8 | D02, D04, north D introduction |
| `scene_a-n-0` | 10 | D05, D02, D04, north D introduction |
| `scene_a-n-e+1` | 9 | D01, D05, D02, north D introduction |
| `scene_a-n-w-1` | 8 | D02, D04, D03; already at north D introduction |
| `scene_a-s-0` | 10 | B02, C02, D05/D02/D04, info-B/C, lobby timeline/events, north D introduction |
| `scene_a-s-e+1+` | 8 | D05, D02, north D introduction |
| `scene_a-s-e+1` | 9 | B02, C01/C02/C03, info-A/B/D, lobby timeline |
| `scene_a-s-w-1+` | 8 | D02, D04, north D introduction |
| `scene_a-s-w-1` | 9 | B01/B02/B03, C02, info-A/C/D, lobby events |

## Destination and occlusion decisions

- `a02` through `a07` use the original zone scene and menu look without inventing a camera position.
- `info-d-north` is the physically distinct introduction wall beside the internal A-to-D portal. Its front is `scene_a-n-w-1`, look `[-3, 0, 110]`. It must not be conflated with the atrium-facing `info-d` target in `scene_a-s-0`.
- Cross-file references are `b01/b02/b03`, `c01/c02/c03`, `d01..d05`, `info-a/info-b/info-c/info-d`, `e-timeline` and `e-events`.
- In `scene_a-s-0`, most A timeline walls are hidden behind the entrance partitions. They are not given imaginary clickable rectangles. The real narrow sightlines into D, B and C remain separately mapped.
- Doorway sightlines can be only a few degrees wide. Their regions stay within the actual visible upper wall panels; the door frame and floor do not become navigation regions.
- Source panoramas omit the current exhibit's dynamic page and some dynamic signs. The page is intentionally left to the near interaction. Dynamic introduction surfaces and `map_8` use their original source geometry. The identified opposite event wall is limited to its upper exhibit-facing portion, above the photographed person.
- Freestanding objects and source page/video controls are never listed as wall surfaces. TV source image names are listed, allowing the runtime to distinguish the wall image from explicit video controls.

## Verification and artifacts

Data validation passed: exact set of 12 A source scenes; finite polygons with at least three vertices; local yaw spans below 180° (seam polygons use unwrapped yaw); no target links to its own front scene; every surface name exists in the source scene; no arrow/page/object names in surfaces. `git diff --stat -- src/data/full-museum.json public` was empty.

Evidence directory: `E:/CodexAssets/youngnak-wall-qa/`.

- Original images: `scene_a-*.jpg` (12 complete atlases).
- Reviewed outlines: `scene_a-*-regions.jpg` (12 complete atlases).
- Enlarged doorway evidence: `scene_a-c-0-portal.jpg`, `scene_a-c-e+1-portal.jpg`, `scene_a-c-w-1-portal.jpg`, `scene_a-s-0-portal.jpg`, `scene_a-s-e+1+-portal.jpg`, `scene_a-s-w-1+-portal.jpg`.
- North introduction detail crops: `scene_a-c-0-north-info.jpg`, `scene_a-c-e+1-north-info.jpg`, `scene_a-s-e+1+-north-info.jpg`.
- Scene-only render input: `a-regions.json`.

This review validates calibration data and source geometry. Runtime click arbitration and end-to-end browser navigation are owned by the integration task.

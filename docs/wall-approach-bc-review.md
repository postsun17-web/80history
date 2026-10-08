# B/C wall approach calibration review

Reviewed 2026-10-08. Catalogue: `src/data/wall-approach-bc.json`.

## Evidence and method

All 18 history (`tour.xml`) B/C source viewpoints were rendered from the original cubemap bases with `tools/render_wall_calibration.py`, and **every original atlas and every final outlined atlas was viewed**. Atlas coordinates are yaw -180..180 and source atv -40..40; output is 2880x640 with 15-degree horizontal and 10-degree vertical guides. Coordinates were authored from visible wall edges and content faces, not arrow bearings. The original data and assets were not changed.

Evidence directory: `E:/CodexAssets/youngnak-wall-qa/`. For each source ID in the table below, `<scene>.jpg` is the original atlas and `<scene>-regions.jpg` is the final reviewed outline. `bc-regions.json` contains the scenes-only render input. Source cubemap rasterization is a diagnostic aid; source zone/menu values remain authoritative for destinations.

The ten B/C destinations exactly copy the corresponding `full-museum.json` zone scene, Korean title, and menu look. `e-events` and `e-timeline` resolve through the DEF catalogue. Opposite-room wall identity was checked against `scene_a-s-w-1.jpg` and `scene_a-s-e+1.jpg` and coordinated with the A calibrator: the white wall opposite the B corridor is **c02**, and the white wall opposite the C corridor is **b02**.

No B/C source scene contains a far `pannelspot` or `tvspot` wall-image marker. The only `pannel` markers are each source's own `sector_*` panel. Consequently these entries need no `surfaces` override. Own destination panels are deliberately absent from approach regions so their existing near opening/page behavior remains available. Source arrows, page controls, and `object_obj` markers remain independent.

## Coverage ledger

| Source viewpoint | Approach targets (count) | Visible boundaries and exclusions checked |
| --- | --- | --- |
| scene_b-c-n+1 | b03, b05, b01 (3) | Own b04 omitted. b03/b05 below their lintels; south b01 crosses the atlas seam. Brown dividing column, vase, and right bench stay outside. |
| scene_b-c-n-0 | b03, b04, b05, b01 (4) | Three north faces plus south seam face. b04 has a person notch; b03 has a vase notch. Left column and right bench remain outside. |
| scene_b-c-s-0 | b01, b02, b03, b04, b05, e-events (6) | South b01 seam, west b02, narrow b03 beyond column, distant b04, b05 title/photo section, and lobby event face. Excludes round plinth, large dividing pillar, bench, child, and striped entry column. |
| scene_b-c-s-1 | b02, b04, b05, c02 (4) | Own b01 omitted. b03 is hidden by the dividing column. Opposite c02 is clipped to the small visible portal face. Blank entry-panel backside and passage floor are excluded. |
| scene_b-e-s+1+ | b01, b02, b03, b04, b05 (5) | All five B content walls visible. South b01 wraps the seam; b03 vase excluded. Large foreground bench and the blank object-display wall are outside. |
| scene_b-e-s+1 | b01, b02, b03, b04, b05, c02, e-events (7) | All B faces, small c02 portal face, and oblique lobby event face. Stops before portal slats and striped columns; lobby lower boundary stays above the distant figure. |
| scene_b-n-e+1 | b01, b02, b03, b04 (4) | Own b05 omitted. Narrow b02 is visible left of the dividing column. b03 vase and b04 edge figure are excluded. |
| scene_b-n-w-1 | b04, b05, b01 (3) | Own b03 omitted. b02 hidden behind the west divider. b04 person notch; b05 ends before the child/bench section. |
| scene_b-w-s-1 | b04, b05, b01, c02 (4) | Own b02 omitted and b03 occluded. Tiny b04 segment starts past the central brown pillar. b01 starts beyond the striped column/plant; opposite c02 stays within its portal. |
| scene_c-c-s-1 | c02, c04, c05, b02 (4) | Own c01 omitted. c03 is occluded by the central white column. c05 starts beyond the bench; c04 has a figure notch. Opposite b02 confined to the far portal. |
| scene_c-s-e+1 | c01, c05, c04, b02 (4) | Own c02 omitted. c01 stone face crosses seam; c05/c04 avoid both foreground and distant figures. White central column and side bench excluded. |
| scene_c-n-e+1 | c01, c05, c04 (3) | Own c03 omitted. c02 is hidden by the east structural mass. c01/c05 figure notches and c04 vase notch verified. |
| scene_c-n+1 | c05, c03, c01 (3) | Own c04 omitted. c05/c01 figure notches. c03 outline follows white content face below trim and excludes nearby vase and pillar. |
| scene_c-n-w-1 | c04, c03, c02, c01 (4) | Own c05 omitted. c04 figure notch, c03 child notch, narrow c02 beyond central pillar, distant c01 seam face. Bench excluded. |
| scene_c-c-s-0 | c01, c02, c03, c04, c05, e-timeline (6) | All C faces plus colored lobby timeline. c03 narrow sliver ends at the central pillar; c04 figure notch; c01 stops before portal plant/figure; round plinth and foreground man outside. |
| scene_c-n-0 | c05, c04, c03, c01 (4) | Three north faces and south c01 seam. c02 hidden by central white column. Person notches on c04 and both c01 seam edges; c03 kept below white trim. |
| scene_c-s-w-1 | c05, c04, c03, c02, c01, e-timeline, b02 (7) | All C faces, lobby timeline, tiny opposite b02 portal. c01 follows stone face above floor with seam figure notch. Bench, central column, striped portal column and plant excluded. |
| scene_c-s-w-1+ | c05, c04, c03, c02, c01 (5) | All five C faces. c05 is a narrow oblique title/content section beyond the large foreground bench. c04/c03/c02/c01 figure notches, central pillar excluded. |

The blank ivory faces immediately outside the B/C entry slats were cross-checked with the A calibrator: they are the backsides of the lobby-facing info-b/info-c panels. They have neither visible content nor corresponding B/C wall-image markers, so they are not assigned misleading info destinations.

## Verification

- 18 source scenes exactly match all B/C `tour.xml` source scene IDs; 80 polygons total.
- Ten destination scene/title/look triples match original zone/menu data exactly.
- No scene has an approach polygon whose destination is that source scene.
- Every polygon has at least three finite coordinate pairs. Seam polygons use continuous unwrapped yaw values rather than a 360-degree edge.
- A ray-cast check across all B/C polygons found **zero intersections with independent `object_obj` hotspot centers**. Full object behavior remains the runtime's responsibility; no object marker was added to a `surfaces` list.
- Final outline pass narrowed regions around pillars, benches, vases, people, and white trim. No regions were added over navigation arrows or floor.
- `git diff --numstat -- src/data/full-museum.json public` returned no changes.

Reproduce outlines from the scenes-only temporary JSON:

```powershell
python tools/render_wall_calibration.py --prefix scene_b --regions E:/CodexAssets/youngnak-wall-qa/bc-regions.json
python tools/render_wall_calibration.py --prefix scene_c --regions E:/CodexAssets/youngnak-wall-qa/bc-regions.json
```

Catalogue/data checks were run with `E:/CodexAssets/youngnak-wall-qa/validate-bc.py`. Runtime click-flow integration is handled by the main implementation; this review records visual calibration and source-data consistency.

# Full museum restoration

User objective: reproduce every visitor-facing screen and content of http://youngnakdhm.net on Vercel, retaining the original appearance with modest usability improvements. Reuse delivered sources and ZIP. Provide a visually comparable chatbot shell where backend content is absent. Preserve the approved synthetic E extension with distinct scene_ext-* IDs.

## Evidence and scope

Source text cache: .cache/full-source. Inventory: .cache/full-rebuild-inventory.json and .md. Archive is authoritative because loose delivered files include incomplete and empty entries. Source content comprises 62 original panorama viewpoints, 21 exhibit zones / 207 pages, 42 photo galleries / 598 scenes, 224 articles, 55 YouTube videos, 16 external object spins, 3 local object spins, 29 ebook cards, help, desk audio and media-center screens. Do not equate existing 9-view PoC with completion.

## Implementation tasks and interfaces

1. Compile original XML/HTML to src/data/full-museum.json conforming to src/full-types.ts. Preserve original hotspot attributes, polygon points, page visibility and actions as inert data. Lowercase scene IDs; retain source filename case. Include all menu entries, original global panel overlays and additional synthetic E scenes.
2. Generate optimized standalone assets directly from ZIP. URL convention: original images become /media/full/<original-path>.webp (retain original extension); nonimages keep original path. Full panoramas use /media/full/panos/<lowercase-scene-id>/<f,b,l,r,u,d>/base.webp and /2/<row>_<col>.webp, faceSize 2048, tiles 4. Gallery images use /media/full/galleries/<gallery-id>/<zero-based-index>.webp. Article HTML at /media/full/<original-path>; sanitize active scripts without losing prose and images. Do not copy administration credentials or CMS code. Existing approved E assets remain /media/v1.
3. Extend PSV renderer to source-defined scenes, image planes, polygons, navigation and page hotspots. Decode known actions explicitly; never eval krpano action strings. Add image/video/article/gallery/object/audio popup renderers.
4. Restore original translucent 70px header with six menus, left floorplan, right quick controls, intro, responsive menu and original panel pagination. Offer keyboard/focus handling and readable content dialogs.
5. Verify inventory coverage against runtime/source references, all local assets, route history, scene navigation, popup types and representative views in a real browser. Compare rendered screenshots with live reference. Address differences rather than redefining scope.
6. Deploy validated full restoration to existing Vercel project and verify public routes. Update source copy and documentation. GitHub remains unconfigured; do not invent a push destination.

## Constraints and validation

Current worktree: C:/Users/user/Projects/youngnak-e-room, branch feat/full-museum. Primary master contains unrelated audit work; preserve it. Free disk about 3GB; avoid full 16GB ZIP extraction. Shared contract full-types.ts is owned by coordinator; compiler owns full-museum.json; asset builder owns public/media/full; dialogs own full-content.ts; coordinator owns renderer/main/navigation/styles integration.

Tests must exercise actual parser boundaries (numeric gallery indices, plus-sign scene IDs, page bounds, action decoding), not assert invented coverage totals. Complete only after every source visitor-facing content category has a verified implementation and no unexplained missing references.

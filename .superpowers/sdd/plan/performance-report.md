# Performance implementation report

## Interfaces and behavior
FullViewer.setQuality(mode: 'auto'|'high'|'economy'): Promise<void> and destroy(): void. Explicit high/economy wins. Auto uses economy for saveData/2g and1024 for narrow viewport, <=4GB deviceMemory or3g; desktop auto uses source fullresolution. Mid faces exist for all62 source2048panoramas; two existing E-extension1024panoramas retain originals. Economy requests six existing base faces only (E source bases are already1024). Tile mapping retains source f/b/l/r/u/d, source row/column and original flipTopBottom policy.

show() relies on PSV documented setPanorama cancellation plus own latest generation; pending-scene tracked so returning to prior scene aborts an in-progress replacement too. Auxiliary image/video metadata requests have abort signal and page-generation guard. Independent marker completion no longer waits whole Promise.all barrier. Scene movement markers and page controls appear immediately (page/scene image-backed controls use source-position provisional buttons until actual icons arrive). Stale source/page media cannot add markers to another route. Panorama readiness is independent of optional markers. destroy aborts dimensions requests, cancels timers, stops marker videos, disposes PSV. Reduced motion disables fade and marker autoplay. Next scene has a1800ms idle-style delay prefetch of six base faces only; economy/saveData disable it. No all-scenes/detail-photo prefetch.

visitor-media.ts exports previewUrl(original), thumbnailUrl(original), midPanoramaFaces(scene), useMediaPreview(image, original, thumbnail=false). Derivative404 retries the original image. UI uses thumbnail helpers; reader cards and article pictures use helper. FullContent gallery/image opens1280 preview first and explicit 원본 확대 보기 loads original through lazy OpenSeadragon. Existing source warnings/recovery collections retained. Cubemap content imports PSV/cubemap only for relevant item. Import/image failures now show readable retry controls. Article fallback iframe remains connected and hidden while photo body is shown, preserving document and image-link handlers; return restores old body/focus/scroll. Reader mobile controls now have full-width return then compact44px font settings.

## Reproducible media and evidence
Command: python tools/build_visitor_media.py --source E:/CodexAssets/youngnak-full. Source directory is read-only in workflow; script writes only public/visitor-assets/version, src/data/visitor-media.json and docs/visitor-experience/media-metrics.json. Originals, source museum JSON and deployment asset manifest were unchanged. Version8226aa914387cb84 derives from source content hashes and generation settings. Pillow1024 panorama face downsamples assemble original tiles without rotations. Source galleries get360 thumbnails and1280 screen previews.

1566 files,100076464 bytes (95.44MiB) added:372 midfaces for62panoramas and597 preview/thumbnail pairs. No skipped gallery source. Original2048 tiles142335685 bytes; generated1024 faces23220002 bytes. Top10 largest photos sum31599576 originalbytes,2367468 previewbytes (92.51% reduction) and239842 thumbnailbytes. All individual inputs/dimensions/preview andthumbnail bytes are in docs/visitor-experience/media-metrics.json. Original largest4.29MB preview310126bytes. Lazy original zoom retains source resolution; no deepzoom tiles created because screen preview is sufficient and original is requested explicitly.

Request maxima per2048scene: source high six bases plus up to96 detail tiles (viewport subset); mobile mid six bases plus up to six1024faces; economy six base URLs reused as tiles. Gallery initial preview one request, explicit original adds one request. Metrics are asset byte/request structure evidence, not claims about measured network latency.

vercel.json immutable cache applies versioned visitor-assets only; existing /media/full revalidation retained.

## Verification
- npx tsc --noEmit: passed after final manifest generated.
- npm test:60/60 passed after final generation.
- targeted visitor-loading/visitor-media/visitor-reader tests:7/7 passed after stricter complete-gallery coverage assertion.
- Pillow inspected all1566 assets: all panorama faces1024 square; all previews<=1280; all thumbnails<=360; no errors.
- Root owns browser integration QA and final build on E; no local full asset-copy build or deployment performed.

## Remaining limits
Generated source galleries have preview coverage; article images and non-gallery source media fall back to existing original when no derivative exists. No new visual claims or fabricated assets. Dynamic import failure retry displays useful controls; actual forced-network failure and slow-navigation browser paths remain root QA. Bounded device quality is selected when panorama loads; current panorama does not rebuild merely on resize. Original source next-room bases for approved E are1024 rather than512.

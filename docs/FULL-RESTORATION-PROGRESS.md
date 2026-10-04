# Progress — plan: docs/FULL-RESTORATION-PLAN.md

- Prior goal turn: evidence progress. Original inventory established, live reference inspected, and latest approved E deployment independently verified on the existing production domain. Full restoration has not yet been implemented.
- 2026-10-04: existing isolated worktree verified at 025a9c7; baseline 10 tests passed before expansion. Data contract and implementation plan recorded.
- Shared-interface review: compiler and asset builder use identical deterministic paths recorded in plan; renderer and content dialog consume full-types.ts. Scene IDs normalized lowercase; original asset paths retain case. Avoid emitting active original action code.
- Tasks 1–4: in progress.

## 2026-10-04 implementation checkpoint

- Existing production alias remains the approved E-room deployment `dpl_7dAHk54VHkWbzCSjtErkfPhv9jDM`; no Git remotes exist and nothing was pushed to GitHub.
- Full catalogue: 64 scenes (62 original + 2 synthetic E), 21 zones / 207 pages, 43 galleries / 603 items, 224 articles, 29 ebooks, 55 YouTube videos, original page controls and media actions.
- Full PSV renderer, original menu/map/quick controls, route history, source-plane projection, readable content dialogs, article sanitization, object spins and chatbot shell implemented. Flat source geometry is preserved instead of PSV spherical corner normalization.
- Source typo `images/obob002-3.png` repaired by explicit asset alias to existing `images/ob002-3.png`; original hotspot attributes retained. Evidence and regression are in compiler/verifier.
- All panoramas, galleries, article content, narration, object frames and almost all static panels have been generated. Builder final audit is still running; do not equate file generation with full verification.
- Generated assets physically live at `E:/CodexAssets/youngnak-full`; worktree `public/media/full` is a directory junction. Original ZIP and previous E-render intermediates remain untouched. C disk is constrained; stage build/deployment on E.
- Vercel Hobby source upload limit is 100MB. Public Blob store `youngnak-museum-assets` (`store_O1xU03DVGtJMfWC2`, icn1) created and linked to the existing project. No paid plan change. `.env.local` is ignored and must not be printed or deployed.
- Added content-addressed asset ZIP packaging and SHA256-checked build restoration. Active-only manifest was ~730MiB before final panels, versus ~900MiB generated folder. Archives will be uploaded after complete asset audit, and deployment source will omit public/media.
- 31 Node tests and TypeScript check passed before latest E-layout helper (its focused test also passes); 9 compiler tests pass. Added archive corruption/traversal/omission checks.
- Browser checked original-style A02 alignment, photo gallery advance, ebook cards/music categories, article content, local object frames, C-to-E navigation. Help narration now retains playback position across pages.
- Remaining: finish final asset audit; investigate apparently blank c03 cube source; move C02 panel and controls together beside E doorway; verify all main flows/mobile; package/upload assets; build and deploy preview on E; compare public preview then promote; final verification and explicit source commit. Goal remains active.

## Release preparation

- Final active manifest: 8,028/8,028 files present and SHA256-verified, 807,639,053 bytes (770.22MiB). Zero unknown actions, missing files, or source-structure mismatches. All 8,256 generated WebPs decode; 25 copied media files match ZIP CRC.
- 20 gallery slots are pure-white in all 131 original input tiles, including six C03 raw JPEGs. The initial request for 6 missing C03 photographs was superseded by the cross-gallery re-audit below; blank files do not establish missing subject matter. Before recovery, 578 of 598 catalogue slot images were nonwhite, plus 5 help images.
- Nine content-addressed archives uploaded successfully to the public `youngnak-museum-assets` Blob store. `deployment-assets.json` records every URL, archive/file SHA256, source catalogue hash. Total assets remain below the Hobby 1GB included storage allowance. Source upload excludes all media and environment files.
- Staging directory: `E:/CodexAssets/youngnak-full-deploy`. Asset restoration verified all 8,028 paths/hashes and local production build succeeded. Build has a nonfatal large-JS-chunk warning (about 395KB gzip); no compile errors.
- Independent reviews found/fixed stale entrance-animation navigation, wrong media-wall aspect, missing outdoor labels, and desk-video controls. A06/A07 grouped page controls are being matched to original action XML before preview deployment.
- Browser checks additionally confirmed opening-door video and lobby transition, C02 panel relocation clears E doorway, mobile D-menu navigation, local articles/image zoom, object frames, gallery URL/back restoration, and help narration continuity.
- Production remains old approved E release until this full version is deployed and verified. No GitHub remote/push. No paid plan change.

## Final validation and production candidate

- All 64 scenes loaded through actual browser UI navigation. Grouped A06 page15 screenshot confirms nonoverlapping source buttons. Controlled D-video dialog reports controls=true, readyState=4. YouTube media-wall action loads its actual video player. Entrance interrupted by C navigation remains in C after 12.5 seconds.
- Rapid-navigation regression: after retaining awaited marker images for only the current scene/page and catching local video-play cancellation, a fresh browser traversed 18 A/D scenes with zero browser errors. No global error suppression.
- Independent release review found no remaining major issues after grouped controls, exterior labels and desk-video controls were restored.
- Latest source checks: 41 Node tests, 9 Python compiler tests, TypeScript and diff whitespace checks pass. Source catalogue SHA normalizes CRLF/LF so a Linux Git checkout restores the same verified archives.
- Production candidate `dpl_7HcBjnhPxsedqtGEZLk3qNcJL9U1`, preview `https://youngnak-museum-2pzrfo7of-postsun17-webs-projects.vercel.app`, built successfully on Vercel after verification of all 8,028 assets. Entry JS `index-Cbhdg7PH.js`.
- Promotion to the existing domain has been issued; public verification remains before completion.

## Production release confirmed

- Fixed domain `https://youngnak-museum-poc.vercel.app/` now serves `index-Cbhdg7PH.js` from production deployment `dpl_8FnXcB3ANFnHDAR3jWYXmXMZgFat` (`https://youngnak-museum-bu8rhvvrq-postsun17-webs-projects.vercel.app`). Vercel promotion rebuilt the preview under production environment, then attached existing aliases.
- Public unauthenticated HTTP checks returned 200 for entry HTML, A06 panel, article, gallery image, exterior panorama and 12.9MB PDF. Browser opened the actual C02 production room successfully.
- Implementation commit `1cbfe5b` was fast-forwarded into primary `master`; unrelated README/audit working files remain untouched. Git remotes remain empty and there has been no GitHub push.

## Source blank-slot re-audit and recovery (2026-10-04)

- Directly re-read and CRC-verified 244 selected delivered ZIP entries. Core audit covers every resolution/preview/thumb and matching original for all 20 blank slots: 204 images pure white. Additional candidate reads stopped on Google Drive storage error with two candidates explicitly unverified, not classified as missing.
- Cross-gallery comparison found matching images for c03:7/8/12. c03:9/10/16 now show related source photo groups of 3/3/5 items, preserving original indices and navigation. These groups supplement content rather than claim exact recovery of unspecified originals. WCC date inconsistency is disclosed on both source and recovered routes.
- Remaining 14 slots are verified empty but lack active direct panel links or identifiable missing subjects. Required additional photo requests: zero under the user's content-availability criterion. Details and reproducible evidence are in SOURCE-DEFECTS.md and source-reaudit/.
- 45 Node tests and TypeScript pass. Production build restored and verified all 8,028 assets. Public production dpl_6bq1fh7L2Zu5TEQ2UznxvJtmJKXV, URL https://youngnak-museum-rioaqrfg1-postsun17-webs-projects.vercel.app, now serves index-BgaYrZ4W.js at the existing https://youngnak-museum-poc.vercel.app/ domain.
- Browser verified all six recovered routes, source images and collection counts, WCC notice, photo selection and previous/next; mobile 390x844 collection has no horizontal overflow. Existing nonfatal Vite chunk-size warning remains.
- Captures: 20 before, 17 context panels, 6 after, plus one original-site blank screenshot. Portable report: G:/내 드라이브/영락역사관/결손재검증_2026-10-04/index.html. No original delivered files modified; no GitHub remote or push.

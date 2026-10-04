# Visitor UI integration report

Implemented in src/full-main.ts and src/full-style.css:

- Static entrance shell before lazy museum JSON. Fresh visits offer direct lobby entry, text/photo reading, validated resume and optional exterior. Repeated entry clicks deduplicate immediately. No entrance animation or automatic audio.
- FullViewer and FullContent are dynamically imported; reading constructs only VisitorReader. Switching to read destroys the existing viewer immediately, preserving page/look. Tour loads serialize and generation guards discard stale completions; read does not wait for tour work.
- Four visitor menu buttons, grouped 64-space selector, current location/topic/page status, page selection, previous space/lobby/next exhibition, original menus/quick actions/media shelf retained. Help and search replace disconnected chatbot presentation.
- Lazy article search with room/kind filters, snippets, separate read/tour choices. Material cards use source titles, type/location, derivative thumbnails with original fallback. Empty rooms provide a reading action.
- Reader key tracks base article, location and size; opening/closing a photo overlay preserves reader DOM and scroll. Native dialogs support Escape/focus return. FullContent font size applies before opening.
- Preferences validate routes/bookmarks against current catalog, persist navigation/pagehide, support 18/21/24 text, auto/high/economy quality, share with manual copy fallback, bookmarks and curated course progress/next step. More contains help/audio/fullscreen for mobile and read mode. BGM Audio created only on explicit play, preload none.
- Warm readable responsive panels, bottom safe area, touch controls, reduced motion styling. Original scene data, polar flip, C/E links and noindex untouched.

Verification:
- npx tsc --noEmit passed before media helper integration. Final rerun currently has only TS2307: performance-generated src/data/visitor-media.json is not yet present; root will rerun once generation completes.
- npm test: 52 tests passed, 0 failed (catalog/search/preferences/navigation/reader/source behavior).
- No full build on C disk and no deployment performed. Root owns browser validation and build on E.

Concerns / follow-up:
- Required viewport visual checks are pending root browser QA. UI responds independently from panorama loading; no official SEO launch.
- Image previews depend on worker-generated derivative index; helper falls back to original source.

Additional review fixes: welcome is native modal dialog with initial focus, boot failures provide visible retry, direct room shortcut grid precedes collapsed complete scene groups, More includes mobile help/audio/fullscreen.

Correctness follow-up: page changes capture live camera look; previous-space route updates only when scene changes and clears media overlays; course progress recognizes material actions and retains the last selected course step after overlays close.

Read-page integration: previous/next page arrows and page selector remain available in read mode without constructing FullViewer; reader scroll viewport reserves their fixed footer. Current material/course lookup now prefers matching scene/page action context after data context IDs were introduced.

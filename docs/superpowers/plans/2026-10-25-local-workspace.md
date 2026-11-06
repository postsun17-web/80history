# Local museum workspace recovery plan

> Restore the current production source and make it editable from this Google Drive folder. Run local setup and verification in this session; do not release a changed production website as part of setup.

**Goal:** A documented, tested Windows workflow from `museum-web` to local preview, build, and explicit Vercel deployment commands.

**Source:** `postsun17-web/80history` main `bdeb3d2139aec34183f3688b31d759752f1f938e`; runtime equals production commit `c6eb8f2f142f8acd8a04b28438eba30b97e4e2fa`. Deployment `dpl_4DB7s9th9xw6RBWfC5PcjvL1515h`.

**Architecture:** Keep canonical editable source and Git history in `G:/내 드라이브/영락역사관/museum-web`. A local helper synchronizes explicit source paths to `E:/CodexAssets/youngnak-workspace/source`, where dependencies, verified public media and build output live. Keep the web application code, dependency lock and production build configuration unchanged. Local toolchain lives alongside that staging folder. Both locations are recorded in the guide.

**Reference:** `E:/CodexBackups/youngnakdhm-2026-10-12` is the 2026-10-12 vendor krpano site snapshot, referenced against `http://youngnakdhm.net/`. It is not the Vercel source. Keep the backup intact and out of deployment files.

## Constraints

- Existing source copies and vendor originals remain available.
- Use exact lockfile dependencies; compare the rebuilt JS/CSS hashes with production.
- Sync source edits and removals; reject symlinks and paths outside the dedicated staging directory. Never remove arbitrary user paths.
- Source sync excludes `.git`, `.env*`, external backups, dependencies, build output, and old public media. Restore media only via the checked asset manifest.
- Local commands default to checks/preview; deploy commands must explicitly select preview or production and verify the target team/project.
- No credentials in source, guides, or logs. CLI sign-in status is separate from browser sign-in.
- Do not deploy merely to prove local readiness; report any remaining authentication requirement accurately.

## Work

- [x] Locate exact production commit, recover repository and collect deployment evidence.
- [x] Add Windows entry point and source-sync helper; test stale-file removal, traversal/reparse rejection and allowed-copy behavior before implementation.
- [x] Prepare local Node/npm/Vercel tools, synchronize source, install locked dependencies and restore/verify the 66,557 media assets.
- [x] Run existing tests, TypeScript/Vite build, production asset hash comparison and browser checks for both museums.
- [x] Document commands, canonical edit locations, vendor baseline, source provenance and authentication state; perform an independent review.

## Completion evidence

Store source identity, test/build results, live bundle hash comparison and the vendor reference metadata in `docs/workspace/`. Keep large assets and transient logs on E:.

Completed evidence is in `docs/workspace/verification-2026-10-25.md`. Real Windows checks led to bounded parallel media reads, dev-only validated stamp reuse, atomic source publication, and a command mutex. Tests: 175/175 plus 5 process-lock checks. Full build and all three production bundle comparisons passed. CLI authenticated and project access verified; no deployment performed.

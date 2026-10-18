# Launch tasks (static site on Cloudflare Pages)

Goal: OddsRider ships as a static site on Cloudflare Pages. No backend, no accounts, no money features. One task per session; tick the box when the checks pass and leave 2-3 lines in Notes.

## Rules

- `pnpm build`, `pnpm test` and `pnpm test:smoke` must pass after every task.
- Changes under `src/game` must be additive files only. Never edit existing physics, tuning, colliders or step logic.
- Keep machine load low: timeout on every command, browser runs under 60 seconds, no long dev-server sessions, kill servers and browsers when done.
- No backend, no accounts, no money features. The browser still talks to no source but our own frozen `/tracks/*.json`.

## Tasks

- [x] 1. Sensitive markets: ingest excludes markets about deaths, wars, attacks, disasters and individuals' health, using a keyword/tag filter plus a manual blocklist file (`data/blocklist.json`). Remove any existing frozen tracks that match.
- [x] 2. Loading and errors: asset preload progress bar, an offline/failed-load screen with Retry, and an empty state when no tracks load.
- [ ] 3. Accessibility: a reduced-motion toggle (turns off screen shake), arrow glyphs beside the green/crimson up/down cue, and keyboard focus styles.
- [ ] 4. Legal: simple `/privacy` and `/terms` pages linked in a small footer. Plain text "Data: Polymarket" with no links and no trading promotion anywhere.
- [ ] 5. Analytics: a cookie-free GoatCounter script that loads only when `VITE_GOATCOUNTER_URL` is set.
- [ ] 6. SEO: page titles and meta descriptions per route and per track, and a `sitemap.xml` generated at build time from the frozen tracks.
- [ ] 7. Phone: Playwright smoke also runs at 390x844, zero console errors.
- [ ] 8. Deploy: `public/_redirects` containing `/* /index.html 200`, `pnpm build` outputs to `dist`, and a `DEPLOY.md` with exact Cloudflare Pages settings (build command, output folder, Node version, env vars).
- [ ] 9. README: what OddsRider is in two lines, screenshots of the title screen and the result screen, and how to run it.

## Notes

(each session adds 2-3 lines here: what was done, files touched, anything the next session must know)

- Task 1 done: `packages/core/src/banned.ts` gained a validated manual blocklist (`parseBlocklist`, `isBlockedMarket`, `blockedReason`) layered on the keyword/tag filter; `scripts/ingest.ts` reads `data/blocklist.json` (default path, `--blocklist <file>` to override), prints why each market is skipped, filters live **and** closed candidates, and `planIngest` now prunes frozen tracks the filter names.
- Removed the matching frozen tracks: deleted `public/tracks/4641065-8a706329495e.json` and `4641065-98e51a870b2f.json` (US x Iran ceasefire, blocklisted by sourceId/slug/question) and their index entry — manifest is 13 tracks. `packages/core/src/banned.test.ts` now pins the committed `data/blocklist.json` against every file in `public/tracks/` and the index, so this cannot regression.
- Checks: `pnpm build` clean, `pnpm test` 201 passed, `pnpm test:smoke` 6/6 (47.8s). Heads-up for the next session: `public/tracks/` still contains three pre-sports-filter snapshots (Sunderland/Leverkusen/Ajax) that the index does not list; `readExistingTracks` would re-list them on the next ingest. Deleting those files is the fix — out of scope for task 1.
- Task 2 done: the Phaser stage is now gated by a real preload. New additive `src/game/assetPreload.ts` warms the five BootScene sprites and reports settled/total (`preloadGameAssets`); `src/components/GameStage.tsx` + `src/components/PreloadBar.tsx` (role=progressbar, aria-valuenow) replace the lazy `<PhaserGame>` on Title and Ride, so the bar tracks requests instead of a timer. No existing `src/game` file was touched (`git diff v2 --numstat -- src/game` → 0).
- Feed states are now separated instead of conflated: `src/data/feedState.ts` (+ `feedState.test.ts`) owns the copy for offline / unreachable / unreadable / empty, rendered by `src/components/LoadStates.tsx` (crimson alert with Retry for failures, neutral card for empty) on Title, Tracks and Daily — Daily previously showed "INDEX UNREACHABLE" for an empty manifest. RidePage's failure toast became a full-screen Retry panel that re-runs the fetch.
- Checks: `pnpm build` clean, `pnpm test` 208 passed (16 files, +7 new), `pnpm test:smoke` 6/6 (55.0s). The smoke 503 case now asserts the outage screen (it used to assert "no tracks published yet", which was exactly the confusion task 2 fixes) and the empty-index case asserts the outage/offline copy is absent. Verified in a real headless browser: request-throttled `/ride/:id` shows aria-valuenow climbing 0 → 20 → 100, bar clears before the canvas, zero console errors; offline UI reads `navigator.onLine`, so it recovers when a connection returns.

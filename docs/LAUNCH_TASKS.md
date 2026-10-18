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
- [x] 3. Accessibility: a reduced-motion toggle (turns off screen shake), arrow glyphs beside the green/crimson up/down cue, and keyboard focus styles.
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
- Task 3 done: `src/data/motion.ts` (+ test) owns one persisted preference — the OS `prefers-reduced-motion` setting is the default, the rider's choice (`oddsrider_reduced_motion`) wins — and mirrors it onto `<html>` as `data-reduced-motion`; `src/components/MotionToggle.tsx` is the switch in `TopStrip`, `src/App.tsx` applies it once at the root (so `/ride`, which has no TopStrip, gets it too) and follows the OS live until a choice is stored. `index.css` now kills `.rise`/`.shimmer`/`.prompt-pulse`/`.animate-pulse` under that attribute and adds one keyboard ring to every control via `:where(...):focus-visible`.
- Screen shake: the tree has **no** `cameras.main.shake` call left (the BikeParticles-era shake went with the CyberEffects rewrite), so the shake path is now gated additively — `src/game/motion.ts` (+ test) wraps Phaser's camera `shake` and no-ops it while motion is reduced, installed from `GameStage.tsx` with a dynamic `import('phaser')` so Phaser stays out of the main bundle. No existing `src/game` file was touched: `git diff v2 --numstat -- src/game` is additions only (four new files, zero deletions). Momentum arrows are the `↑`/`↓` that Anton's self-hosted unicode-range already covers (task 2 added U+2191/U+2193): `momentumGlyph` in `tracks.ts`, rendered by `MomentumCue.tsx` on Title / Tracks / Daily; an unknown delta shows no arrow. HUD and every other `src/game` rendering file are untouched.
- Checks: `pnpm build` clean, `pnpm test` 219 passed (18 files, +11 new), `pnpm test:smoke` 6/6 (58.3s). Heads-up for the next session: Chromium always paints the focus ring in its own colour, so `outline-color` is only honoured by other engines — the rule still supplies the 2px width + 2px offset everywhere, and that is expected, not a regression.

# Phase 3 tasks (one per session)
Rules: replays are position snapshots, not input replay. Record the pose of the bike chassis, both wheels and the rider (x, y, angle) at 20 Hz, and play back by interpolating. Never change physics, tuning, colliders or step logic in src/game; only add new files and new bus events. pnpm build, pnpm test and Playwright must pass with zero console errors.

- [ ] 1. Make every file in src/game match branch v2, except purely additive files. Run build and tests.
- [ ] 2. Snapshot recorder and codec in packages/core: quantize positions to 0.5 px and angles to 1/256 rad, delta-encode, deflate (fflate) and base64url. A 60 s run must be under 8 KB. Add Vitest tests for the round trip and the size.
- [ ] 3. Result screen (src/components/ResultScreen.tsx): score, time, finished or crashed, crash as % of the track plus the market date ("Crashed at 62% · 14 Mar"), the last 3 s replayed at half speed, buttons Retry, Next track, Share, and an empty <ResultActions /> component.
- [ ] 4. Sharing: a /r/:payload route (trackId, inverted, score, time, crash %, snapshots) that plays the replay and shows a "Ride this track" button. Share uses navigator.share or copies the link, with the text: I rode "{question}" and crashed at {pct}% — beat me: {url}. Draw a 1200x630 canvas PNG to attach or download. Add static OG and Twitter meta tags in index.html.
- [ ] 5. Ghosts: save the best run per track in localStorage. Add "Race your best" and "Race this run" on shared links. The ghost is a translucent bike with no physics body.
- [ ] 6. Playwright smoke: ride, force a crash, the result screen appears, Share gives a /r/ link that loads and plays. Then push and open a PR into v2 titled "Phase 3: snapshot replays, result screen, sharing, ghosts". Do not merge.

## Notes
(each session adds 2-3 lines here: what was done, files touched, anything the next session must know)

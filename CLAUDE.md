# Life Hub

Fred's personal hub: habits, recurring rituals and goals in one app, with a
desktop dashboard and a phone check-in. Built from `Life Hub Dashboard
MOCKUP.html` (in Downloads) — the mockup is the design authority: **it should
look like the mockup, and it must be fast** (no loading screens).

Single user, non-technical: explain things plainly, in prose.

## Status (29 Sep 2026)

Build order agreed with Fred (five steps; each stops for his review).

1. ✅ Logic + tests.
2. ✅ Both screens on local data (this laptop only, localStorage) — Fred reviews the look.
3. ✅ **Firebase sync + sign-in** (project `life-hub-fred`, config in
   `src/data/firebase-config.js`). 28 Sep: Fred did SETUP.md steps 1–8 — signed in on
   the laptop (record uploaded), and ticks sync between two windows, so his own
   writes pass the rules. Anonymous REST reads of `users/…` and other paths return
   403 PERMISSION_DENIED. Not checked (would need a second account): another
   account being refused.
5. ⏳ **Phone** (moved before 4 at Fred's request, 28 Sep). Built and tested:
   manifest + icon, offline copy (`sw.js`), `tools/build.py`, Pages workflow.
   28 Sep: repo public, Pages live (verified: page, sw.js stamped, seed.local.js
   404), Fred installed it on his iPhone. Left: launcher tests on the real phone.
   Mongolian's "Open app" shows there; Numbers, Portfolio tracker + Wealth Excel sit
   in the Money review banner, which the phone shows while its window is open
   (25th to month end) or while it's late. Hosted `?demo` has no launchers (it builds
   on seed.example.js), so it can't stand in for that test.
4. ⏳ Edit forms. 29 Sep, from Fred's first week of use: **goals** (any level, from
   each goal card and from the weekly review) and the **plan of days** are editable
   (`ui/sheets.js`), and the weekly review's steps open them. Still to do: habits,
   rituals, steps, launchers (those change by an upgrade step for now, see below).

**Luna's jar (29 Sep, Fred):** every *week* goal below 100% costs €5, paid to his wife Luna
from the week of Mon 28 Sep, no cap. `core/penalty.js` (pure, tested) tallies it; `ui/luna.js`
is the card on both views. A week is billed from its Sunday (a Monday review still bills
last week); this week so far shows as "at stake". Unbilled weeks pile up until "I've paid"
freezes the amount in `penalty.paid`. Nothing moves money: the button opens Luna's
`revolut.me/<handle>?amount=<cents>&currency=EUR` (amount prefill **untested**; the amount
is always shown). Her handle is personal: `penalty.revolut` in the record, set only by
`upgradeLocal` in seed.local.js (not done yet, waiting for the handle). Record `version` 3.
Carried-over week goals bill too; a monthly ritual as a week goal bills every week until done.

29 Sep refinements (Fred): groceries moved to Mondays (first run Mon 5 Oct), the
money review to "25th to end of month", the tracker button to its hosted copy, and
the weekly review's steps now *do* things. Reached his live record through
`core/migrate.js` step 2 + `upgradeLocal` in seed.local.js (the tracker address).

## Run

No Node on this machine. Python 3.14 (`py`) + the browser do everything.

```
Start Life Hub.bat                         # double-click: serves + opens the app
py tools/serve.py                          # http://localhost:8520/src/
py tools/run_tests.py                      # logic tests (headless Edge), exit 0 = pass
py tools/run_tests.py tools/smoke.html     # UI smoke test: taps the real app, then syncs two frames
py tools/run_tests.py tools/firebase-check.html  # real Firebase SDK from the CDN (needs internet, no account)
py tools/build.py                          # dist/ = what GitHub Pages publishes (CI runs this too)
py tools/run_tests.py tools/sw-check.html  # after build.py: offline copy installs, app opens with dist/ unreachable
py tools/icons.py                          # redraw src/icons/*.png (needs Pillow; PNGs are committed)
py tools/shot.py                           # screenshots/desktop.png + phone.png (demo, Thu 1 Oct)
py tools/shot.py --dom "?today=2026-09-28" # print rendered HTML instead
```

URL switches (dev) — none ever touches the real, synced record:
`?today=YYYY-MM-DD` pretend date, on its own copy (`lifehub:dev`, no sync) ·
`?demo` made-up history (`lifehub:demo`, "Demo data" badge) ·
`?fake-sync=laptop` sync against a pretend server kept in localStorage; a device
named `phone` has no seed file, like the hosted app · `?reset` forget this device's
copy *and its queue of unsent changes*.

Run both test commands after any change to `src/core/`, `src/data/` or `src/ui/`;
the Firebase check too after touching `firebase.js` or bumping the SDK version;
build + sw-check after touching `sw.js`, `index.html`, `build.py` or adding files.
A new module also goes into index.html's `modulepreload` list (else the first paint
waits on a chain of requests).

**Publishing = `git push` to `main`** (repo `fronk001/life-hub`, local git identity
`Fred` + his relay email, same as the Mongolian repo). The workflow builds and
deploys to https://fronk001.github.io/life-hub/ in ~1 min; phones pick it up on
their next open. Pushing publishes publicly: ask Fred before each push, and run
all the tests first.

## Layout

```
src/core/    dates habits rituals goals wins actions sync migrate  ← pure logic, no DOM, all tested
src/data/    store.js (URL switches, picks backend, actions API), engine.js (local copy,
             queue, sync rules), firebase.js (the only file that knows Firebase),
             firebase-config.js (public web config, null = local-only), fake-backend.js,
             seed.local.js (git-ignored!), seed.example.js (public fallback), demo.js
src/ui/      app.js (boot, click delegation), desktop.js, phone.js, html.js,
             account.js (sign-in form, sync button, account line, new-device screen),
             steps.js (ritual checklists; the weekly review's step buttons),
             sheets.js (editors: goals, plan of days; outside #app like the sign-in form)
src/app.css  all styling; tokens on :root copied from the mockup
src/fonts/   Fraunces + Instrument Sans, variable woff2, extracted from the mockup file
src/sw.js    offline copy (published copy only); manifest.webmanifest; icons/ (tools/icons.py)
tests/       *.test.js for src/core + engine.test.js (two devices, pretend server)
tools/       serve.py, run_tests.py, shot.py, smoke.html, firebase-check.html, phone.html,
             build.py (src → dist), sw-check.html, icons.py
.github/workflows/pages.yml   build.py + deploy on every push to main
firestore.rules  pasted by Fred into the console; SETUP.md  his step-by-step
```

Views are template strings re-rendered whole on every change (the DOM is tiny,
it takes ~ms). All user text goes through `esc()`. State changes only via
`core/actions.js` (pure, returns new state) → `store.act.*`.

## Data model (localStorage key `lifehub:v1`)

`{ version, launchers, habits, rituals, goals, checks, runs }`
- `version` — shape of the record (`core/migrate.js` VERSION, now 2).
- `checks['2026-10-01'].mn = true` — a habit tick on a logical day.
- Habit `plannedWeekdays: [1, 3, 6]` (1 = Mon) — set in the weekly review's "Plan the
  days"; stays until changed. Its `sub` line is then computed (`habitSub`).
- Ritual `schedule`: `{ type: 'weekly', weekday }` · `{ type: 'monthly', rule:
  'first-weekend' }` · `{ type: 'monthly', from: 25 }` (window: 25th → last day = due
  day). Optional `since`: the day the schedule began (see Rules). Steps may carry
  `does: score | week-goals | plan | check-goals` (what the step's button opens).
- `runs.money['2026-10'] = { startedAt, steps:{id:true}, done, doneDay, doneAt, minutes }`
  keyed by period (`2026-W40` weekly, `2026-10` monthly).
- Goals: `{ level: week|month|year, period, title, measure }`, measure is
  `manual {pct}` or linked `habit {habitId}` / `ritual {ritualId}` (computed, never typed).
  `saveGoals` replaces one period's list; an emptied period keeps one `archived`
  marker so it stays empty instead of carrying the previous period's goals over.
  Goals accumulate in `main` (~200 a year, ~30 KB): fine for many years; if `main`
  ever nears 1 MiB, move past periods' goals into the year documents.
- `lifehub:v1:sync` = `{ owner: uid, pending: [{ id, at, ops }] }`. No owner = local
  data never synced (the laptop's pre-sync record).

Online (Firestore), `users/{uid}/data/`: `main` = everything but history;
`2026`, `2027`… = that year's `{ checks, runs }` (runs filed by their period key's
year, so `2026-W53` lives in `2026`). Split by year to stay far below Firestore's
per-document limits (1 MiB, 40k index entries) forever.

## Rules that matter

- **The day starts at 04:00 Amsterdam time** (`core/dates.js`), so reading after
  midnight counts for the evening before. Day keys are `YYYY-MM-DD` strings and all
  arithmetic is in UTC. Tested across DST.
- **Numbers are real.** History started empty on 28 Sep 2026; nothing is backfilled
  or invented. Weeks before a habit/ritual existed render as "—", never as misses.
  Year goals for weekly habits count only completed full weeks.
- **`activeDay`** (rituals.js) decides which period a ritual's run belongs to:
  - a period due before the ritual existed, or before its schedule's `since`, was
    never owed (`owed()`): moving groceries to Mondays on Tue 29 Sep didn't make
    Mon 28 Sep overdue — its first Monday is 5 Oct. History shows such periods as "—".
  - **Late:** a missed run stays active for `LATE_DAYS` after its due day (weekly 3,
    monthly 15), shown as overdue, and counts for the period it was due in. Without
    it a ritual due on its period's last day (the Sunday review, the month-end money
    review) could never be late. So a Sunday review done Monday scores last week and
    plans this one (`reviewWeeks`).
- Monthly "first weekend" = first Saturday of the month + the Sunday after (a lone
  Sunday the 1st doesn't count). Still supported; nothing uses it since 29 Sep.
- A windowed ritual (`from: 25`) is amber "Due …" from the 25th, and the phone
  shows it for the whole window.
- **Changing the live record's shape**: the starting set (seed) only applies to a
  brand-new record, so a schedule/step change reaches Fred's data through a step in
  `core/migrate.js` (pure, idempotent, bump VERSION). The engine applies `upgrade`
  to everything it loads, but records (sends) the change only from a copy the server
  confirmed, and not while changes are queued — a refused write would otherwise be
  re-queued with every snapshot (tested). Anything naming a personal address goes in
  seed.local.js's `upgradeLocal` instead, which only the laptop runs (app-version
  "dev"; the phone never requests that file).
- Goals: the review plans the week after the one it closes, and its "check goals"
  step opens the month and year of that next Monday. Goals carried over from an
  earlier period open in the editor as copies with new ids.
- Planned days: a weekly habit counts towards "x of y done" on its planned days
  only, and not at all once the week's quota is met.
- Ritual duration = first step/launch → completion; only shown between 2 min and 8 h.
  Optional steps (e.g. "stock purchases, if any") never hold a run open.
- Launch links: the click handler defers `startRitual` with `setTimeout` — re-rendering
  synchronously detaches the `<a>` and the browser silently drops the navigation.
- Only `https: http: claude: ms-excel: numbers:` links render (`html.js`); anything
  else is inert. Launchers with `where: 'laptop'` are hidden on a real phone
  (`(hover: none) and (pointer: coarse)`), not on a narrow laptop window.
- Phone layout below 760px. Desktop grid is 3-up at ≥1280px, stacks below.
- `seed.local.js` holds local paths, the OneDrive id and personal goals — **never
  commit it**; the repo will be public for GitHub Pages. The manual goal percentages
  in it are placeholders from the mockup; Fred taps a value to set the real one.

## Launchers (seeded)

| Launcher | Link | Where |
|---|---|---|
| Mongolian app | `https://fronk001.github.io/mongolian/` | both |
| Groceries | `claude://code/new?folder=…groceries-agent&q=/groceries-run` | laptop |
| Numbers | `https://www.icloud.com/numbers/`; phone `numbers://` (**untested**) | both |
| Portfolio tracker | hosted Streamlit copy `https://<app>.streamlit.app/?app=portfolio&window=last12` (address in seed.local.js; private, asks to sign in; keeps the query through sign-in) | both |
| Wealth Excel | `ms-excel:ofe\|u\|https://d.docs.live.net/<cid>/Current%20Wealth%20Portfolio.xlsx` | both |

The tracker link was `localhost:8510` until 29 Sep: that only answers while the
tracker's `Start Portfolio Tracker.bat` runs, and Fred uses the hosted copy on both
laptop and phone. Fred finds the hosted copy very slow (Streamlit Cloud: sleeps after
12 h, reruns Python on every click) and asked about moving it to Firebase — a
question for the tracker project (`~/Desktop/Portfolio tracker`), not this one.

Known limits of the Claude link: it pre-fills the prompt (Fred presses Enter) and
always asks to confirm the folder. On Windows, if Claude is already open it may add
the folder to the current window instead of opening a new one
(anthropics/claude-code#92260). Test with Fred at step 5; fallback is
"copy `/groceries-run` + open Claude".

## Sync (step 3)

- Firestore + Firebase Auth (email + password) on Fred's existing Google account,
  Spark (free) plan, region europe-west4. Chosen over Supabase because its free
  plan pauses after 7 idle days. SDK 12.19.0 as ES modules from gstatic (no build
  step), imported only after the first paint.
- Local-first: draw from localStorage instantly, ticks are optimistic. Every change
  while signed in is diffed (`core/sync.js diff`) into **leaf-level ops** and queued
  in `lifehub:v1:sync` until the server confirms it, then sent as merge-writes. So
  two devices ticking different habits the same day both land, and offline ticks
  survive closing the app. Arrays (habit list, goals) are written whole.
- Firestore uses its default **memory** cache, not the persistent one: the queue
  above is the durable copy, and unlike Firestore's cache it also works when the
  SDK itself can't be downloaded (offline start).
- The server wins: every snapshot replaces the local copy (Firestore overlays this
  device's unsent writes). An empty snapshot counts only if `!fromCache`.
- First sign-in, server empty: upload this device's data (laptop). No data here
  (hosted app, fresh browser; never seeded when sync is on): show "sign in on your
  laptop first" and wait. It never uploads a starting set by itself (a blank record
  online would make the laptop's real one give way); if seed.local.js is in reach it
  offers "Start from the starting set", behind a confirm. Server has data: the
  unsynced local copy gives way.
  Another account signing in wipes the previous owner's copy first.
- Sign out wipes this device's copy + queue (warns if the queue isn't empty).
- UI: the **sync button** (`syncButton()`, account.js), top right of both views
  whenever sync is set up — Fred asked for it 29 Sep, to match the Mongolian app's
  dot. Same signs: solid green = in step; green ring = on its way (starting,
  connecting, offline, changes slow >5 s); red = needs him (signed out / never
  signed in, error). Green, not Mongolian's blue: in Life Hub green means done.
  Words only when there's something to say ("Sign in to sync", "Offline · 2 changes
  saved here", "Syncing…", "Not syncing"). Red signed-out opens the sign-in form;
  otherwise a tap opens a card saying the state in words + the account (closes on a
  tap elsewhere or Escape, deferred so a launch link's navigation survives). It
  sits in the band above the header (`--band`), dot on the content edge (`--edge`),
  and scrolls with the page. "Signed in as … · Sign out" stays at the bottom.
  The sign-in form lives outside `#app` (re-renders would wipe typing); forced
  full-screen when the device has no data.
- Tests can't reach real Firebase (no emulator without Node/Java, and Claude may not
  type Fred's password), hence `fake-backend.js`: same interface, merge semantics,
  latency compensation, fromCache offline, writes resolve on delivery.
- iPhone: install from Safari → Add to Home Screen, then sign in *inside* the
  installed app (separate storage from Safari). No email-link sign-in: links open
  Safari, not the app.
- Fred does the console clicks (SETUP.md). Claude never creates accounts or types
  passwords. The web config isn't secret; `firestore.rules` confines each account
  to its own `users/{own uid}/data/`, writing only `main|YYYY`, and — for the
  Mongolian app, which syncs through this same project and account since 28 Sep
  (`../mongolian`, its CLAUDE.md "Sync") — `users/{own uid}/mongolian/`, writing
  only `main|items-N|YYYY`. Both apps' rules live in this one file; a change to
  either means Fred re-pastes the whole file, so **the file must always match
  what works in the console**.
- **Reads must not check the document name.** Both apps listen to their whole
  folder (a collection query), and Firestore refuses the entire query when the
  rule depends on the document id: permission-denied, nothing loads. Name
  checks go on `write` only. This bit twice: 28 Sep (fixed in the console, but
  the file stayed wrong because Word had it locked) and 29 Sep (the Mongolian
  rules were added to the stale file and Fred pasted it over the working rules).

## Offline copy + publishing (step 5)

- `tools/build.py` copies src/ → dist/ minus `seed.local.js`, stamps `sw.js` with
  the file list + a content-hash version, and stamps the same version into
  `<meta name="app-version">` in index.html. app.js registers `sw.js` only when
  that meta isn't `"dev"`, so the laptop's dev server (src/) never has one.
- `sw.js`: precache everything (`cache: 'reload'`: Pages sends max-age=600, and a
  new version must not be built from stale files), cache-first, same-origin only
  (Firebase SDK/Auth/Firestore untouched; the SDK has a 1-year HTTP cache anyway,
  and the offline start without it is the tested engine path). skipWaiting +
  claim; app.js reloads on `controllerchange` except for the first install, and
  waits until the page is hidden if the sign-in form is open. Verified in Edge:
  a new version takes over and the old cache is deleted.
- iOS: links always open Safari, never another installed web app. So the
  Mongolian launcher on the phone likely opens Mongolian *in Safari*, whose
  storage is separate from Fred's installed Mongolian app: check with Fred at
  launcher testing. Since the Mongolian app syncs (28 Sep), signing in there once
  inside Safari makes that copy show the same progress.

## Gotchas

- Headless Edge won't make a window narrower than ~500px: phone screenshots go
  through `tools/phone.html` (a 390px iframe), or they look cut off.
- The Windows console is cp1252: scripts printing ✓/✗ call `sys.stdout.reconfigure(encoding="utf-8")`.
- The dev server sends `no-store`; without it the browser tests stale ES modules.
- Headless `--virtual-time-budget` fast-forwards timers whenever no request is open,
  so a page waiting on real async work (IndexedDB, the SDK) gets dumped early.
  `serve.py` answers `/__wait` after 0.2 s; firebase-check.html keeps one open.
  Don't swap the test pages' `setTimeout` waits for `/__wait`-based ones: tried in
  sw-check.html, the app's modules then never finished loading in the frame.
  A page that stalls outright makes run_tests.py print FAIL after 2 minutes.
- `serve.py` `/__offline?on|off` answers 503 for everything under `/dist/`
  (sw-check.html's pretend offline); dropping the connection instead made
  headless Edge wait on the frame forever.
- A failed dynamic `import()` is cached for the life of the page (verified in Edge):
  after an offline start, `firebase.js` reloads the page to get the SDK.
- `.btn { display: flex }` beats the `hidden` attribute; `[hidden]` is forced to
  `display: none !important` in app.css. Smoke checks use `getClientRects()`.
- In smoke tests, wait for the frame's `load` event after changing `src`: checking
  straight away can match the page still on screen.

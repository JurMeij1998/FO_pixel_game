# Working on the repo

How a feature goes from idea to `main`, how several Claude sessions can work side by side, and
how to check a change in the real game. Read it before starting a feature or a review.

## A feature, start to finish

1. **Branch from an up-to-date `main`:** `git checkout main && git pull`, then
   `git checkout -b feature/<name>` (earlier ones: `feature/doors-and-locks`,
   `feature/weapon-condition`). Never work on `main` itself.
2. **Ask about real design choices before building**, with a few concrete options (the user
   answers quickly and has firm opinions on game feel). Pick the obvious ones yourself.
3. **Build in small, visible steps.** The user looks at each step in the browser (usually the
   test arena or test shop) and gives feedback; commit only when they say so ("commit this").
4. **Keep the docs in the same branch as the code** (see below), so `main` never has a
   feature its docs don't describe.
5. **Review before merging:** when the feature is done, run a read-only review agent over
   `git diff main...HEAD` (give it this skill to read first, the list of what the branch
   adds, and the kinds of bugs to hunt: state lost across saves or screens, thresholds,
   determinism of the RNG streams, scene reuse). Fix what it confirms, with the user's go.
6. **Push and open a PR**, squash-merged into `main` as one commit: push with
   `git push -u origin feature/<name>`, then open it with `gh` (below), the description
   written to a file first and ending with the "Generated with Claude Code" line. The user
   merges it on GitHub with "Squash and merge"; never merge it yourself.
7. **After the merge:** `git checkout main && git pull`, and delete the branch locally and on
   the remote (`git branch -D`, `git push origin --delete`) when the user asks.

CI (`.github/workflows`) runs typecheck, tests and build on every push and PR.

### Opening a PR with `gh`

`gh` is the portable zip (no admin rights on this laptop), in
`%LOCALAPPDATA%\Programs\gh\bin`. That folder is on the user PATH, but a shell started before
it was added won't find it, so call `"$env:LOCALAPPDATA\Programs\gh\bin\gh.exe"` if `gh` is
missing.

- **Two accounts are logged in:** the user's personal `JurMeij1998`, which owns the repo, and
  their work account. Check `gh auth status` before opening a PR and, if the work account is
  active, run `gh auth switch --user JurMeij1998`. PRs here must never come from the work
  account.
- **The user sometimes opens the PR themselves:** check `gh pr view feature/<name>` first.
- Open it with
  `gh pr create --repo JurMeij1998/FO_pixel_game --base main --head feature/<name> --title "..." --body-file <file>`.
  The body always comes from a file (company rule: no long text on the command line).
- If `gh` is unavailable, fall back to the compare link
  `https://github.com/JurMeij1998/FO_pixel_game/compare/main...feature/<name>?expand=1`
  plus a title and a description to paste.

## Several sessions at once

Each session works on its own feature branch **in its own git worktree**, so they never
share a working copy, a checked-out branch or a half-finished file:

```sh
git worktree add ../FO_pixel_game-<name> -b feature/<name> main
cd ../FO_pixel_game-<name> && npm install
```

- **Dev server ports:** the user's own `npm run dev` is on 5173. A session in a worktree
  starts its own on another port (`npx vite --port 5175`, run in the background) and stops it
  when done (stop the background task, then `Get-NetTCPConnection -LocalPort 5175` and
  `Stop-Process` its owner). Driver scripts take the URL as a parameter for this reason.
- **Files that every feature touches**, so expect conflicts there and keep edits to them
  small and local: `core/items.ts` (`DEFINITIONS`), `core/creature.ts` (definitions, Gus's
  stock and dialog), `core/stats.ts`, `data/testArena.ts`, the biomes in `data/biomes/`,
  `README.md`, `SKILL.md` and `references/roadmap.md`. Tests that list Gus's stock
  (`ui/trade.test.ts`) or his replies (`ui/dialogBox.test.ts`) break when another branch adds
  to them.
- **Biome versions:** a branch that changes what a biome builds for a seed bumps its
  `version` once (not once per commit). If two branches both bump the same biome, the one
  merged second takes the next number above `main`'s when it rebases.
- **Before opening a PR**, rebase onto the latest `main` (`git fetch && git rebase
  origin/main`), resolve conflicts, and run the checks again. Don't force-push `main`, ever.
- **One feature per branch.** If the user asks a session for something unrelated mid-way,
  say which branch it would land in.
- **The roadmap is shared:** when picking up a roadmap item, mention it in the PR so the
  item is removed from `references/roadmap.md` in that same PR, not by another session.

## Docs are part of every feature

Other sessions start with nothing but this skill and the README, so every feature updates,
in the same branch:

- `README.md`: what the player sees and can do (a section per system), and the file layout.
- `SKILL.md`: the *why*: design decisions, rejected alternatives the user didn't like (so
  they aren't proposed again), pitfalls hit and the rules that came out of them.
- `references/extending.md`: a recipe when there's a new kind of thing to add (item field,
  dialog action, skill...).
- `references/roadmap.md`: remove what was built, add ideas the user deferred ("later").

## Checking a change

Always: `npx tsc --noEmit`, `npx vitest run`, `npm run build`. Then look at it in the game.

**Headless Chrome via playwright-core**, installed in the session's scratchpad (not in the
project): `npm init -y && npm i playwright-core` in a `driver` folder there, using the
installed Chrome (`C:/Program Files/Google/Chrome/Application/chrome.exe`). A minimal driver:

```js
// node shop.mjs <screenshot dir> [base url]
import { chromium } from 'playwright-core';
const [out, base = 'http://localhost:5173'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const page = await browser.newPage({ viewport: { width: 960, height: 640 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
// Phaser reads keys as down/up pairs; ignore auto-repeat, so press like a person.
const press = async (key, wait = 300) => {
  await page.keyboard.down(key);
  await page.waitForTimeout(40);
  await page.keyboard.up(key);
  await page.waitForTimeout(wait);
};
await page.goto(`${base}/?shop`); // or ?arena
await page.waitForTimeout(3000);
await page.mouse.click(5, 5); // focus, and unlock audio
await press('e', 700);        // talk to Gus
await page.screenshot({ path: `${out}/shop.png` });
console.log(errors.join('\n') || 'no errors');
await browser.close();
```

- **Setting up a scenario:** a real game saves to `localStorage`; read the save key, change
  the JSON (`s.player.equipment.primary = 'knife@20'`, items in the backpack, position) and
  reload through the menu. Sandboxes (`?arena`, `?shop`) never save, so change
  `data/testArena.ts` instead, or add to the test character's kit.
- **Look at the screenshots** (crop and enlarge for pixel detail). Several bugs only showed
  there: wrong ground under a tile, a hidden sprite showing through, a misplaced arrival.
- The game is 960x640 and scales to fit; mouse coordinates are in that space at this
  viewport.

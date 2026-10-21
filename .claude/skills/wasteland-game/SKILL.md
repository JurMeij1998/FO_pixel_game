---
name: wasteland-game
description: Architecture, design decisions, working conventions and roadmap for this repo's Fallout-inspired top-down pixel RPG (TypeScript + Phaser 3 + Vite, rules in src/core, procedural art and sound, ASCII and generated maps, seeded biomes, localStorage saves). Use it for any work in this repo, even small-looking changes - adding or changing items, creatures, tiles, maps, biomes, combat, UI or HUD, sounds, saves or menus; fixing bugs; reviewing code; or planning and discussing what to build next. It explains why things are built the way they are, the pitfalls already hit, how to verify changes, and the known backlog.
---

# Wasteland: a Fallout-style pixel RPG

A small top-down RPG inspired by Fallout 1/2 with Pokémon-style grid movement: lootable chests
and corpses, a weight-limited inventory with two weapon hands, turn-based combat with Action
Points and line of sight, XP and levelling, hand-made and randomly generated maps joined by
exits, autosave, and synthesised sound. Runs in the browser on PC for now; mobile comes later.

`README.md` has the player-facing overview, controls and file layout. This skill is about
**why** the code is shaped the way it is, so changes fit in. Two reference files go deeper:

- `references/extending.md`: step-by-step recipes for adding an item, creature, tile, biome or
  sound. Read it before adding any of those.
- `references/roadmap.md`: what the past reviews fixed (and must stay fixed) and the planned
  features. Read it before planning work, before touching map generation, saves, travel or the
  AP gauge, and when the user asks what's next.

## Architecture decisions

**Rules live in `src/core/`, in plain TypeScript with no Phaser.** Items, containers,
characters, creatures, combat, line of sight, maps, generation and saves are pure and unit
tested with Vitest; scenes only draw and read input. This keeps the rules testable without a
browser and the renderer replaceable, which matters because a mobile port is planned. Keep
Phaser imports out of `core/`; if a rule needs something from the scene, pass it in.

**Rules resolve instantly; scenes replay the result as events.** `Combat` mutates fighters at
once and returns `CombatEvent`s that `WorldScene.play()` animates with async/await. The rules
must therefore never assume the screen has caught up:
- `endTurn()` resolves every enemy turn but leaves the player's turn to `startPlayerTurn()`,
  which the scene calls after animating; otherwise the HUD shows "your turn" mid-animation.
- A killed target stays selected until the scene calls `ensureTarget()` after the death shows.
- Events carry what's needed to animate them (e.g. the attack's `sound`), captured when they
  happen, because state can change while they play. `WorldScene.busy` blocks input during
  animations; new key handlers should check it too.
- Refusals carry a reason code (`attackProblem()` → `AttackProblemCode`), so the UI reacts to
  the actual reason instead of re-deriving it (that once made an "out of range" click play the
  empty-gun sound).

**One mutable `state` object, replaced in place.** `src/state.ts` holds `player`, `map` (the
current one), `maps` (all visited), `worldSeed`, `combat`, `loadedFromSave` and `sandbox`. New
game, load and test arena use `Object.assign(state, ...)` so every importer sees the new game,
and scenes rebuild themselves from `state` in `create()`; `scenes/flow.ts` restarts World and
HUD instead of reloading the page. Phaser reuses scene objects across restarts, so each
`create()` resets its per-session fields, and listeners added to `this.events` or `game.events`
are removed on `SHUTDOWN` (keyboard and input plugins clean themselves up).

**No asset files: art, text and sound are generated in code.** Tile painters per `TileType` in
`gfx/textures.ts` (seeded noise, 4 variants each); 16x16 sprites as character grids in
`gfx/sprites.ts`; a 3x5 pixel font in `gfx/pixelFont.ts` (outlined glyphs over the map, plain
ones on solid plates); Web Audio synthesis in `audio/sfx.ts`. This kept the prototype free of
asset licensing and loading. Sound levels were tuned by rendering with an OfflineAudioContext;
don't add a `DynamicsCompressor`, as Chrome's squashes gunshot transients to a fraction of
their volume. Sound stays silent until the first click or key press (browser autoplay rules).

**Maps are ASCII art (`MapDef`), hand-made or generated.** Tiles use symbol characters
(`.` dirt, `#` wall, `^` tree, `%` wooden wall, ...) because letters and digits are markers:
`P` player start, `a-z` chests, `A-Z` creatures and people (except P), `1-9` exits. A marker
stands on its first walkable neighbour's ground. `BLOCKING` and `OPAQUE` in `core/gridMap.ts`
decide walkability and sight. Creature ids are their spawn tile (`radroach@8,14`) so editing a map elsewhere doesn't shift saved ids. Line of sight is a Bresenham line tried in both directions
(so it's symmetric) and blocked through the gap where two blocking tiles touch diagonally.

**Generated maps: `Biome` → `MapBuilder` → an ordinary `MapDef`.** A biome (`data/biomes/`)
paints terrain and stamps `Prefab`s (ASCII structures with `$` chest and `&` creature slots)
on a `MapBuilder` (`core/generation/`), then `generateMap()` runs `connect()`, which carves the
cheapest paths so every exit, entrance, chest and creature is reachable, never through locked
structure tiles. Because the output is a plain `MapDef`, generated maps are parsed, saved and
drawn exactly like hand-made ones.
- Generation must be deterministic: only the `Random` passed in, never `Math.random`. A map's
  seed is `hashSeed(worldSeed, mapId)` and the world seed is new per game, so a game always
  rebuilds the same forest from its seed, which is what lets saves skip the layout.
- `data/world.ts` lists every map (fixed, or generated with requested exits). Map ids are save
  keys, so renaming one loses that map's saved state.
- Creatures are placed out of sight of the arrival point, so nothing attacks on arrival.

**Saves store only what changes.** Format v2 (`core/save.ts`): world seed, current map, player,
and per visited map only chest and creature state; generated maps are rebuilt from the seed and
the state laid over them. `loadGame()` upgrades v1 saves, reads legacy creature ids, validates
and clamps player data, ignores entries a map no longer has, and moves the player off a tile
that is no longer walkable. `storage.ts` is the only code touching `localStorage` and fails
quietly (private windows). Autosave runs after steps, closed screens, swaps and finished
fights, but never during combat, so "load last save" after death returns to just before the
fight, and never in the sandbox.

**People are creatures that start friendly.** Gus and the guard are ordinary `Creature`s
with `friendly`, a `group`, a `dialog` and (for Gus) `trader`, because they must be able to
fight, die and be looted once provoked. (A first version kept NPCs as a separate non-fighting
class; it was replaced as soon as they had to turn hostile.) `Creature.hostile` is the switch:
only hostile creatures spot you (`Combat.spotters`) or take part in fights, and `Combat.attack`
refuses a friendly target. `GridMap.provoke()` turns a creature and its living group hostile;
`GridMap.noticeTheft(owner)` does the same when you take from a chest whose `owner` is that
group. The scene then calls `Combat.join()`, which brings them in even out of sight. Hostility
only goes one way and is saved per creature. You talk to someone you face, or across a counter
(`shelf`) in front of them: `GridMap.personFacing()`. Lines live in the definition as a small
dialog graph (`core/dialog.ts`, checked at startup); `Conversation.replies` always appends
`*Attack*`, and puts "Leave." first on a line with no replies so Enter never attacks by
accident. A trader's stock is their pack (`contents`), so killing them leaves it on the corpse.
Barter rules (`core/barter.ts`) price by Charisma; selling always pays less than buying.
The player's ranged shots stop at the first creature on `GridMap.lineOfFire()` (the same line
line of sight uses), via `Combat.inTheWay()`; enemies' shots deliberately ignore bystanders.
Rosa (starting shack) is next to defenseless but still a full combatant once provoked: a
"harmless" creature that never fights was tried and rejected, since a fight that ends the
moment you attack someone makes no sense to the user. Weak people get weak attacks instead.
Prefabs place residents (particular people) with capital letters mapped in `residents`; paths
are routed around them since they don't move until a fight.

**UI structure.** The world is drawn at integer zoom 3 (`WORLD_ZOOM`) for crisp pixels. HUD,
menus and overlays are separate 1:1 scenes; overlays pause the World while open. Dialog
sleeps while the barter screen is open and wakes when it closes, so the conversation goes on.
`ui/widgets.ts` has `ListView` (pooled rows, click modifiers) and `MenuList` (keyboard and
mouse, ignores key auto-repeat so a held key from the previous screen can't pick an option).
The AP gauge (`ui/apGauge.ts`) lives in world space: the AP number in a round pixel seal with a
pip bar sweeping out of it, its green border pulsing and shining. Its spot comes from the pure,
tested `ui/gaugePlacement.ts`: always above the player, and never covering a chest, creature,
lootable corpse, exit, an enemy's health bar or the HUD's combat label.
The HUD is kept minimal and mostly sits straight on the map: no top bar (stats live on the
character sheet), the message log across the bottom left (`HUD_BOTTOM`; it shows whole
messages only, `logLines`), a floating combat label top left (`COMBAT_LABEL`), and the
player's health bar bottom right with the weapon line above it (`ui/healthBar.ts`). Its border
shines with the same pulse and glint as the AP gauge (`ui/glow.ts`, one shared clock: the game
loop's time). Enemies you're fighting get a thin red/black bar over them. Health bars draw
`shownHitPoints` (`ui/shownHealth.ts`), not live `hitPoints`: combat resolves a whole turn at
once, so `WorldScene.play()` holds each target's health and lowers it as each hit is shown.

**A development-only test arena.** With `npm run dev`, http://localhost:5173/?arena (or the
"Test arena (dev)" menu entry) drops a sturdy test character (10 AP, loaded hunting rifle in
hand, loaded pistol in the other hand) into a small room (`data/testArena.ts`) where combat
starts on arrival, with obstacles placed to stress floating UI. `state.sandbox` turns autosave
off so the real save is never touched. It's gated by `import.meta.env.DEV`, so production
builds strip it. Use it to iterate on combat and UI. Likewise `?shop` (or "Test shop (dev)")
opens the village store in a yard (Gus across the counter, the store's crate, the guard by the
door) with 1000 caps to spend: for dialog, barter, theft and provoking.

## Working conventions

**Verify changes for real.** Run `npx tsc --noEmit`, `npx vitest run` and `npm run build`, then
look at the actual game: drive headless Chrome with `playwright-core` (install it in the
session scratchpad, not as a project dependency), take screenshots (crop and enlarge for pixel
detail) and assert on the save in `localStorage`. To set up a scenario, edit the save in
`localStorage` and reload through the menu (Esc, Quit, Continue). A passing test suite has
repeatedly missed things a screenshot caught: tiles in green squares, a dimmed card showing a
hidden sprite through itself, a misplaced arrival point.

**Keep every edit self-consistent.** The user usually has `npm run dev` running. If a change is
spread over several saves (say, a call added before its import), Vite's watcher can miss the
later save and keep serving a broken module, which shows as a black screen. After multi-file
edits, `touch` the changed files and check with `curl http://localhost:5173/src/<file>.ts` what
the dev server actually serves.

**Commits.** Write the message to a temp file and use `git commit -F <file>`; long text on the
command line is risky here (corporate endpoint protection inspects command lines). End with the
`Co-Authored-By` line. Commit and push only when the user asks, since they like to look at a
change first; say what's unpushed instead.

**The user** is a C++ developer who reads TypeScript fine, writes in Dutch or English (reply
in the same language), prefers simple, clean UI (a busy "combat card" with HP, damage and ammo
was built and rejected for the minimal AP seal), and likes to iterate visually in the test arena.

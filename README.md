# Wasteland (working title)

A small top-down pixel-art RPG inspired by Fallout 1/2: grid movement, lootable chests and
corpses, a weight-limited inventory, turn-based combat with Action Points and line of sight,
XP and levelling, randomly generated maps, autosave, and synthesised sound effects.

Built with TypeScript, [Phaser 3](https://phaser.io) and Vite.

## Running

```sh
npm install
npm run dev        # dev server with hot reload, open the printed URL
npm test           # unit tests for the game rules (src/core)
npm run build      # typecheck + production build into dist/
```

### Test arena (development only)

With `npm run dev`, the main menu has a **Test arena (dev)** entry, and
http://localhost:5173/?arena skips the menu and goes straight there. It's a small room
(`data/testArena.ts`) where a fight starts the moment you arrive, with chests above and
below the start, creatures nearby and an exit, so combat UI such as the AP gauge has to work
around things. You play a sturdy test character with 10 AP, a loaded hunting rifle in hand,
a loaded pistol in the other hand (Q), and plenty of stimpaks and ammo.
Nothing in the arena is saved, so your real save is never touched; quitting to the menu
goes back to it. Production builds leave the arena out entirely.

## Controls

| Key             | Exploring                        | In combat                     |
| --------------- | -------------------------------- | ----------------------------- |
| Arrows / WASD   | Move                             | Move (1 AP per tile)          |
| E / Space       | Interact with the tile you face  | Space: end turn               |
| F / click enemy | Click: attack (starts combat)    | Attack the target             |
| Tab             |                                  | Next target                   |
| I               | Inventory                        | Inventory (costs 4 AP)        |
| C               | Character sheet, spend skill points |                            |
| Q               | Swap primary/secondary weapon    | Same, free                    |
| R               | Reload the gun in hand           | Reload (costs 2 AP)           |
| M               | Sound on/off                     | Sound on/off                  |
| Esc             | Pause menu / close a screen      | Pause menu                    |
| Click (loot)    | Move 1 of a stack; Ctrl+click half (rounded up), Shift+click all |   |
| Space (loot)    | Take all                         |                               |
| E / Esc (loot)  | Close the loot screen            |                               |

## Maps and biomes

The world is a set of maps joined by exits (signposts on the map edge); walking onto one
takes you to the linked map, next to its exit back. `data/world.ts` lists the maps and how
they connect. A map is either drawn by hand as ASCII art (`data/wasteland.ts`) or generated
from a **biome**: the wasteland's east exit leads to a randomly generated forest, its south
exit to a randomly generated village.

Generated maps are rebuilt from a seed (the world seed, which is new for every game, plus the
map id), so the same game always gets the same forest and saves only store what changed:
looted chests and dead creatures.

A biome's generator draws onto a `MapBuilder` (`core/generation/`), which turns it into an
ordinary ASCII `MapDef`, so generated maps are parsed, saved and drawn like hand-made ones.
Afterwards it carves paths so every exit, chest and creature can be reached. The toolkit:

- `MapBuilder`: paint tiles, stamp prefabs, place chests, creatures and exits.
- `Prefab`: a hand-drawn structure in the map legend, with `$` for its chest and `&` for its
  creatures (a logging camp, a hunter's cabin, ...). `flipVertical()` turns one around, e.g.
  for houses on the other side of a street; `builder.lock()` keeps roads free of buildings.
- `LootTable` / `SpawnTable`: what a chest can contain, which creatures can appear.
- `terrain.ts`: scatter, cellular smoothing (for groves and caves), blobs, borders, winding
  paths, finding free spots.

The forest (`data/biomes/forest.ts`) has smoothed groves of trees, dirt and grass patches,
sometimes a pond, a raider-held logging camp, a hunter's cabin, campsites and hidden
stashes, and mole rats, radroaches and wild dogs kept out of sight of where you arrive.

The village (`data/biomes/village.ts`) is abandoned and overgrown: a main street with wooden
and brick houses on both sides (doors facing the street), a general store being looted by a
raider, a barn with hay and vermin, fenced fields with mole rats, a well, and feral ghouls,
wild dogs and radroaches roaming the streets.

**Adding a biome** (village, plains, caves...):

1. Write `data/biomes/<name>.ts` exporting a `Biome`: size, names, base and path tiles, and
   a `generate(builder, { rng, exits })` that paints terrain, stamps prefabs and places
   loot and creatures. Use only `rng` for randomness so maps can be rebuilt from their seed.
2. If it needs new tiles, add them to `TileType` and `LEGEND` in `core/gridMap.ts` (and the
   blocking/opaque sets), and a painter in `gfx/textures.ts`; TypeScript flags any you miss.
3. Register it in `data/biomes/index.ts` and give it a place in `data/world.ts`, with an exit
   on a neighbouring map leading to it.
4. Copy `data/biomes/village.test.ts`: it runs `playabilityProblems()` (every exit, chest and
   creature reachable; nothing can see you arrive) and a determinism check over many seeds.

## Levelling

Kills give XP (radroach 25, mole rat 40, raider 100). Level 2 takes 100 XP, level 3 300,
level 4 600, and so on. Each level adds 3 + Endurance/2 max HP and 5 + 2 x Intelligence skill
points, spent on the character sheet (C). Tagged skills gain 2% per point, others 1%.
A `+` after your level in the HUD means you have points to spend.

## Sound

All sound effects are synthesised at runtime with the Web Audio API (`audio/sfx.ts`), so,
like the art, there are no asset files: footsteps (a gravel crunch outdoors, a harder tap on
floors), weapon swings, layered gunshots (crack, overdriven blast, boom, echo), bites, hits,
ricochets, deaths, reloads, pickups, a level-up jingle and menu blips. Each attack's `sound`
field (on weapons and creatures) picks what it sounds like. M toggles sound on any screen,
and is remembered.

## Saving

The game opens on a main menu: Continue (if there is a save), New game (asks before
overwriting a save) and Controls. Esc in the game opens the pause menu, which can go back to
the main menu.

The game autosaves to the browser's localStorage after every step, every closed screen and
every finished fight, but never during combat. Dying lets you load that save (so you go back
to just before the fight), start a new game, or return to the main menu. `core/save.ts` turns
the game into plain JSON; `storage.ts` is the only code that touches localStorage. Loading
checks the save's player data and falls back to a new game if it is corrupt. Creatures are
saved by their spawn tile, so adding creatures or chests to the map doesn't break old saves:
the new ones just start fresh.

## Combat

Fallout-style and turn-based, on the same grid you explore. Combat starts when a creature
sees you (or you attack one). You act first with your Action Points, then each enemy
takes its turn.

During a fight an AP gauge floats beside you (`ui/apGauge.ts`): the AP left in a 3x5 pixel
font (`gfx/pixelFont.ts`) inside a round seal, with a bar of pips sweeping out of it. Its
light green border pulses and a glint sweeps across it every few seconds. Spending AP counts the number down, flashes the
spent pips and pops a superscript "-3"; a new turn refills it with a "+N". It bobs gently,
dims during the enemy turn, and picks whichever spot around you covers no chest, creature,
lootable corpse or exit (`ui/gaugePlacement.ts`), always somewhere above you. Hit chance is your weapon skill minus the target's Armor Class (minus a
range penalty for guns; the spear's reach of 2 is still melee), damage is reduced by Damage Resistance, and Luck is your critical
chance. Guns fire from their magazine (10mm pistol 12, hunting rifle 5) and are reloaded
from the backpack with R: free while exploring, 2 AP in combat. A gun you unequip puts its
rounds back in the backpack. Walls and rocks block line of sight (water
doesn't): enemies can't spot or shoot you through them, nor you them, and they walk around
cover to get a clear shot. Get far enough away, or out of range behind cover, and enemies
lose track of you; kill them and their corpses can be looted.

## Layout

```
src/
  core/       Game rules in plain TypeScript, no Phaser imports. Unit tested.
    stats.ts      S.P.E.C.I.A.L., skills and the Fallout formulas derived from them
    items.ts      Item definitions (weight, value, weapon/armor stats)
    container.ts  ItemContainer: stacks of items (backpack, chest)
    character.ts  Character: skills, levels, equipment slots, magazines
    creature.ts   Creature definitions and instances
    fighter.ts    The Attack and Fighter interfaces shared by player and creatures
    combat.ts     Turn-based combat rules and enemy AI; emits events for the scene
    loot.ts       Moving items between containers, honouring carry weight
    grid.ts       Grid positions, directions and distance
    gridMap.ts    Parses ASCII maps into tiles, chests, creatures and exits; line of sight
    random.ts     Seeded random numbers, so generated maps can be rebuilt from a seed
    result.ts     ActionResult: success or failure plus a message for the log
    save.ts       Game state (all visited maps) to and from plain JSON
    generation/   Map generation: Biome, MapBuilder, prefabs, loot/spawn tables, terrain
  data/       Content: the wasteland map, biomes/, and world.ts (which maps exist)
  gfx/        Procedurally generated placeholder pixel art
  audio/      Synthesised sound effects
  ui/         Theme, widgets (panel, buttons, scrollable list), formatting
  scenes/     Phaser scenes: Boot, Menu, World, Hud, Inventory, Loot, Character, Pause,
              GameOver, Controls; flow.ts switches between menus and the game
  state.ts    The running game (player + map), loaded from the save if there is one
  storage.ts  localStorage access for the save
  main.ts     Phaser game config
```

Everything rules-related lives in `core/`, so it can be tested without a browser, and the
rendering layer can change (or be ported) without touching the rules.

# Wasteland (working title)

A small top-down pixel-art RPG inspired by Fallout 1/2: grid movement, lootable chests and
corpses, a weight-limited inventory, turn-based combat with Action Points and line of sight,
XP and levelling, a shopkeeper to talk and barter with, randomly generated maps, autosave,
and synthesised sound effects.

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
goes back to it. Production builds have no way into the arena: the menu entry and the
`?arena` link only exist in development.

The **Test shop (dev)** entry, or http://localhost:5173/?shop, works the same way for talking,
bartering, stealing and starting trouble: the village store in a small yard, with the test
character (and 1000 caps) on the shop floor facing Gus across his counter, the store's crate
behind it, and the guard outside by the door.

## Controls

| Key             | Exploring                        | In combat                     |
| --------------- | -------------------------------- | ----------------------------- |
| Arrows / WASD   | Move; walking into a closed door opens it | Move (1 AP per tile; opening a door costs 1 AP too) |
| E / Space       | Interact with what you face: open a chest, loot a corpse (also one you stand on), talk, open or close a door, pick a lock | Space: end turn |
| Click a person  | Talk, when next to them or across a counter; Ctrl+click attacks them |      |
| F / click enemy | Click: attack (starts combat)    | Attack the target             |
| T               |                                  | Next target                   |
| Tab / I         | Inventory (again to close)       | Inventory (costs 4 AP)        |
| C               | Character sheet: browse S.P.E.C.I.A.L. and skills (with what each does), spend skill points | |
| Q               | Swap primary/secondary weapon    | Same, free                    |
| R               | Reload the gun in hand           | Reload (costs 2 AP)           |
| M               | Sound on/off                     | Sound on/off                  |
| Esc             | Pause menu / close a screen      | Pause menu                    |
| Click (loot)    | Move 1 of a stack; Ctrl+click half (rounded up), Shift+click all |   |
| Space (loot)    | Take all and close               |                               |
| Esc (loot, barter) | Close the screen              |                               |
| A/D, E (lock)   | Lockpicking: choose a pin, press it in (or its number, or click it); Esc gives up | |
| Up/Down, Enter (talk) | Pick a reply and answer (or click it, or press its number); Esc walks away | |
| Click (barter)  | Sell (left) or buy (right) 1; Ctrl+click half, Shift+click all |     |
| W/S, A/D (screens) | Inventory, loot, barter, character sheet: move the `>` cursor up/down a list, and between the lists (arrow keys too). Item lists are sorted by category (weapons, armour, aid, ammo, the rest), and the inventory reopens on the item you last had selected | |
| E (screens)     | Inventory: use, equip (first free hand, else primary), wear or unequip the selected item. Loot, barter: move it to the other side (take/store, buy/sell); Shift+E the whole stack. Character sheet: spend a skill point on the selected skill | |

## Talking and trading

People are creatures that start out **friendly** (`core/creature.ts`): they stay put, don't
notice you as a threat, and talk. Face one (or the counter in front of them) and press E or
Space, or click them. What they say appears as a subtitle in a green-bordered box at the
bottom of the screen, with your replies underneath; `>` marks the one selected. Conversations
are small graphs of lines and replies (`core/dialog.ts`); a reply can lead to another line,
open the barter screen, or end the conversation. Every conversation ends with `*Attack*`.

A new game starts in **Rosa**'s shack, with her right beside you. She found you out cold by
her door, tells you to take the gear in her footlocker, and answers questions: where you are,
what's dangerous around here, and what a mole rat, a radroach or a raider is. She's next
to defenseless: attack her and she fights back with what she has, a slap for 1 damage at
poor odds, until one of you is down or you get away. Killing her earns no XP.

Every village has a small general store with **Gus** behind the counter: "if you break
anything, you buy it!" He sells ammo, two stimpaks and a leather jacket, and buys what you
bring with his own (limited) caps. On the barter screen a click (or E) buys or sells at once, and
the selected item's description and price show under the lists. Prices
depend on Charisma (`core/barter.ts`): you buy at 100% of an item's value at Charisma 10, up
to 136% at 1, and sell for 55% at Charisma 10, down to 28% at 1.

A **guard** stands outside the store: friendly, as long as you behave. People belong to a
group (Gus and the guard to the store), and the whole group turns hostile when you:

- choose `*Attack*` in a conversation, or Ctrl+click a friendly person;
- take anything from the stockroom crate behind the counter, which belongs to the store
  (opening it is fine, and so is taking back something you put in yourself; the loot
  screen closes the moment you're caught).

A Ctrl+click that can't become an attack (no AP, an empty gun, no line of sight) does
nothing, so a misclick doesn't start a fight; only being out of range still does, so
`*Attack*` across the counter with a knife starts the fight and you close in.

Then the fight is on, and the guard joins in even if he can't see you. He's a crack shot
with his 10mm pistol (85% base to hit, against a raider's 50%); Gus only has his fists. Once
hostile, people stay that way: clicking them attacks, and they won't talk any more. Killed,
they leave their goods on their corpse. Hostility, and what Gus has left, are saved. The
guard sees further than any monster, so a village whose store you've turned against you can
greet you with gunfire as you arrive: the rule that nothing attacks on arrival only holds
for creatures that start out hostile.

## Doors, locks and roofs

Buildings have doors (`/` in the map legend). A closed door blocks the way and the view;
walk into it to open it, and press E facing it to close it again (or to open it). Until
you've been inside a building, a roof hides what's in it: it lifts the first time you step
in, and stays off (it's saved). A building is found from the tiles alone
(`core/buildings.ts`): an area closed off by walls and doors, away from the map's edge. If
someone you're fighting is inside one you haven't entered, its roof comes off too.

Doors and chests can be **locked** (`core/locks.ts`). Each lock needs a certain Lockpick
skill: easy 25%, medium 40%, hard 60%, expert 80%. Walk into a locked door (or press E at a
locked chest) and you're told what lock it is and whether you can pick it. With less skill
than the lock needs you can't even try, so come back once you've put skill points into
Lockpick (it starts at 10% + Perception + Agility: 20% for an average character).

With enough skill, E opens the **lockpicking screen** (`scenes/LockpickScene.ts`, rules in
`core/lockPuzzle.ts`): a padlock with pins sticking out of its bottom, to be pushed up into
it in one order, new every time: 3 pins for an easy lock, 4 for a medium one, 5 for a hard
or expert one; the screen's title names the lock and its level (STOCKROOM CRATE - HARD). The
right pin stays in; any other drops every pin back out, and you start over. Once all of
them are in, the lock opens for good. A/D (or the arrow keys) choose a pin and E,
Space or W press it in; a number key or a click press one directly; Esc gives up.

On the wasteland, the shed with the metal locker has an easy lock, and in the village Gus's
stockroom crate has a hard one. Picking the lock of something that belongs to someone (a
chest's or door's `owner`, or a prefab's) is breaking in: like stealing, it turns the owners
hostile, Gus and the guard for the store. Some village houses and hunter's cabins in the
forest are locked up too; nobody lives there any more. People and raiders open
unlocked doors to come after you in a fight; animals and ghouls are kept out by a closed one.

## Weapon and armour condition, and repairs

Every weapon and every piece of armour has a condition, from 100% (perfect) down to 0%
(broken), shown after its name in lists and on the HUD's weapon line once it's worn
("10mm Pistol (62%)"). Each attack wears the weapon in hand, and each hit you take the armour
you wear, by their own amount (`durability.wear` in `core/items.ts`: a knife 0.5%, the
pistol 1.5%, the hunting rifle 2.5% per attack; a leather jacket 2%, leather armour 1.5%,
steel armour 0.8% per hit). At 35% or below they work worse, the more so the lower they get
(`core/condition.ts`):

- a gun hits less often (down to -30%), does less damage (down to half), and a reload can
  take twice the AP (up to a 50% chance); without the AP for it, the reload eats the AP left
  and doesn't get done;
- a melee weapon only does less damage;
- armour protects less (down to half its AC and DR).

At 0% a weapon is broken and can't be used, and armour has fallen apart and protects
nothing, until repaired. Each item keeps its own condition wherever it goes: worn ones don't
stack with good ones, sell (and buy) for less, and gear found in chests comes worn (15-85%).

Repair at a **workbench** (in a village's barn, the forest's logging camp, and the test
maps): press E at it to see all your gear that wears, with what its repair takes. Guns,
blades and steel armour take **scrap metal**, the leather jacket and leather armour
**leather** (from wild dogs' and mole rats' hides, houses and barns, or Gus). How much depends
on how worn the item is and on the item (`durability.repairCost`: a knife 2 scrap from broken
to perfect, the pistol 8, the hunting rifle 15, steel armour 12; leather armour 5 leather).
Short of a full repair, what you have patches it up as far as it goes. You can also
**salvage** gear you don't want there: it's broken down for good, for a little of the
material it's repaired with (1 piece below 50% condition, 2 from 50% up). W/S choose, E
repairs, X salvages (press it twice: it asks first), Esc closes.

**Steel armour** (AC +20, DR 40%, against leather armour's +15 and 25%) is heavy (30 lb) and
dear: Gus sells one, and the forest's logging camp may have one lying about.

The **Repair** skill (3 x Intelligence: 15% for an average character) sets what repairs take:
the listed costs are for 15%, each point above makes them 1% cheaper (half at 65%, at least
1 piece) and below dearer, and every 35% above 15% adds a piece to what salvaging gives.

A **Repair Kit** patches your most worn piece of equipped gear (either hand, or the armour)
back up to 35%, wherever you are: use it from the inventory. Gus sells them, and they turn up
in houses, barns and the logging camp. And **Gus repairs** too: ask him "Can you fix up my
gear?" and he repairs anything to perfect for caps (half of what it lost in value, with the
same Charisma markup as his prices), no materials or skill needed.

Badly worn gear shows on the HUD before it breaks: the weapon line turns orange-red at 35% or
below, and worn armour gets a line of its own above it.

## Maps and biomes

The world is a set of maps joined by exits (signposts on the map edge); walking onto one
takes you to the linked map, next to its exit back. `data/world.ts` lists the maps and how
they connect. A map is either drawn by hand as ASCII art (`data/wasteland.ts`) or generated
from a **biome**: the wasteland's east exit leads to a randomly generated forest, its south
exit to a randomly generated village.

Generated maps are rebuilt from a seed (the world seed, which is new for every game, plus the
map id), so the same game always gets the same forest and saves only store what changed:
looted chests, dead creatures, who has turned hostile, and what traders have left.

A biome's generator draws onto a `MapBuilder` (`core/generation/`), which turns it into an
ordinary ASCII `MapDef`, so generated maps are parsed, saved and drawn like hand-made ones.
Afterwards it carves paths so every exit, chest and creature can be reached. The toolkit:

- `MapBuilder`: paint tiles, stamp prefabs, place chests, creatures and exits.
- `Prefab`: a hand-drawn structure in the map legend, with `$` for its chest, `&` for its
  creatures and capital letters for its residents, particular people who are always there
  (a logging camp, a hunter's cabin, the general store with Gus and the guard, ...). Its
  doors are `/`; `doorLock` locks them with some chance, and the chest can have a `lock`.
  `flipVertical()` turns one around, e.g. for houses on the other side of a street;
  `builder.lock()` keeps roads free of buildings.
- `LootTable` / `SpawnTable`: what a chest can contain, which creatures can appear.
- `terrain.ts`: scatter, cellular smoothing (for groves and caves), blobs, borders, winding
  paths, finding free spots.

The forest (`data/biomes/forest.ts`) has smoothed groves of trees, dirt and grass patches,
sometimes a pond, a raider-held logging camp, a hunter's cabin, campsites and hidden
stashes, and mole rats, radroaches and wild dogs kept out of sight of where you arrive.

The village (`data/biomes/village.ts`) is abandoned and overgrown: a main street with wooden
and brick houses on both sides (doors facing the street), a general store where Gus still
keeps shop, a barn with hay and vermin, fenced fields with mole rats, a well, and feral ghouls,
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

Kills give XP (radroach 25, wild dog 35, mole rat 40, feral ghoul 50, raider 100). Level 2 takes 100 XP, level 3 300,
level 4 600, and so on. Each level adds 3 + Endurance/2 max HP and 5 + 2 x Intelligence skill
points, spent on the character sheet (C). Tagged skills gain 2% per point, others 1%.
The level-up message tells you when you have points to spend.

## Sound

All sound effects are synthesised at runtime with the Web Audio API (`audio/sfx.ts`), so,
like the art, there are no asset files: footsteps (a gravel crunch outdoors, a harder tap on
floors), weapon swings, layered gunshots (crack, overdriven blast, boom, echo), bites, hits,
ricochets, deaths, reloads, pickups, a level-up jingle and menu blips. Each attack's `sound`
field (on weapons and creatures) picks what it sounds like. M toggles sound on any screen,
and is remembered.

## Saving

The game opens on a main menu: Continue (if there is a save), New game and Controls. Esc in the game opens the pause menu, which can go back to
the main menu.

A new game starts with **character creation** (`scenes/CreationScene.ts`, rules in
`core/creation.ts`): type a name, pick male or female (how you look), set the S.P.E.C.I.A.L.
stats (each starts at 5, with 5 more points to spend, 40 in all as in Fallout; lowering a stat
frees its points, down to 1; at most 10) and choose the difficulty. A preview shows what the
stats make you (HP, AP, carry weight...). You start a bit beaten up, on 60% of your maximum HP.
The game only starts with a name and every point spent, and asks once before it overwrites a
saved game; it is saved straight away. Esc goes back to the menu without touching your save.
On the name row you type (W/S/A/D and M are letters there); the arrow keys move on. Difficulty (`core/difficulty.ts`) changes how dangerous
enemies are: on easy they hit you 10% less often and you take 25% less damage, on hard 10%
more often and 25% more damage. It's kept in the save.

The game autosaves to the browser's localStorage after every step, every closed screen and
every finished fight, but never during combat. Dying lets you load that save (so you go back
to just before the fight), start a new game, or return to the main menu. `core/save.ts` turns
the game into plain JSON; `storage.ts` is the only code that touches localStorage. Loading
checks the save's player data and falls back to a new game if it is corrupt. Creatures are
saved by their spawn tile, so adding creatures or chests to the map doesn't break old saves:
the new ones just start fresh.

## Combat

Fallout-style and turn-based, on the same grid you explore. Combat starts when a creature
sees you (or you attack one). You act first with your Action Points, then each enemy takes
its turn. Hit chance is your weapon skill minus the target's Armor Class (minus a range
penalty for guns; the spear's reach of 2 is still melee), damage is reduced by Damage
Resistance, and Luck is your critical chance. Guns fire from their magazine (10mm pistol 12,
hunting rifle 5) and are reloaded from the backpack with R: free while exploring, 2 AP in
combat. A gun you unequip puts its rounds back in the backpack. Walls and rocks block line
of sight (water doesn't): enemies can't spot or shoot you through them, nor you them, and
they walk around cover to get a clear shot. Get far enough away, or out of range behind
cover, and enemies lose track of you; kill them and their corpses can be looted.

Your shots don't pass through people: anyone standing in your line of fire takes the bullet
instead (hit or miss, at their own odds), and the log says so ("Gus is in the way!"). Hit a
friendly bystander and they turn hostile, with their group. Enemies aren't that careful:
their shots fly past whoever is in between and hit you. Melee isn't affected.

During a fight an AP gauge floats above you (`ui/apGauge.ts`): the AP left in a 3x5 pixel
font (`gfx/pixelFont.ts`) inside a round seal, with a bar of pips sweeping out of it. Its
light green border pulses and a glint sweeps across it every few seconds. Spending AP counts
the number down, flashes the spent pips and pops a superscript "-3"; a new turn refills it
with a "+N". It bobs gently, dims during the enemy turn, and always floats above you, picking the spot
there that covers as little as possible of any chest, creature, lootable corpse or exit
(`ui/gaugePlacement.ts`).

The HUD is kept small and mostly sits straight on the map: the message log in the bottom
left, a "COMBAT - YOUR TURN" (or ENEMY TURN) label in the top left during a fight, and
"[muted]" in the top right when the sound is off. Your other stats (level, AC, AP, carry
weight) are on the character sheet (C) and the inventory screen (I).

Your health is always on screen, in the bottom right corner: a black bar whose green border
pulses and shines like the AP gauge's (`ui/glow.ts`), filled dark red, with your HP in it
(orange-red once you're down to a quarter).
Directly above it is the weapon in hand: a gun's name with the rounds in its magazine out of
what it holds and the spare rounds in your pack ("Hunting Rifle 5/5 (+10)"), or just the
name of a melee weapon (`ui/healthBar.ts`).

In a fight, every creature you're fighting has a thin health bar floating just above it:
red for the health it has left, turning black from the right as it loses health, so the bar
always stays the same length. Outside combat, and over creatures that haven't joined the
fight, there are none.

## Layout

```
src/
  core/       Game rules in plain TypeScript, no Phaser imports. Unit tested.
    stats.ts      S.P.E.C.I.A.L., skills and the Fallout formulas derived from them
    creation.ts   Character creation: the build (name, gender, stats, difficulty), point rules
    difficulty.ts Difficulty levels and what they change in combat
    items.ts      Item definitions (weight, value, weapon/armor stats) and item keys
                  (an id, plus a worn weapon's condition)
    condition.ts  Wear of weapons and armour: what it does below 35%, breaking, prices,
                  repair costs
    repair.ts     Repairing and salvaging gear at a workbench (scrap metal, leather)
    container.ts  ItemContainer: stacks of items (backpack, chest)
    character.ts  Character: skills, levels, equipment slots, magazines
    creature.ts   Creature and people definitions (people: dialog, group, trade) and instances
    dialog.ts     Conversations: lines, replies and what they lead to
    barter.ts     Buying and selling, with prices based on Charisma
    fighter.ts    The Attack and Fighter interfaces shared by player and creatures
    combat.ts     Turn-based combat rules and enemy AI; emits events for the scene
    loot.ts       Moving items between containers, honouring carry weight
    grid.ts       Grid positions, directions and distance
    gridMap.ts    Parses ASCII maps into tiles, chests, creatures, doors and exits; line of
                  sight; who you can talk to, provoking groups and noticing theft; buildings
                  entered
    buildings.ts  Finding buildings (walled areas with a door) and what their roofs cover
    locks.ts      Locks on doors and chests, and who has the Lockpick skill to try one
    lockPuzzle.ts The lockpicking puzzle: 3 to 5 pins, one order
    random.ts     Seeded random numbers, so generated maps can be rebuilt from a seed
    result.ts     ActionResult: success or failure plus a message for the log
    save.ts       Game state (all visited maps) to and from plain JSON
    generation/   Map generation: Biome, MapBuilder, prefabs, loot/spawn tables, terrain
  data/       Content: the wasteland map, biomes/, and world.ts (which maps exist)
  gfx/        Procedurally generated placeholder pixel art
  audio/      Synthesised sound effects
  ui/         Theme, widgets (panel, buttons, scrollable list), formatting, and the pure logic
              behind the HUD and screens: AP gauge and its placement, health bars and worn-gear
              warnings, the shared glow, dialog box, barter lists, workbench rows, the message
              log, creation screen keys
  scenes/     Phaser scenes: Boot, Menu, Creation, World, Hud, Inventory, Loot, Lockpick,
              Workbench, Dialog, Barter, Character, Pause, GameOver, Controls; flow.ts switches
              between menus and the game
  state.ts    The running game (player + map), loaded from the save if there is one
  storage.ts  localStorage access for the save
  main.ts     Phaser game config
```

Everything rules-related lives in `core/`, so it can be tested without a browser, and the
rendering layer can change (or be ported) without touching the rules.

## Working on the code

The project skill in `.claude/skills/wasteland-game/` is the developer guide, written for
Claude Code sessions but just as readable by people:

- `SKILL.md`: the architecture and why it's built this way, design decisions (including ones
  tried and rejected), pitfalls, and working conventions.
- `references/workflow.md`: feature branches and squash-merged PRs, several sessions working
  side by side (worktrees, dev server ports, files that often conflict), the docs every
  feature updates, and checking changes in headless Chrome.
- `references/extending.md`: recipes for adding items, creatures, people, dialog actions,
  skills, tiles, biomes and sounds.
- `references/roadmap.md`: planned features, and what past reviews fixed.

Every feature updates this README, the skill and the roadmap in its own branch, so they
always describe `main`.

# Wasteland (working title)

A small top-down pixel-art RPG inspired by Fallout 1/2: grid movement, lootable chests,
a weight-limited inventory and, next up, turn-based combat with Action Points.

Built with TypeScript, [Phaser 3](https://phaser.io) and Vite.

## Running

```sh
npm install
npm run dev        # dev server with hot reload, open the printed URL
npm test           # unit tests for the game rules (src/core)
npm run build      # typecheck + production build into dist/
```

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
| Esc             | Pause menu / close a screen      | Pause menu                    |
| Space (loot)    | Take all                         |                               |
| E / Esc (loot)  | Close the loot screen            |                               |

## Levelling

Kills give XP (radroach 25, mole rat 40, raider 100). Level 2 takes 100 XP, level 3 300,
level 4 600, and so on. Each level adds 3 + Endurance/2 max HP and 5 + 2 x Intelligence skill
points, spent on the character sheet (C). Tagged skills gain 2% per point, others 1%.
A `+` after your level in the HUD means you have points to spend.

## Saving

The game opens on a main menu: Continue (if there is a save), New game (asks before
overwriting a save) and Controls. Esc in the game opens the pause menu, which can go back to
the main menu.

The game autosaves to the browser's localStorage after every step, every closed screen and
every finished fight, but never during combat. Dying lets you load that save (so you go back
to just before the fight), start a new game, or return to the main menu. `core/save.ts` turns the game into plain
JSON; `storage.ts` is the only code that touches localStorage.

## Combat

Fallout-style and turn-based, on the same grid you explore. Combat starts when a creature
sees you (or you attack one). You act first with your Action Points, then each enemy
takes its turn. Hit chance is your weapon skill minus the target's Armor Class (minus a
range penalty for guns), damage is reduced by Damage Resistance, and Luck is your critical
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
    items.ts      Item definitions (weight, value, weapon/armor stats)
    container.ts  ItemContainer: stacks of items (backpack, chest)
    character.ts  Character: S.P.E.C.I.A.L., skills, derived stats, equipment slots
    creature.ts   Creature definitions and instances
    combat.ts     Turn-based combat rules and enemy AI; emits events for the scene
    loot.ts       Moving items between containers, honouring carry weight
    gridMap.ts    Parses ASCII maps into tiles, chests and creatures
    save.ts       Game state to and from plain JSON
  data/       Maps and other content
  gfx/        Procedurally generated placeholder pixel art
  ui/         Theme, widgets (panel, buttons, scrollable list), formatting
  scenes/     Phaser scenes: Boot, Menu, World, Hud, Inventory, Loot, Character, Pause,
              GameOver, Controls; flow.ts switches between menus and the game
  state.ts    The running game (player + map), loaded from the save if there is one
  storage.ts  localStorage access for the save
  main.ts     Phaser game config
```

Everything rules-related lives in `core/`, so it can be tested without a browser, and the
rendering layer can change (or be ported) without touching the rules.

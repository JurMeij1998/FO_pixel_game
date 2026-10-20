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
| Q               | Swap primary/secondary weapon    | Same, free                    |
| Esc             | Close a screen                   |                               |
| Space (loot)    | Take all                         |                               |
| E / Esc (loot)  | Close the loot screen            |                               |

## Combat

Fallout-style and turn-based, on the same grid you explore. Combat starts when a creature
sees you (or you attack one). You act first with your Action Points, then each enemy
takes its turn. Hit chance is your weapon skill minus the target's Armor Class (minus a
range penalty for guns), damage is reduced by Damage Resistance, and Luck is your critical
chance. Guns use ammo from your backpack. Get far enough away and enemies lose track of
you; kill them and their corpses can be looted.

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
  data/       Maps and other content
  gfx/        Procedurally generated placeholder pixel art
  ui/         Theme, widgets (panel, buttons, scrollable list), formatting
  scenes/     Phaser scenes: Boot, World, Hud, Inventory, Loot, GameOver
  state.ts    The running game (player + map)
  main.ts     Phaser game config
```

Everything rules-related lives in `core/`, so it can be tested without a browser, and the
rendering layer can change (or be ported) without touching the rules.

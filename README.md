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

| Key            | Action                         |
| -------------- | ------------------------------ |
| Arrows / WASD  | Move                           |
| E / Space      | Interact with the tile you face |
| I              | Inventory                      |
| Q              | Swap primary/secondary weapon  |
| Esc            | Close a screen                 |
| A (loot screen)| Take all                       |

## Layout

```
src/
  core/       Game rules in plain TypeScript, no Phaser imports. Unit tested.
    items.ts      Item definitions (weight, value, weapon/armor stats)
    container.ts  ItemContainer: stacks of items (backpack, chest)
    character.ts  Character: S.P.E.C.I.A.L., derived stats, equipment slots
    loot.ts       Moving items between containers, honouring carry weight
    gridMap.ts    Parses ASCII maps into tiles and chests
  data/       Maps and other content
  gfx/        Procedurally generated placeholder pixel art
  ui/         Theme, widgets (panel, buttons, scrollable list), formatting
  scenes/     Phaser scenes: Boot, World, Hud, Inventory, Loot
  state.ts    The running game (player + map)
  main.ts     Phaser game config
```

Everything rules-related lives in `core/`, so it can be tested without a browser, and the
rendering layer can change (or be ported) without touching the rules.

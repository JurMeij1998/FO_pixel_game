# Extending the game

Recipes for the common additions. Each lists where the pieces live and what is easy to forget.

## Item

1. Add an `ItemDef` to `DEFINITIONS` in `src/core/items.ts`: id, name, category, weight (lbs per
   unit), value (caps per unit), description.
2. Weapons also need `weapon`: `skill` (`smallGuns` makes it ranged; melee otherwise, even with
   reach > 1 like the spear), damage range, `apCost`, `range` and `sound` (an `AttackSound`).
   Guns additionally need `ammo` (an ammo item id) and `magazineSize`. Weapons and armour also
   need `durability`: `wear` (condition lost per attack, or per hit taken for armour, in
   percent), `repairCost` (how much material from broken to perfect; better gear costs more)
   and `material` (`scrap_metal`, `leather`; a new one goes in `MATERIALS` in
   core/condition.ts and `SHORT_MATERIAL` in ui/workbench.ts). To place a worn one, use its
   key: `itemKey('10mm_pistol', 55)`; found loot comes worn by itself (`rollLoot`).
3. Armor needs `armor: { armorClass, damageResist }`; consumables `consumable: { heal }`.
4. Make it obtainable: add it to chest contents in a map, a creature's corpse `loot`, or a
   biome `LootTable`.

## Creature

1. Add a `CreatureDef` to `src/core/creature.ts`: stats, `sightRange` (how far it notices you),
   `experience` (XP for the kill), `attack` (with `ranged` and `sound`), and corpse `loot`.
2. Draw a 16x16 sprite keyed by the creature id in `SPRITES` (`src/gfx/sprites.ts`); the sprite
   test checks the size.
3. Place it: a letter in a hand-made map's `creatures`, or a `SpawnTable` entry in a biome or
   prefab. Biomes keep spawns `SAFE_SPAWN_DISTANCE` (`terrain.ts`) from every arrival point,
   derived from `MAX_SIGHT_RANGE` in `creature.ts`: add a larger `sightRange` there too.
4. Mention its XP in the README's levelling section.

## Person (someone you can talk to)

1. Add a `CreatureDef` to `src/core/creature.ts` like Gus or the guard: `friendly: true`,
   `properName` if they have a name, a `group` if others should side with them, a `dialog`
   (nodes of text and replies; a reply has a `next` node and/or an `action`, `barter`,
   `attack` or `leave`; a line may have no replies), combat stats for when they're provoked
   (someone defenseless, like Rosa, gets a pitiful attack: they still take on the fight),
   and `loot`. For a trader add `trader: true`: `loot` is then also their stock, with
   `bottle_caps` as their money. `validateDialog` throws at startup on a broken graph.
   *Attack* is added to every line automatically.
2. Draw a 16x16 sprite keyed by the id in `SPRITES`.
3. Place them: a letter in a hand-made map's `creatures`, or a capital letter in a prefab's rows
   mapped in its `residents`. Behind a counter, the counter (`]`) goes between them and the
   shop floor so the player can talk across it. Give a chest `owner: '<group>'` to make taking
   from it (or picking its lock) theft, and their house the same `owner` (a prefab's `owner`,
   or a hand-made map's `doors` entry) to make picking its door's lock a crime too.
   `playabilityProblems` checks someone can reach a talking spot.
4. A new dialog action needs a case in `DialogScene.answer()`.

## Tile

1. Add the name to `TileType` and a free **symbol** (not a letter or digit, and not `$`/`&`,
   which are prefab slots) to `LEGEND` in `src/core/gridMap.ts`.
2. Decide whether it goes in `BLOCKING` (can't walk through) and `OPAQUE` (can't see or shoot
   through). TypeScript won't flag a missing entry here, so think it through: low obstacles
   (water, logs, fences, hay, shelves) block walking only. Doors (`/`) are in neither: an
   open door is walked and seen through, a closed one isn't (`GridMap.isWalkable`,
   `blocksSight`), and map generation counts them as a way through.
3. Add a painter to `TILE_PAINTERS` in `src/gfx/textures.ts`; TypeScript does flag a missing one.
   Paint the same ground as its usual surroundings underneath, or it shows as a square of a
   different colour (trees on brown dirt looked like green squares in the village).
4. Footsteps: `WorldScene.showStride()` picks `stepFloor` for hard floors, gravel otherwise.

## Biome

1. Write `src/data/biomes/<name>.ts` exporting a `Biome`: `id`, `version` (start at 1; bump it
   whenever a change makes the same seed build a different map, so saves drop the old map's
   state), `names`, `width`, `height`, `baseTile`, `pathTile`, and
   `generate(builder, { rng, exits })`. Use the toolkit in
   `src/core/generation/`:
   - `MapBuilder`: `set`/`paint` tiles, `stamp` prefabs, `addChest`, `addCreature`,
     `addExit(side, to, pathChar)` (call it for every requested exit; it rolls its own offset from
     a per-exit seed and returns the entry tile), `lock` tiles that nothing may be built on (roads).
   - `Prefab`: ASCII structure with `$` chest and `&` creature slots, an `entrance` just outside
     its door (`/`); `flipVertical()` turns it around for the other side of a street. Walls
     and doors around a floor make it a building with a roof (`core/buildings.ts`): give a
     building a door, not a gap, or it has no roof. A workbench is `!` (repairs weapons; E at it). `doorLock: { lock, chance }` locks its
     doors with that chance; `chest.lock` always locks the chest (`LOCKS` in core/locks.ts).
     `owner` (a group) makes the building someone's: picking its doors' locks turns that
     group hostile, as `chest.owner` does for the chest (taking from it, or picking it).
   - `LootTable` / `rollLoot`, `SpawnTable`.
   - `terrain.ts`: `scatter`, `smooth` (cellular automaton; groves, caves), `blob`, `border`,
     `windingPath`, `findSpot`, `findOpenTile`, `farFrom`, `hasRoomAround`, and
     `placeStructure(b, prefab, rng, { occupied, spacing, arrivals, ... })` for stamping a prefab
     with its creature slots kept away from the arrivals.
   Only use `rng` for randomness. Keep creature spawns (including prefab creatures) out of sight
   of every arrival point (`farFrom(entries, SAFE_SPAWN_DISTANCE)`). A layout that throws is
   retried with another seed, but that hides bugs: the tests should pass on the first attempt. Check each prefab by hand: a door that opens onto an inner wall makes
   the whole structure unreachable, and `connect()` will then throw.
2. Register it in `src/data/biomes/index.ts`.
3. Give it a place in `src/data/world.ts` with its exits, plus a matching exit on the
   neighbouring map so you arrive beside the way back. Adding an exit to an existing
   *generated* map changes its fingerprint, so existing saves drop that map's chests and
   creatures and you arrive at its start; that's fine, but worth telling the user.
4. Copy `src/data/biomes/village.test.ts`: determinism, `playabilityProblems(map)` over ~40
   seeds and several exit layouts (every exit, chest and creature reachable; nothing sees any
   arrival), and composition checks.
5. Print a couple of generated maps as ASCII and look at them before trying it in the browser.

## Sound

1. Add a name to `SoundName` and a recipe to `SOUNDS` in `src/audio/sfx.ts`, built from
   `v.noise(...)` and `v.tone(...)` layers (frequency, filter sweep, envelope, optional drive).
2. Keep it level with the rest: render it with an OfflineAudioContext (import `scheduleSound`
   from the dev server in headless Chrome) and compare peak and RMS. Band-passed noise needs a
   higher volume than you'd expect to be heard; gunshots peak around 0.73.
3. Call `playSound(name)` where it happens; attack sounds come from the attack's `sound` field.

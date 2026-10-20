import { Character, type CharacterData } from './character';
import { isGridPos, type GridPos } from './grid';
import { GridMap, type MapDef } from './gridMap';

/** Bump when the format changes in a way old saves can't be read; old saves are then ignored. */
export const SAVE_VERSION = 1;

type Entries = Array<[itemId: string, quantity: number]>;

/**
 * A saved game, as plain JSON. The map layout itself isn't saved: it is parsed fresh from its
 * MapDef, and only what can change (chests, creatures) is stored on top, keyed by id.
 */
export interface SaveData {
  version: number;
  player: CharacterData;
  chests: Record<string, { opened: boolean; contents: Entries }>;
  creatures: Record<string, { hitPoints: number; pos: GridPos; contents: Entries }>;
}

export function saveGame(player: Character, map: GridMap): SaveData {
  const chests: SaveData['chests'] = {};
  for (const chest of map.chests) chests[chest.id] = { opened: chest.opened, contents: chest.contents.toData() };

  const creatures: SaveData['creatures'] = {};
  for (const c of map.creatures) {
    creatures[c.id] = { hitPoints: c.hitPoints, pos: { ...c.pos }, contents: c.contents.toData() };
  }
  return { version: SAVE_VERSION, player: player.toData(), chests, creatures };
}

/**
 * Rebuilds the game from a save. Throws if the save is from another version or its player data
 * is invalid. Chests and creatures that the save doesn't mention (because they were added to
 * the map later) keep their starting state.
 */
export function loadGame(data: unknown, mapDef: MapDef): { player: Character; map: GridMap } {
  const save = data as SaveData;
  if (save?.version !== SAVE_VERSION) throw new Error(`Unsupported save version ${save?.version}`);

  const map = GridMap.parse(mapDef);
  for (const chest of map.chests) {
    const saved = save.chests?.[chest.id];
    if (!saved) continue;
    chest.opened = saved.opened === true;
    chest.contents.setData(saved.contents);
  }
  map.creatures.forEach((creature, index) => {
    // Older saves keyed creatures by their order on the map ("radroach_0") instead of their spawn tile.
    const saved = save.creatures?.[creature.id] ?? save.creatures?.[`${creature.def.id}_${index}`];
    if (!saved) return;
    if (!Number.isInteger(saved.hitPoints) || !isGridPos(saved.pos)) throw new Error(`Invalid creature '${creature.id}'`);
    creature.hitPoints = Math.max(0, Math.min(creature.maxHitPoints, saved.hitPoints));
    creature.pos = { ...saved.pos };
    creature.contents.setData(saved.contents);
  });
  return { player: Character.fromData(save.player), map };
}

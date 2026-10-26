import type { Character } from './character';
import type { Creature } from './creature';
import type { DialogCondition, DialogWorld, QuestStep } from './dialog';
import type { GridMap } from './gridMap';
import { getItem } from './items';

/**
 * Quests: errands people give you, with a reward when they're done. The log only remembers
 * which quests you've taken on and which you've finished; everything else (whether you have
 * the items, whether the creatures are dead, whether the person is still around to pay you)
 * is read from the game as it is, so it can't get out of step with it and needs no saving.
 */

/** Someone in a particular map: a person's creature id, and the map they live in. */
export interface PersonRef {
  creature: string;
  map: string;
}

export type QuestGoal =
  /** Bring the giver this many of an item; they take them when you finish. */
  | { kind: 'fetch'; itemId: string; quantity: number }
  /** Kill every creature of a kind on a map. */
  | { kind: 'kill'; creature: string; map: string }
  /** Take an item (handed to you when you take the quest on) to someone else, who finishes it. */
  | { kind: 'deliver'; itemId: string; to: PersonRef };

export interface QuestReward {
  caps?: number;
  items?: Array<[itemId: string, quantity: number]>;
  experience: number;
}

export interface QuestDef {
  id: string;
  title: string;
  giver: PersonRef;
  goal: QuestGoal;
  reward: QuestReward;
  /** What to do, for the quest list, while it isn't done yet. */
  objective: string;
  /** What's left once the goal is met: who to see. */
  whenReady: string;
}

/** What the log remembers about a quest. Not started is simply not being in it. */
export type QuestStatus = 'active' | 'done';

/**
 * Where a quest stands, read from the log and the game: not taken on yet ('new'), taken on
 * ('active'), goal met and waiting to be handed in ('ready'), finished ('done'), or impossible
 * to finish because the person who'd finish it is dead or has turned on you ('failed').
 */
export type QuestStage = 'new' | 'active' | 'ready' | 'done' | 'failed';

const WASTELAND = 'wasteland';
const VILLAGE = 'village';

const DEFINITIONS: QuestDef[] = [
  {
    id: 'pond_pests',
    title: 'Pond Pests',
    giver: { creature: 'mags', map: WASTELAND },
    goal: { kind: 'kill', creature: 'radroach', map: WASTELAND },
    reward: { caps: 40, experience: 100 },
    objective: 'Kill the radroaches by the pond, southwest of the shack.',
    whenReady: 'Tell Mags the radroaches are dead.',
  },
  {
    id: 'hides_for_silas',
    title: 'Hides for Silas',
    giver: { creature: 'silas', map: WASTELAND },
    goal: { kind: 'fetch', itemId: 'leather', quantity: 3 },
    reward: { caps: 30, items: [['ammo_223', 10]], experience: 75 },
    objective: 'Bring Silas 3 pieces of leather.',
    whenReady: 'Take the leather to Silas.',
  },
  {
    id: 'medicine_for_mags',
    title: 'Medicine for Mags',
    giver: { creature: 'doctor', map: VILLAGE },
    goal: { kind: 'deliver', itemId: 'medicine_pouch', to: { creature: 'mags', map: WASTELAND } },
    reward: { caps: 25, items: [['stimpak', 1]], experience: 75 },
    objective: 'Take the medicine pouch to Mags, south of the shack in the wasteland.',
    whenReady: 'Take the medicine pouch to Mags, south of the shack in the wasteland.',
  },
];

const QUESTS = new Map(DEFINITIONS.map((def) => [def.id, def]));

export function getQuest(id: string): QuestDef {
  const def = QUESTS.get(id);
  if (!def) throw new Error(`Unknown quest id '${id}'`);
  return def;
}

export function isQuestId(id: string): boolean {
  return QUESTS.has(id);
}

export const QUEST_IDS: readonly string[] = DEFINITIONS.map((def) => def.id);

/** Which quests the player has taken on and finished, in the order they were taken on. */
export class QuestLog {
  private readonly statuses = new Map<string, QuestStatus>();

  status(id: string): QuestStatus | null {
    return this.statuses.get(id) ?? null;
  }

  /** The quests taken on, oldest first. */
  get ids(): string[] {
    return [...this.statuses.keys()];
  }

  /** Takes a quest on. Returns false, changing nothing, if it was taken on before. */
  start(id: string): boolean {
    getQuest(id);
    if (this.statuses.has(id)) return false;
    this.statuses.set(id, 'active');
    return true;
  }

  /** Marks an active quest done. Returns false, changing nothing, if it isn't active. */
  finish(id: string): boolean {
    if (this.statuses.get(id) !== 'active') return false;
    this.statuses.set(id, 'done');
    return true;
  }

  toData(): Record<string, QuestStatus> {
    return Object.fromEntries(this.statuses);
  }

  /**
   * Rebuilds a log from toData() output, or from a save that has none (older saves: an empty
   * log). Quests the game no longer has and anything that isn't a status are left out.
   */
  static fromData(data: unknown): QuestLog {
    const log = new QuestLog();
    if (typeof data !== 'object' || data === null || Array.isArray(data)) return log;
    for (const [id, status] of Object.entries(data)) {
      if (isQuestId(id) && (status === 'active' || status === 'done')) log.statuses.set(id, status);
    }
    return log;
  }
}

/** What the quest rules look at and change. */
export interface QuestWorld {
  player: Character;
  /** Every visited map, by id. */
  maps: Record<string, GridMap>;
  quests: QuestLog;
}

/** The person, if their map has been visited and they're on it; null if not (or not known yet). */
function findPerson(ref: PersonRef, maps: Record<string, GridMap>): Creature | null | undefined {
  const map = maps[ref.map];
  if (!map) return undefined; // not visited yet: can't tell
  return map.creatures.find((c) => c.def.id === ref.creature) ?? null;
}

/** Whoever hands a quest in: the giver, or for a delivery the one it's for. */
function finisherOf(def: QuestDef): PersonRef {
  return def.goal.kind === 'deliver' ? def.goal.to : def.giver;
}

function goalMet(def: QuestDef, world: QuestWorld): boolean {
  const goal = def.goal;
  switch (goal.kind) {
    case 'fetch':
      return world.player.backpack.count(goal.itemId) >= goal.quantity;
    case 'deliver':
      return world.player.backpack.count(goal.itemId) >= 1;
    case 'kill': {
      const targets = world.maps[goal.map]?.creatures.filter((c) => c.def.id === goal.creature) ?? [];
      return targets.length > 0 && targets.every((c) => c.isDead);
    }
  }
}

export function questStage(id: string, world: QuestWorld): QuestStage {
  const def = getQuest(id);
  const status = world.quests.status(id);
  if (status === 'done') return 'done';
  if (status === null) return 'new';
  // Dead, turned hostile, or gone from their map: no one is left to hand it in to.
  const finisher = findPerson(finisherOf(def), world.maps);
  if (finisher === null || (finisher && (finisher.isDead || finisher.hostile))) return 'failed';
  return goalMet(def, world) ? 'ready' : 'active';
}

/** Takes a quest on (handing over what's to be delivered). Returns the lines to show, or none if it was taken on before. */
export function startQuest(id: string, world: QuestWorld): string[] {
  const def = getQuest(id);
  if (!world.quests.start(id)) return [];
  const lines = [`New quest: ${def.title}. Press J for your quests.`];
  if (def.goal.kind === 'deliver') {
    world.player.backpack.add(def.goal.itemId);
    lines.push(`You got the ${getItem(def.goal.itemId).name}.`);
  }
  return lines;
}

/**
 * Hands a quest in: takes what was fetched or delivered and gives the reward. Only when it's
 * ready, so a reward can't be had twice. Returns the lines to show, or none if it wasn't ready.
 */
export function finishQuest(id: string, world: QuestWorld): string[] {
  const def = getQuest(id);
  if (questStage(id, world) !== 'ready') return [];
  const goal = def.goal;
  if (goal.kind === 'fetch') world.player.backpack.remove(goal.itemId, goal.quantity);
  if (goal.kind === 'deliver') world.player.backpack.remove(goal.itemId, 1);
  world.quests.finish(id);

  const { caps, items = [], experience } = def.reward;
  if (caps) world.player.backpack.add('bottle_caps', caps);
  for (const [itemId, quantity] of items) world.player.backpack.add(itemId, quantity);
  const levels = world.player.gainExperience(experience);
  const gains = [
    ...(caps ? [`${caps} caps`] : []),
    ...items.map(([itemId, quantity]) => `${quantity > 1 ? `${quantity} ` : ''}${getItem(itemId).name}`),
    `${experience} XP`,
  ];
  const lines = [`Quest done: ${def.title}.`, `You got ${gains.join(', ')}.`];
  if (levels > 0) lines.push(`Level up! You are now level ${world.player.level}. Press C to spend skill points.`);
  return lines;
}

/** Whether a dialog condition holds in this world. */
export function conditionHolds(condition: DialogCondition, world: QuestWorld): boolean {
  const stage = questStage(condition.quest, world);
  return Array.isArray(condition.stage) ? condition.stage.includes(stage) : condition.stage === stage;
}

/** Lets conversations check quest stages and start and finish quests in this world. */
export function questDialogWorld(world: QuestWorld): DialogWorld {
  return {
    holds: (condition) => conditionHolds(condition, world),
    take: (step: QuestStep) => ('start' in step ? startQuest(step.start, world) : finishQuest(step.finish, world)),
  };
}

/** One quest as the quest list shows it: its title, its stage, and what to do next (if anything). */
export interface QuestEntry {
  id: string;
  title: string;
  stage: QuestStage;
  /** What to do, or '' once it's done or failed. */
  todo: string;
}

/** The quests taken on, for the quest list: the ones still open first (oldest first), then done and failed ones. */
export function questEntries(world: QuestWorld): QuestEntry[] {
  const entries = world.quests.ids.map((id): QuestEntry => {
    const def = getQuest(id);
    const stage = questStage(id, world);
    const todo = stage === 'active' ? def.objective : stage === 'ready' ? def.whenReady : '';
    return { id, title: def.title, stage, todo };
  });
  const open = (e: QuestEntry) => e.stage === 'active' || e.stage === 'ready';
  return [...entries.filter(open), ...entries.filter((e) => !open(e))];
}

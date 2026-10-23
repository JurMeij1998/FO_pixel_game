import { ItemContainer } from './container';
import { validateDialog, type Dialog, type DialogReply } from './dialog';
import type { Attack, Fighter } from './fighter';
import type { GridPos } from './grid';

/**
 * Creatures and people. Most creatures are hostile from the start. People (Gus the
 * shopkeeper, the guard) start out friendly: they don't notice you as a threat, you can talk
 * to them, and they stand where they are. Attacking one, or stealing from their group, turns
 * their whole group hostile, and from then on they fight like any other creature.
 */
export interface CreatureDef {
  id: string;
  name: string;
  /** A person's name ("Gus") rather than a kind of creature ("Radroach"): no "the" in messages. */
  properName?: boolean;
  /** Starts out friendly instead of hostile. */
  friendly?: boolean;
  /** Who they side with: when one of a group turns hostile, the rest of it does too. */
  group?: string;
  /** What they say when you talk to them, while friendly. */
  dialog?: Dialog;
  /** Trades the contents of their pack (`loot`, caps included) on the barter screen. */
  trader?: boolean;
  /**
   * Opens doors (unlocked ones) to get at you in a fight: people and raiders do, animals and
   * feral ghouls don't. Everyone else is kept out (or in) by a closed door.
   */
  opensDoors?: boolean;
  maxHitPoints: number;
  actionPoints: number;
  armorClass: number;
  damageResist: number;
  critChance: number;
  /** Notices the player within this many tiles and starts combat. */
  sightRange: number;
  /** XP the player gets for killing it. */
  experience: number;
  attack: Attack;
  /** What its corpse holds; for a trader, also what they have to trade while alive. */
  loot: Array<[itemId: string, quantity: number]>;
}

const ROSA_QUESTIONS: DialogReply[] = [
  { text: 'Where am I?', next: 'where' },
  { text: 'Is it dangerous out there?', next: 'dangers' },
  { text: 'What is a mole rat?', next: 'mole_rat' },
  { text: "What's a radroach?", next: 'radroach' },
  { text: 'Who are the raiders?', next: 'raiders' },
  { text: "Thanks. I'll be on my way.", action: 'leave' },
];

/** After each answer you can ask Rosa something else. */
const rosaAnswer = (text: string) => ({ text, replies: ROSA_QUESTIONS });

const DEFINITIONS: CreatureDef[] = [
  {
    id: 'radroach',
    name: 'Radroach',
    maxHitPoints: 8,
    actionPoints: 5,
    armorClass: 3,
    damageResist: 0,
    critChance: 2,
    sightRange: 4,
    experience: 25,
    attack: { name: 'bite', damageMin: 1, damageMax: 4, apCost: 3, range: 1, ranged: false, hitChance: 50, sound: 'bite' },
    loot: [],
  },
  {
    id: 'mole_rat',
    name: 'Mole Rat',
    maxHitPoints: 14,
    actionPoints: 6,
    armorClass: 4,
    damageResist: 0,
    critChance: 3,
    sightRange: 5,
    experience: 40,
    attack: { name: 'bite', damageMin: 2, damageMax: 6, apCost: 4, range: 1, ranged: false, hitChance: 55, sound: 'bite' },
    loot: [['leather', 1]], // its hide, for patching leather armour
  },
  {
    id: 'wild_dog',
    name: 'Wild Dog',
    maxHitPoints: 12,
    actionPoints: 8, // fast: closes in and bites in the same turn
    armorClass: 6,
    damageResist: 0,
    critChance: 4,
    sightRange: 6,
    experience: 35,
    attack: { name: 'bite', damageMin: 2, damageMax: 5, apCost: 3, range: 1, ranged: false, hitChance: 55, sound: 'bite' },
    loot: [['leather', 1]], // its hide, for patching leather armour
  },
  {
    id: 'feral_ghoul',
    name: 'Feral Ghoul',
    maxHitPoints: 18,
    actionPoints: 7,
    armorClass: 4,
    damageResist: 0,
    critChance: 4,
    sightRange: 6,
    experience: 50,
    attack: { name: 'claws', damageMin: 3, damageMax: 7, apCost: 3, range: 1, ranged: false, hitChance: 55, sound: 'bite' },
    loot: [['bottle_caps', 3]],
  },
  {
    id: 'raider',
    name: 'Raider',
    opensDoors: true,
    maxHitPoints: 24,
    actionPoints: 7,
    armorClass: 5,
    damageResist: 10,
    critChance: 5,
    sightRange: 7,
    experience: 100,
    attack: { name: 'pistol', damageMin: 3, damageMax: 9, apCost: 5, range: 6, ranged: true, hitChance: 50, sound: 'pistol' },
    loot: [
      ['bottle_caps', 25],
      ['ammo_10mm', 8],
      ['stimpak', 1],
    ],
  },
  {
    // Keeps the village store. Fights back if he has to, but not well.
    id: 'shopkeeper',
    name: 'Gus',
    properName: true,
    friendly: true,
    opensDoors: true,
    group: 'store',
    trader: true,
    maxHitPoints: 20,
    actionPoints: 6,
    armorClass: 3,
    damageResist: 0,
    critChance: 2,
    sightRange: 6,
    experience: 40,
    attack: { name: 'fists', damageMin: 1, damageMax: 4, apCost: 3, range: 1, ranged: false, hitChance: 55, sound: 'punch' },
    loot: [
      ['ammo_10mm', 40],
      ['ammo_223', 20],
      ['stimpak', 2],
      ['leather_jacket', 1],
      ['steel_armor', 1],
      ['leather', 4],
      ['bottle_caps', 300],
    ],
    dialog: {
      start: 'greeting',
      nodes: {
        greeting: {
          text: 'Welcome to my store, stranger. Look around all you like, but if you break anything, you buy it!',
          replies: [
            { text: "Let's barter.", next: 'anything_else', action: 'barter' },
            { text: 'Goodbye.', action: 'leave' },
          ],
        },
        anything_else: {
          text: 'Anything else?',
          replies: [
            { text: "Let's barter.", action: 'barter' },
            { text: 'Goodbye.', action: 'leave' },
          ],
        },
      },
    },
  },
  {
    // Lives in the shack where a new game starts, and tells you about the area. Next to
    // defenseless: attacked, she fights back with what she has, which is a slap.
    id: 'rosa',
    name: 'Rosa',
    properName: true,
    friendly: true,
    opensDoors: true,
    maxHitPoints: 12,
    actionPoints: 5,
    armorClass: 2,
    damageResist: 0,
    critChance: 0,
    sightRange: 5,
    experience: 0,
    attack: { name: 'slap', damageMin: 1, damageMax: 1, apCost: 4, range: 1, ranged: false, hitChance: 30, sound: 'punch' },
    loot: [['bottle_caps', 12]],
    dialog: {
      start: 'hello',
      nodes: {
        hello: {
          text:
            "You're awake! Easy now. I found you out cold by my door and dragged you in here. I'm Rosa. " +
            "That footlocker's got some old gear in it; take it, you'll need it more than I do.",
          replies: ROSA_QUESTIONS,
        },
        where: rosaAnswer(
          "The wasteland, or what's left of it. This is my shack, on the west edge. The road east runs into " +
            'the forest, and the path south leads to an old village. Gus still keeps his store there.',
        ),
        dangers: rosaAnswer(
          'Radroaches nest by the pond to the southwest, a mole rat has been digging around northeast of ' +
            "here, and a raider's camped out to the southeast, by an old supply cache. He's armed.",
        ),
        mole_rat: rosaAnswer(
          'Big, bald, pink and mean. They burrow through the dirt and bite anything that moves. One on its ' +
            "own won't kill you, but it'll take a chunk out of you.",
        ),
        radroach: rosaAnswer(
          'Cockroaches the size of a dog, thanks to the radiation. Weak, slow-witted, and never alone for long.',
        ),
        raiders: rosaAnswer(
          "Thugs who take what they want and shoot whoever minds. Don't walk up to one with just a knife.",
        ),
      },
    },
  },
  {
    // Watches the store's door. A crack shot with his 10mm pistol.
    id: 'guard',
    name: 'Guard',
    friendly: true,
    opensDoors: true,
    group: 'store',
    maxHitPoints: 40,
    actionPoints: 8,
    armorClass: 10,
    damageResist: 20,
    critChance: 8,
    sightRange: 8,
    experience: 150,
    attack: { name: '10mm pistol', damageMin: 5, damageMax: 12, apCost: 5, range: 6, ranged: true, hitChance: 85, sound: 'pistol' },
    loot: [
      ['10mm_pistol@60', 1], // his sidearm has seen some use (item keys: core/items.ts)
      ['ammo_10mm', 24],
      ['bottle_caps', 15],
    ],
    dialog: {
      start: 'warning',
      nodes: {
        warning: { text: "Gus is under my protection. Keep your hands off his stock and we'll get along fine.", replies: [] },
      },
    },
  },
];

const CREATURES = new Map(DEFINITIONS.map((def) => [def.id, def]));
for (const def of DEFINITIONS) if (def.dialog) validateDialog(def.dialog, def.name);

/**
 * The farthest any hostile creature can see; map generation keeps spawns beyond it from
 * arrival points. Friendly people don't count: they don't start fights.
 */
export const MAX_SIGHT_RANGE = Math.max(...DEFINITIONS.filter((def) => !def.friendly).map((def) => def.sightRange));

export function getCreatureDef(id: string): CreatureDef {
  const def = CREATURES.get(id);
  if (!def) throw new Error(`Unknown creature id '${id}'`);
  return def;
}

/** One creature on the map. Once dead it stays as a lootable corpse. */
export class Creature implements Fighter {
  hitPoints: number;
  /** The corpse's contents; while alive, only a trader's stock is reachable (by bartering). */
  readonly contents: ItemContainer;
  /** Fights the player on sight. Friendly people become hostile when provoked; never back. */
  hostile: boolean;

  constructor(
    readonly id: string,
    readonly def: CreatureDef,
    public pos: GridPos,
  ) {
    this.hitPoints = def.maxHitPoints;
    this.contents = new ItemContainer(def.loot);
    this.hostile = !def.friendly;
  }

  get name(): string {
    return this.def.name;
  }

  /** How messages refer to it mid-sentence: "Gus", or "the radroach". */
  get theName(): string {
    return this.def.properName ? this.def.name : `the ${this.def.name}`;
  }

  /** Alive, friendly, and with something to say. */
  get canTalk(): boolean {
    return !this.isDead && !this.hostile && this.def.dialog !== undefined;
  }

  get isDead(): boolean {
    return this.hitPoints <= 0;
  }

  get maxHitPoints(): number {
    return this.def.maxHitPoints;
  }

  get maxActionPoints(): number {
    return this.def.actionPoints;
  }

  get armorClass(): number {
    return this.def.armorClass;
  }

  get damageResist(): number {
    return this.def.damageResist;
  }

  get critChance(): number {
    return this.def.critChance;
  }

  get attack(): Attack {
    return this.def.attack;
  }
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** For messages: "Gus", "Gus and the Guard", "the Guard, Gus and the Radroach". */
export function listNames(creatures: readonly Creature[]): string {
  const names = creatures.map((c) => c.theName);
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : (names[0] ?? '');
}

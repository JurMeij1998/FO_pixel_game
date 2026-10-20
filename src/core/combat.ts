import type { Character } from './character';
import type { Creature } from './creature';
import type { Fighter } from './fighter';
import { addPos, DIRECTIONS, distance, samePos, type GridPos } from './grid';
import type { GridMap } from './gridMap';

export const MOVE_AP_COST = 1;
/** Opening the backpack mid-fight costs AP, as in Fallout 1. */
export const INVENTORY_AP_COST = 4;
/** Ranged attacks lose this much hit chance per tile beyond point-blank. */
const RANGE_PENALTY_PER_TILE = 3;
/** Creatures give up the chase once the player is this far beyond their sight range. */
const GIVE_UP_MARGIN = 2;

export type CombatOutcome = 'victory' | 'defeat' | 'escaped';

export type CombatEvent =
  | { type: 'move'; fighter: Fighter; to: GridPos }
  | {
      type: 'attack';
      attacker: Fighter;
      target: Fighter;
      ranged: boolean;
      hit: boolean;
      critical: boolean;
      damage: number;
      killed: boolean;
      message: string;
      /** The level the player reached with this kill, if they levelled up. */
      newLevel: number | null;
    };

/** Either the events that happened, for the scene to animate, or why nothing happened. */
export type CombatAction = { ok: true; events: CombatEvent[] } | { ok: false; message: string };

const done = (events: CombatEvent[]): CombatAction => ({ ok: true, events });
const refused = (message: string): CombatAction => ({ ok: false, message });

/**
 * One fight, from start to outcome. The rules resolve instantly and mutate the
 * fighters; every action returns CombatEvents so the scene can replay them as animations.
 *
 * Turn order is simple: the player, then every participating creature in turn.
 */
export class Combat {
  readonly participants: Creature[] = [];
  /** Action points left in the player's current turn. */
  actionPoints: number;
  /** The creature the player has selected to attack. */
  target: Creature | null = null;
  outcome: CombatOutcome | null = null;
  private playerTurn = true;

  constructor(
    private readonly map: GridMap,
    private readonly player: Character,
    /** Returns values in [0, 1); injectable so tests are deterministic. */
    private readonly rng: () => number = Math.random,
  ) {
    this.recruitSpotters();
    this.actionPoints = player.maxActionPoints;
    this.target = this.nearestEnemy();
  }

  /** Living creatures that can see the player. If there are any, combat should start. */
  static spotters(map: GridMap, player: Character): Creature[] {
    return map.creatures.filter(
      (c) => !c.isDead && distance(c.pos, player.pos) <= c.def.sightRange && map.hasLineOfSight(c.pos, player.pos),
    );
  }

  get isPlayerTurn(): boolean {
    return this.playerTurn && !this.outcome;
  }

  get livingEnemies(): Creature[] {
    return this.participants.filter((c) => !c.isDead);
  }

  hitChance(attacker: Fighter, target: Fighter): number {
    const { hitChance, range } = attacker.attack;
    let chance = hitChance - target.armorClass;
    if (range > 1) chance -= RANGE_PENALTY_PER_TILE * Math.max(0, distance(attacker.pos, target.pos) - 1);
    return Math.max(5, Math.min(95, chance));
  }

  canSee(a: Fighter, b: Fighter): boolean {
    return this.map.hasLineOfSight(a.pos, b.pos);
  }

  /** Why the player can't attack this target right now, or null if they can. */
  attackProblem(target: Creature): string | null {
    if (!this.isPlayerTurn) return "It isn't your turn.";
    if (target.isDead) return `The ${target.name} is already dead.`;
    const attack = this.player.attack;
    if (this.actionPoints < attack.apCost) return `Attacking with the ${attack.name} takes ${attack.apCost} AP.`;
    if (distance(this.player.pos, target.pos) > attack.range) return `The ${target.name} is out of range.`;
    if (!this.canSee(this.player, target)) return `You can't see the ${target.name} from here.`;
    if (attack.ammo && this.player.backpack.count(attack.ammo) === 0) return "You're out of ammo.";
    return null;
  }

  movePlayer(step: GridPos): CombatAction {
    if (!this.isPlayerTurn) return refused("It isn't your turn.");
    if (this.actionPoints < MOVE_AP_COST) return refused('You are out of action points.');
    const to = addPos(this.player.pos, step);
    if (!this.isFree(to)) return refused('Something is in the way.');

    this.player.pos = to;
    this.actionPoints -= MOVE_AP_COST;
    return done([{ type: 'move', fighter: this.player, to }]);
  }

  attack(target: Creature): CombatAction {
    const problem = this.attackProblem(target);
    if (problem) return refused(problem);
    const attack = this.player.attack;
    if (attack.ammo) this.player.backpack.remove(attack.ammo);

    this.actionPoints -= attack.apCost;
    if (!this.participants.includes(target)) this.participants.push(target);
    this.target = target;
    const event = this.resolveAttack(this.player, target);
    if (target.isDead) this.target = this.nearestEnemy();
    return done([event]);
  }

  /** Pays for something that isn't a move or an attack, such as opening the inventory. */
  spendActionPoints(cost: number): boolean {
    if (!this.isPlayerTurn || this.actionPoints < cost) return false;
    this.actionPoints -= cost;
    return true;
  }

  /** Selects the next living enemy, nearest first. */
  cycleTarget(): void {
    const enemies = this.enemiesByDistance();
    if (enemies.length === 0) return;
    const index = this.target ? enemies.indexOf(this.target) : -1;
    this.target = enemies[(index + 1) % enemies.length];
  }

  /** Ends the player's turn and plays out every enemy's turn. */
  endTurn(): CombatEvent[] {
    if (!this.isPlayerTurn) return [];
    this.playerTurn = false;

    const events: CombatEvent[] = [];
    for (const enemy of this.livingEnemies) {
      this.runEnemyTurn(enemy, events);
      if (this.outcome) return events;
    }

    this.dropLostEnemies();
    this.recruitSpotters();
    if (this.livingEnemies.length === 0) {
      this.outcome = 'escaped';
      return events;
    }

    this.playerTurn = true;
    this.actionPoints = this.player.maxActionPoints;
    if (!this.target || !this.livingEnemies.includes(this.target)) this.target = this.nearestEnemy();
    return events;
  }

  /** Simple AI: attack while it can and has the AP, otherwise walk towards a spot it can attack from. */
  private runEnemyTurn(enemy: Creature, events: CombatEvent[]): void {
    let ap = enemy.maxActionPoints;
    const { apCost } = enemy.attack;
    while (!this.outcome) {
      if (this.canAttackFrom(enemy, enemy.pos)) {
        if (ap < apCost) return;
        ap -= apCost;
        events.push(this.resolveAttack(enemy, this.player));
        continue;
      }
      if (ap < MOVE_AP_COST) return;
      const step = this.nextStepToward(enemy);
      if (!step) return;
      enemy.pos = step;
      ap -= MOVE_AP_COST;
      events.push({ type: 'move', fighter: enemy, to: step });
    }
  }

  private resolveAttack(attacker: Fighter, target: Fighter): CombatEvent {
    const attack = attacker.attack;
    const ranged = attack.range > 1;
    const subject = attacker === this.player ? 'You' : `The ${attacker.name}`;
    const object = target === this.player ? 'you' : `the ${target.name}`;

    if (this.rng() * 100 >= this.hitChance(attacker, target)) {
      const message = `${subject} ${attacker === this.player ? 'miss' : 'misses'} ${object}.`;
      return {
        type: 'attack',
        attacker,
        target,
        ranged,
        hit: false,
        critical: false,
        damage: 0,
        killed: false,
        message,
        newLevel: null,
      };
    }

    const critical = this.rng() * 100 < attacker.critChance;
    let damage = attack.damageMin + Math.floor(this.rng() * (attack.damageMax - attack.damageMin + 1));
    if (critical) damage *= 2;
    damage = Math.max(1, Math.round((damage * (100 - target.damageResist)) / 100));
    target.hitPoints = Math.max(0, target.hitPoints - damage);
    const killed = target.hitPoints === 0;

    const verb = attacker === this.player ? 'hit' : 'hits';
    let message = `${subject} ${critical ? `critically ${verb}` : verb} ${object} for ${damage}.`;
    if (killed) message += target === this.player ? ' You die.' : ` The ${target.name} dies.`;

    let newLevel: number | null = null;
    if (killed && attacker === this.player) {
      // The player only ever attacks creatures.
      const experience = (target as Creature).def.experience;
      message += ` You gain ${experience} XP.`;
      if (this.player.gainExperience(experience) > 0) newLevel = this.player.level;
    }

    if (this.player.hitPoints === 0) this.outcome = 'defeat';
    else if (this.livingEnemies.length === 0) this.outcome = 'victory';
    return { type: 'attack', attacker, target, ranged, hit: true, critical, damage, killed, message, newLevel };
  }

  /** In range and with a clear line of sight. */
  private canAttackFrom(enemy: Creature, pos: GridPos): boolean {
    return distance(pos, this.player.pos) <= enemy.attack.range && this.map.hasLineOfSight(pos, this.player.pos);
  }

  /**
   * Breadth-first search from the creature to the nearest tile from which it can attack.
   * Returns the first step of that path, or null if it is already in range or has no way there.
   */
  private nextStepToward(enemy: Creature): GridPos | null {
    const key = (p: GridPos) => p.y * this.map.width + p.x;
    const cameFrom = new Map<number, GridPos | null>([[key(enemy.pos), null]]);
    const queue: GridPos[] = [enemy.pos];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (this.canAttackFrom(enemy, current)) {
        // Walk the path back to the step right after the start.
        let step = current;
        let previous = cameFrom.get(key(step)) ?? null;
        if (!previous) return null;
        while (!samePos(previous, enemy.pos)) {
          step = previous;
          previous = cameFrom.get(key(step))!;
        }
        return step;
      }
      for (const direction of DIRECTIONS) {
        const next = addPos(current, direction);
        if (cameFrom.has(key(next)) || !this.isFree(next)) continue;
        cameFrom.set(key(next), current);
        queue.push(next);
      }
    }
    return null;
  }

  private isFree(pos: GridPos): boolean {
    return this.map.isWalkable(pos.x, pos.y) && !samePos(pos, this.player.pos);
  }

  private recruitSpotters(): void {
    for (const creature of Combat.spotters(this.map, this.player)) {
      if (!this.participants.includes(creature)) this.participants.push(creature);
    }
  }

  /** Creatures give up when you are well out of sight range, or out of range and hidden behind cover. */
  private dropLostEnemies(): void {
    for (let i = this.participants.length - 1; i >= 0; i--) {
      const c = this.participants[i];
      if (c.isDead) continue;
      const d = distance(c.pos, this.player.pos);
      const hidden = d > c.def.sightRange && !this.map.hasLineOfSight(c.pos, this.player.pos);
      if (d > c.def.sightRange + GIVE_UP_MARGIN || hidden) this.participants.splice(i, 1);
    }
  }

  private enemiesByDistance(): Creature[] {
    return this.livingEnemies.sort((a, b) => distance(a.pos, this.player.pos) - distance(b.pos, this.player.pos));
  }

  private nearestEnemy(): Creature | null {
    return this.enemiesByDistance()[0] ?? null;
  }
}

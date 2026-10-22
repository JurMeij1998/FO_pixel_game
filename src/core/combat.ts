import type { Character } from './character';
import { capitalize, listNames, type Creature } from './creature';
import { DIFFICULTIES, type Difficulty } from './difficulty';
import type { AttackSound, Fighter } from './fighter';
import { addPos, DIRECTIONS, distance, samePos, type GridPos } from './grid';
import type { Door, GridMap } from './gridMap';
import { failure, type ActionResult } from './result';

export const MOVE_AP_COST = 1;
/** Opening the backpack mid-fight costs AP, as in Fallout 1. */
export const INVENTORY_AP_COST = 4;
export const RELOAD_AP_COST = 2;
/** Ranged attacks lose this much hit chance per tile beyond point-blank. */
const RANGE_PENALTY_PER_TILE = 3;
/** Creatures give up the chase once the player is this far beyond their sight range. */
const GIVE_UP_MARGIN = 2;

export type CombatOutcome = 'victory' | 'defeat' | 'escaped';

export type CombatEvent =
  | { type: 'move'; fighter: Fighter; to: GridPos }
  /** Someone opened a door (it costs a move's AP). */
  | { type: 'door'; fighter: Fighter; door: Door }
  | {
      type: 'attack';
      attacker: Fighter;
      target: Fighter;
      ranged: boolean;
      /** Captured when the attack happens, so swapping weapons mid-animation can't change it. */
      sound: AttackSound;
      hit: boolean;
      critical: boolean;
      damage: number;
      killed: boolean;
      /**
       * The target's health just before and after this attack, captured when it happens: the
       * scene shows health dropping as each hit lands, not when the whole turn was resolved.
       */
      targetHitPoints: { before: number; after: number };
      message: string;
      /** The level the player reached with this kill, if they levelled up. */
      newLevel: number | null;
    };

export type AttackEvent = Extract<CombatEvent, { type: 'attack' }>;

export type AttackProblemCode = 'notYourTurn' | 'targetDead' | 'noAP' | 'outOfRange' | 'noLineOfSight' | 'empty';
export interface AttackProblem {
  code: AttackProblemCode;
  message: string;
}

/** Either the events that happened, for the scene to animate, or why nothing happened. */
export type CombatAction =
  | { ok: true; events: CombatEvent[] }
  | { ok: false; message: string; problem?: AttackProblemCode };

const done = (events: CombatEvent[]): CombatAction => ({ ok: true, events });
const refused = (message: string, problem?: AttackProblemCode): CombatAction => ({ ok: false, message, problem });
const problem = (code: AttackProblemCode, message: string): AttackProblem => ({ code, message });

/**
 * One fight, from start to outcome. The rules resolve instantly and mutate the
 * fighters; every action returns CombatEvents so the scene can replay them as animations.
 *
 * Turn order is simple: the player, then every participating creature in turn. endTurn()
 * resolves the enemies' turns; the scene calls startPlayerTurn() once it has animated them,
 * so the HUD doesn't show "your turn" (and full AP) while enemies are still moving on screen.
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
    private readonly rng: () => number,
    /**
     * How dangerous enemies are to the player: their hit chance and damage (core/difficulty.ts).
     * Required, so a fight started somewhere new can't quietly ignore the chosen difficulty.
     */
    private readonly difficulty: Difficulty,
  ) {
    this.recruitSpotters();
    this.actionPoints = player.maxActionPoints;
    this.target = this.nearestEnemy();
  }

  /** Living hostile creatures that can see the player. If there are any, combat should start. */
  static spotters(map: GridMap, player: Character): Creature[] {
    return map.creatures.filter(
      (c) =>
        !c.isDead &&
        c.hostile &&
        distance(c.pos, player.pos) <= c.def.sightRange &&
        map.hasLineOfSight(c.pos, player.pos),
    );
  }

  /**
   * Brings creatures into the fight whether or not they can see the player, such as a guard
   * called in when the shopkeeper is attacked. Only hostile ones take part.
   */
  join(creatures: Creature[]): void {
    for (const creature of creatures) {
      if (creature.hostile && !creature.isDead && !this.participants.includes(creature)) this.participants.push(creature);
    }
    this.ensureTarget();
  }

  get isPlayerTurn(): boolean {
    return this.playerTurn && !this.outcome;
  }

  get livingEnemies(): Creature[] {
    return this.participants.filter((c) => !c.isDead);
  }

  hitChance(attacker: Fighter, target: Fighter): number {
    const { hitChance, ranged } = attacker.attack;
    let chance = hitChance - target.armorClass;
    if (target === this.player) chance += DIFFICULTIES[this.difficulty].enemyHitChance;
    if (ranged) chance -= RANGE_PENALTY_PER_TILE * Math.max(0, distance(attacker.pos, target.pos) - 1);
    return Math.max(5, Math.min(95, chance));
  }

  canSee(a: Fighter, b: Fighter): boolean {
    return this.map.hasLineOfSight(a.pos, b.pos);
  }

  /** Why the player can't attack this target right now, or null if they can. */
  attackProblem(target: Creature): AttackProblem | null {
    if (!this.isPlayerTurn) return problem('notYourTurn', "It isn't your turn.");
    if (target.isDead) return problem('targetDead', `${capitalize(target.theName)} is already dead.`);
    const attack = this.player.attack;
    // Kept short: they go to the message log when an attack is refused.
    if (this.actionPoints < attack.apCost) return problem('noAP', `Not enough AP (attack costs ${attack.apCost}).`);
    if (distance(this.player.pos, target.pos) > attack.range) {
      return problem('outOfRange', `${capitalize(target.theName)} is out of range.`);
    }
    if (!this.canSee(this.player, target)) return problem('noLineOfSight', `You can't see ${target.theName} from here.`);
    if (attack.ammo && this.player.loadedRounds() === 0) return problem('empty', 'Empty! Press R to reload.');
    return null;
  }

  movePlayer(step: GridPos): CombatAction {
    if (!this.isPlayerTurn) return refused("It isn't your turn.");
    if (this.actionPoints < MOVE_AP_COST) return refused('You are out of action points.');
    const to = addPos(this.player.pos, step);
    const door = this.map.isClosedDoor(to.x, to.y) ? this.map.doorAt(to.x, to.y)! : null;
    if (door) {
      // Walking into a closed door opens it, for the price of a step.
      const opened = this.map.openDoor(door);
      if (!opened.ok) return refused(opened.message);
      this.actionPoints -= MOVE_AP_COST;
      return done([{ type: 'door', fighter: this.player, door }]);
    }
    if (!this.isFree(to)) return refused('Something is in the way.');
    // Leaving the map isn't possible mid-fight, so there's no point stepping onto an exit.
    if (this.map.exitAt(to.x, to.y)) return refused("You can't leave in the middle of a fight.");

    this.player.pos = to;
    this.actionPoints -= MOVE_AP_COST;
    return done([{ type: 'move', fighter: this.player, to }]);
  }

  /**
   * Attacks a creature. Attacking a friendly one turns it (and its group) hostile first; the
   * map does that (GridMap.provoke), since it happens outside combat too, so the target must
   * be hostile by now.
   */
  attack(target: Creature): CombatAction {
    const blocked = this.attackProblem(target);
    if (blocked) return refused(blocked.message, blocked.code);
    if (!target.hostile) throw new Error(`${target.name} is still friendly; provoke them first`);
    const attack = this.player.attack;
    if (attack.ammo) this.player.spendRound();

    this.actionPoints -= attack.apCost;
    if (!this.participants.includes(target)) this.participants.push(target);
    this.target = target;

    // Your shot stops at the first creature in its way: it hits them (at their own odds) or
    // misses, but never flies on through them to the target.
    const inTheWay = this.inTheWay(target);
    if (!inTheWay) return done([this.resolveAttack(this.player, target)]); // the target stays selected until its death is shown; see ensureTarget()
    const event = this.resolveAttack(this.player, inTheWay);
    event.message = `${capitalize(inTheWay.theName)} is in the way! ${event.message}`;
    if (event.hit && !inTheWay.hostile) {
      // Shooting a friendly bystander turns them (and their group) against you.
      const angered = this.map.provoke(inTheWay);
      this.join(angered);
      if (angered.length > 0) event.message += ` ${capitalize(listNames(angered))} turn${angered.length > 1 ? '' : 's'} hostile!`;
    }
    // A hostile one who wasn't in the fight yet (out of their sight, say) is now.
    this.join([inTheWay]);
    return done([event]);
  }

  /**
   * The first living creature between the player and a target, which a ranged attack would hit
   * instead. Melee attacks (even a spear's reach) aren't stopped. Enemies' shots don't check
   * this: they always fly on to the player.
   */
  inTheWay(target: Creature): Creature | null {
    if (!this.player.attack.ranged) return null;
    for (const tile of this.map.lineOfFire(this.player.pos, target.pos) ?? []) {
      const creature = this.map.livingCreatureAt(tile.x, tile.y);
      if (creature) return creature;
    }
    return null;
  }

  reload(): ActionResult {
    if (!this.isPlayerTurn) return failure("It isn't your turn.");
    if (this.actionPoints < RELOAD_AP_COST) return failure(`Reloading takes ${RELOAD_AP_COST} AP.`);
    const result = this.player.reload();
    if (result.ok) this.actionPoints -= RELOAD_AP_COST;
    return result;
  }

  /** Pays for something that isn't a move or an attack, such as opening the inventory. */
  spendActionPoints(cost: number): boolean {
    if (!this.isPlayerTurn || this.actionPoints < cost) return false;
    this.actionPoints -= cost;
    return true;
  }

  /** Selects the nearest living enemy if the current target is dead or no longer in the fight. */
  ensureTarget(): void {
    if (!this.target || !this.livingEnemies.includes(this.target)) this.target = this.nearestEnemy();
  }

  /** Selects the next living enemy, nearest first. */
  cycleTarget(): void {
    const enemies = this.enemiesByDistance();
    if (enemies.length === 0) return;
    const index = this.target ? enemies.indexOf(this.target) : -1;
    this.target = enemies[(index + 1) % enemies.length];
  }

  /** Ends the player's turn and resolves every enemy's turn. Call startPlayerTurn() afterwards. */
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
    if (this.livingEnemies.length === 0) this.outcome = 'escaped';
    return events;
  }

  /** Gives the player their turn and a fresh set of AP, once the enemies' turns have been shown. */
  startPlayerTurn(): void {
    if (this.playerTurn || this.outcome) return;
    this.playerTurn = true;
    this.actionPoints = this.player.maxActionPoints;
    this.ensureTarget();
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
      if (this.map.isClosedDoor(step.x, step.y)) {
        // Only those who open doors path through them, and only unlocked ones (see opensThrough).
        const door = this.map.doorAt(step.x, step.y)!;
        this.map.openDoor(door);
        ap -= MOVE_AP_COST;
        events.push({ type: 'door', fighter: enemy, door });
        continue;
      }
      enemy.pos = step;
      ap -= MOVE_AP_COST;
      events.push({ type: 'move', fighter: enemy, to: step });
    }
  }

  private resolveAttack(attacker: Fighter, target: Fighter): AttackEvent {
    const attack = attacker.attack;
    const { ranged, sound } = attack;
    const subject = attacker === this.player ? 'You' : capitalize((attacker as Creature).theName);
    const object = target === this.player ? 'you' : (target as Creature).theName;

    if (this.rng() * 100 >= this.hitChance(attacker, target)) {
      const message = `${subject} ${attacker === this.player ? 'miss' : 'misses'} ${object}.`;
      return {
        type: 'attack',
        attacker,
        target,
        ranged,
        sound,
        hit: false,
        critical: false,
        damage: 0,
        killed: false,
        targetHitPoints: { before: target.hitPoints, after: target.hitPoints },
        message,
        newLevel: null,
      };
    }

    const critical = this.rng() * 100 < attacker.critChance;
    let damage = attack.damageMin + Math.floor(this.rng() * (attack.damageMax - attack.damageMin + 1));
    if (critical) damage *= 2;
    // Damage resistance, then (for hits on the player) the difficulty, rounded once at the end:
    // rounding in between would make easy and hard change nothing on small hits.
    const difficulty = target === this.player ? DIFFICULTIES[this.difficulty].damageTaken : 1;
    damage = Math.max(1, Math.round(((damage * (100 - target.damageResist)) / 100) * difficulty));
    const before = target.hitPoints;
    target.hitPoints = Math.max(0, target.hitPoints - damage);
    const killed = target.hitPoints === 0;

    const verb = attacker === this.player ? 'hit' : 'hits';
    let message = `${subject} ${critical ? `critically ${verb}` : verb} ${object} for ${damage}.`;
    if (killed) message += target === this.player ? ' You die.' : ` ${capitalize((target as Creature).theName)} dies.`;

    let newLevel: number | null = null;
    // The player only ever attacks creatures. Some (Rosa) aren't worth any XP.
    const experience = killed && attacker === this.player ? (target as Creature).def.experience : 0;
    if (experience > 0) {
      message += ` You gain ${experience} XP.`;
      if (this.player.gainExperience(experience) > 0) newLevel = this.player.level;
    }

    if (this.player.hitPoints === 0) this.outcome = 'defeat';
    else if (this.livingEnemies.length === 0) this.outcome = 'victory';
    const targetHitPoints = { before, after: target.hitPoints };
    return { type: 'attack', attacker, target, ranged, sound, hit: true, critical, damage, killed, targetHitPoints, message, newLevel };
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
        if (cameFrom.has(key(next)) || !(this.isFree(next) || this.opensThrough(enemy, next))) continue;
        cameFrom.set(key(next), current);
        queue.push(next);
      }
    }
    return null;
  }

  private isFree(pos: GridPos): boolean {
    return this.map.isWalkable(pos.x, pos.y) && !samePos(pos, this.player.pos);
  }

  /** A closed, unlocked door this creature can open on its way (nobody stands in a closed doorway). */
  private opensThrough(enemy: Creature, pos: GridPos): boolean {
    if (!enemy.def.opensDoors || !this.map.isClosedDoor(pos.x, pos.y)) return false;
    return this.map.doorAt(pos.x, pos.y)!.lock === null;
  }

  private recruitSpotters(): void {
    for (const creature of Combat.spotters(this.map, this.player)) {
      if (!this.participants.includes(creature)) this.participants.push(creature);
    }
  }

  /**
   * Creatures give up when you are well out of reach, or out of reach and hidden behind cover.
   * "Reach" is the larger of their sight range and your weapon's range, so you can't snipe a
   * creature from just outside its sight and have it forget you every turn.
   */
  private dropLostEnemies(): void {
    const playerReach = this.player.attack.range;
    for (let i = this.participants.length - 1; i >= 0; i--) {
      const c = this.participants[i];
      if (c.isDead) continue;
      const reach = Math.max(c.def.sightRange, playerReach);
      const d = distance(c.pos, this.player.pos);
      const hidden = d > reach && !this.map.hasLineOfSight(c.pos, this.player.pos);
      if (d > reach + GIVE_UP_MARGIN || hidden) this.participants.splice(i, 1);
    }
  }

  private enemiesByDistance(): Creature[] {
    return this.livingEnemies.sort((a, b) => distance(a.pos, this.player.pos) - distance(b.pos, this.player.pos));
  }

  private nearestEnemy(): Creature | null {
    return this.enemiesByDistance()[0] ?? null;
  }
}

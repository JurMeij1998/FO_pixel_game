import type { QuestStage } from './quests';

/**
 * Conversations as small graphs of lines: a person says a node's text, and each reply either
 * leads to another node or ends with an action the scene carries out (opening the barter
 * screen, attacking, or leaving). Lines and replies can depend on how a quest stands (`when`),
 * and a reply can take a quest on or hand one in (`quest`); the conversation asks a
 * `DialogWorld` about both, so this file knows nothing about the game itself.
 */
export type DialogAction = 'barter' | 'repair' | 'attack' | 'leave';

/** Holds when the quest is at that stage (or one of those stages): see core/quests.ts. */
export interface DialogCondition {
  quest: string;
  stage: QuestStage | QuestStage[];
}

/** Takes a quest on, or hands it in (which only works once it's ready). */
export type QuestStep = { start: string } | { finish: string };

export interface DialogReply {
  text: string;
  /** The node the person answers with. */
  next?: string;
  /** What choosing this reply does, instead of (or after) moving to `next`. */
  action?: DialogAction;
  /** Only offered while this holds. */
  when?: DialogCondition;
  /** Done when the reply is chosen, before moving to `next` (so that line can depend on it). */
  quest?: QuestStep;
}

export interface DialogNode {
  text: string;
  /** May be empty: someone who just says their piece. You can still leave (or attack). */
  replies: DialogReply[];
}

export interface Dialog {
  /** The node a conversation opens with, unless one of the `greetings` applies. */
  start: string;
  /** Other openings, by how quests stand: the first whose condition holds is used instead of `start`. */
  greetings?: Array<{ when: DialogCondition; node: string }>;
  nodes: Record<string, DialogNode>;
}

/** What a conversation needs from the game: checking conditions, and taking quest steps. */
export interface DialogWorld {
  holds(condition: DialogCondition): boolean;
  /** Carries out a quest step; returns what to tell the player (nothing if it didn't happen). */
  take(step: QuestStep): string[];
}

/** No game behind the conversation: no condition holds, and quest steps do nothing. */
export const NO_WORLD: DialogWorld = { holds: () => false, take: () => [] };

/** Offered at the end of every line, so anyone you can talk to can also be attacked. */
export const ATTACK_REPLY: DialogReply = { text: '*Attack*', action: 'attack' };
/** Offered (first, so it's the one selected) on a line that has no replies of its own. */
export const LEAVE_REPLY: DialogReply = { text: 'Leave.', action: 'leave' };

/**
 * Throws if a dialog refers to a node it doesn't have, has a reply that goes nowhere, or
 * (given the known quest ids) names a quest that doesn't exist.
 */
export function validateDialog(dialog: Dialog, owner: string, isQuest: (id: string) => boolean = () => true): void {
  const check = (id: string, from: string) => {
    if (!dialog.nodes[id]) throw new Error(`${owner}: ${from} leads to unknown node '${id}'`);
  };
  const checkQuest = (id: string, from: string) => {
    if (!isQuest(id)) throw new Error(`${owner}: ${from} names unknown quest '${id}'`);
  };
  check(dialog.start, 'the start');
  for (const greeting of dialog.greetings ?? []) {
    check(greeting.node, 'a greeting');
    checkQuest(greeting.when.quest, 'a greeting');
  }
  for (const [id, node] of Object.entries(dialog.nodes)) {
    for (const reply of node.replies) {
      if (reply.next) check(reply.next, `a reply in '${id}'`);
      else if (!reply.action) throw new Error(`${owner}: reply '${reply.text}' in '${id}' goes nowhere`);
      if (reply.when) checkQuest(reply.when.quest, `a reply in '${id}'`);
      if (reply.quest) checkQuest('start' in reply.quest ? reply.quest.start : reply.quest.finish, `a reply in '${id}'`);
    }
  }
}

/** One conversation in progress: where it is, and what picking a reply does. */
export class Conversation {
  private nodeId: string;
  /** What the last reply's quest step had to tell (a quest taken on, a reward), until the next reply. */
  private news: string[] = [];

  constructor(
    private readonly dialog: Dialog,
    private readonly world: DialogWorld = NO_WORLD,
  ) {
    this.nodeId = dialog.greetings?.find((g) => world.holds(g.when))?.node ?? dialog.start;
  }

  /** What the person is saying now. */
  get text(): string {
    return this.dialog.nodes[this.nodeId].text;
  }

  /** What the last reply's quest step brought about, to show with the line. */
  get notice(): readonly string[] {
    return this.news;
  }

  /**
   * The replies on offer: the line's own that apply now (or just "Leave." if none do), then
   * *Attack*.
   */
  get replies(): DialogReply[] {
    const own = this.dialog.nodes[this.nodeId].replies.filter((r) => !r.when || this.world.holds(r.when));
    return [...(own.length > 0 ? own : [LEAVE_REPLY]), ATTACK_REPLY];
  }

  /**
   * Takes the reply's quest step, if any, moves to its next node, if it has one, and returns
   * its action, if any.
   */
  choose(index: number): DialogAction | null {
    const reply = this.replies[index];
    if (!reply) throw new RangeError(`No reply ${index}`);
    this.news = reply.quest ? this.world.take(reply.quest) : [];
    if (reply.next) this.nodeId = reply.next;
    return reply.action ?? null;
  }
}

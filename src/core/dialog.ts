/**
 * Conversations as small graphs of lines: a person says a node's text, and each reply either
 * leads to another node or ends with an action the scene carries out (opening the barter
 * screen, attacking, or leaving).
 */
export type DialogAction = 'barter' | 'repair' | 'attack' | 'leave';

export interface DialogReply {
  text: string;
  /** The node the person answers with. */
  next?: string;
  /** What choosing this reply does, instead of (or after) moving to `next`. */
  action?: DialogAction;
}

export interface DialogNode {
  text: string;
  /** May be empty: someone who just says their piece. You can still leave (or attack). */
  replies: DialogReply[];
}

export interface Dialog {
  /** The node a conversation opens with. */
  start: string;
  nodes: Record<string, DialogNode>;
}

/** Offered at the end of every line, so anyone you can talk to can also be attacked. */
export const ATTACK_REPLY: DialogReply = { text: '*Attack*', action: 'attack' };
/** Offered (first, so it's the one selected) on a line that has no replies of its own. */
export const LEAVE_REPLY: DialogReply = { text: 'Leave.', action: 'leave' };

/** Throws if a dialog refers to a node it doesn't have, or has a reply that goes nowhere. */
export function validateDialog(dialog: Dialog, owner: string): void {
  const check = (id: string, from: string) => {
    if (!dialog.nodes[id]) throw new Error(`${owner}: ${from} leads to unknown node '${id}'`);
  };
  check(dialog.start, 'the start');
  for (const [id, node] of Object.entries(dialog.nodes)) {
    for (const reply of node.replies) {
      if (reply.next) check(reply.next, `a reply in '${id}'`);
      else if (!reply.action) throw new Error(`${owner}: reply '${reply.text}' in '${id}' goes nowhere`);
    }
  }
}

/** One conversation in progress: where it is, and what picking a reply does. */
export class Conversation {
  private nodeId: string;

  constructor(private readonly dialog: Dialog) {
    this.nodeId = dialog.start;
  }

  /** What the person is saying now. */
  get text(): string {
    return this.dialog.nodes[this.nodeId].text;
  }

  /** The replies on offer: the line's own (or just "Leave." if it has none), then *Attack*. */
  get replies(): DialogReply[] {
    const own = this.dialog.nodes[this.nodeId].replies;
    return [...(own.length > 0 ? own : [LEAVE_REPLY]), ATTACK_REPLY];
  }

  /** Moves to the reply's next node, if it has one, and returns its action, if any. */
  choose(index: number): DialogAction | null {
    const reply = this.replies[index];
    if (!reply) throw new RangeError(`No reply ${index}`);
    if (reply.next) this.nodeId = reply.next;
    return reply.action ?? null;
  }
}

import { GAME_HEIGHT, GAME_WIDTH, HUD_BOTTOM } from '../config';
import type { Conversation, DialogAction } from '../core/dialog';

/**
 * The parts of the dialog box that aren't drawing, kept free of Phaser so they can be tested:
 * where the box goes, what its lines say, and which reply is selected.
 */

// The box covers the HUD's message log and controls line, so nothing shows around it.
export const BOX_X = 8;
export const BOX_WIDTH = GAME_WIDTH - 2 * BOX_X;
export const BOX_BOTTOM = GAME_HEIGHT - 8;
export const BOX_PADDING = 18;
export const REPLY_HEIGHT = 24;

export interface DialogBoxLayout {
  top: number;
  height: number;
  speechY: number;
  /** The y of each reply's line, top to bottom. */
  replyY: number[];
}

/**
 * Where everything goes for a person's line `speechHeight` pixels tall (it wraps, so the scene
 * measures it) and `replies` replies: the line at the top, the replies under it, and the box
 * growing upwards from the bottom of the screen. Never shorter than the message log it covers.
 */
export function dialogBoxLayout(speechHeight: number, replies: number): DialogBoxLayout {
  const content = BOX_PADDING + speechHeight + REPLY_HEIGHT / 2 + replies * REPLY_HEIGHT + BOX_PADDING;
  const height = Math.max(HUD_BOTTOM, content);
  const top = BOX_BOTTOM - height;
  const speechY = top + BOX_PADDING;
  const firstReply = speechY + speechHeight + REPLY_HEIGHT / 2;
  return { top, height, speechY, replyY: Array.from({ length: replies }, (_, i) => firstReply + i * REPLY_HEIGHT) };
}

/** What the person says, as a subtitle: `Gus: "Welcome..."`. */
export function speechText(speaker: string, line: string): string {
  return `${speaker}: "${line}"`;
}

/**
 * Which reply is selected in a conversation, and answering it. Moving wraps around the list.
 * Answering moves the conversation on and keeps the answered reply's place selected (or the
 * last reply, if the next line has fewer), so asking questions one after another doesn't send
 * the marker back to the top each time.
 */
export class ReplyMenu {
  private index = 0;

  constructor(private readonly conversation: Conversation) {}

  get selected(): number {
    return this.index;
  }

  /** One line per reply, the selected one marked with '>'. */
  get labels(): string[] {
    return this.conversation.replies.map((reply, i) => `${i === this.index ? '>' : ' '} ${reply.text}`);
  }

  /** Moves the selection up (-1) or down (+1), wrapping around. Returns whether it changed. */
  move(delta: number): boolean {
    const count = this.conversation.replies.length;
    return this.select((((this.index + delta) % count) + count) % count);
  }

  /** Selects a reply, e.g. the one under the mouse. Returns whether the selection changed. */
  select(index: number): boolean {
    if (index === this.index || index < 0 || index >= this.conversation.replies.length) return false;
    this.index = index;
    return true;
  }

  /**
   * Answers with a reply (the selected one by default). Returns what it does, `{ action: null }`
   * if it just leads to another line, or null if there is no such reply (a number key too high).
   */
  answer(index = this.index): { action: DialogAction | null } | null {
    if (index < 0 || index >= this.conversation.replies.length) return null;
    const action = this.conversation.choose(index);
    this.index = Math.min(index, this.conversation.replies.length - 1);
    return { action };
  }
}

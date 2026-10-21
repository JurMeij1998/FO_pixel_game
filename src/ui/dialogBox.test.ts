import { describe, expect, it } from 'vitest';
import { GAME_HEIGHT, HUD_BOTTOM } from '../config';
import { Conversation, type Dialog } from '../core/dialog';
import { getCreatureDef } from '../core/creature';
import { BOX_BOTTOM, dialogBoxLayout, ReplyMenu, speechText } from './dialogBox';

const THREE_REPLIES: Dialog = {
  start: 'ask',
  nodes: {
    ask: {
      text: 'What do you want?',
      replies: [
        { text: 'Tell me about the village.', next: 'village' },
        { text: "Let's barter.", action: 'barter' },
        { text: 'Goodbye.', action: 'leave' },
      ],
    },
    village: { text: 'Not much left of it.', replies: [{ text: 'Goodbye.', action: 'leave' }] },
  },
};

const menuFor = (dialog: Dialog) => new ReplyMenu(new Conversation(dialog));

describe('dialog box layout', () => {
  it('sits at the bottom of the screen and covers the whole message log', () => {
    for (const [speech, replies] of [[22, 1], [22, 2], [48, 3]]) {
      const box = dialogBoxLayout(speech, replies);
      expect(box.top + box.height).toBe(BOX_BOTTOM);
      expect(BOX_BOTTOM).toBeLessThanOrEqual(GAME_HEIGHT);
      expect(box.top).toBeLessThanOrEqual(GAME_HEIGHT - HUD_BOTTOM);
    }
  });

  it('puts the line at the top and the replies under it, one per row, inside the box', () => {
    const box = dialogBoxLayout(48, 3);
    expect(box.speechY).toBeGreaterThan(box.top);
    expect(box.replyY[0]).toBeGreaterThanOrEqual(box.speechY + 48);
    expect(box.replyY).toHaveLength(3);
    expect(box.replyY[1] - box.replyY[0]).toBe(box.replyY[2] - box.replyY[1]);
    expect(box.replyY[2]).toBeLessThan(box.top + box.height);
  });

  it('grows upwards for a longer line or more replies', () => {
    const short = dialogBoxLayout(22, 2);
    expect(dialogBoxLayout(70, 2).top).toBeLessThan(short.top);
    expect(dialogBoxLayout(22, 4).top).toBeLessThan(short.top);
  });
});

describe('dialog box text', () => {
  it("shows the person's line as a subtitle with their name", () => {
    expect(speechText('Gus', 'Anything else?')).toBe('Gus: "Anything else?"');
  });

  it("opens on Gus's greeting, with barter selected", () => {
    const conversation = new Conversation(getCreatureDef('shopkeeper').dialog!);
    expect(conversation.text).toContain('if you break anything, you buy it!');
    expect(new ReplyMenu(conversation).labels).toEqual(["> Let's barter.", '  Goodbye.', '  *Attack*']);
  });

  it("gives the guard's warning with just Leave and *Attack*, Leave selected", () => {
    const conversation = new Conversation(getCreatureDef('guard').dialog!);
    expect(conversation.text).toContain('Gus is under my protection');
    const menu = new ReplyMenu(conversation);
    expect(menu.labels).toEqual(['> Leave.', '  *Attack*']);
    expect(menu.answer()).toEqual({ action: 'leave' });
  });
});

describe('reply selection', () => {
  it("marks the selected reply with '>', the first one to begin with, with *Attack* last", () => {
    expect(menuFor(THREE_REPLIES).labels).toEqual([
      '> Tell me about the village.',
      "  Let's barter.",
      '  Goodbye.',
      '  *Attack*',
    ]);
  });

  it('moves down and up, wrapping around at both ends', () => {
    const menu = menuFor(THREE_REPLIES);
    expect(menu.move(1)).toBe(true);
    expect(menu.selected).toBe(1);
    expect(menu.labels[1]).toBe("> Let's barter.");
    menu.move(1);
    menu.move(1);
    expect(menu.labels[3]).toBe('> *Attack*');
    menu.move(1); // past the last one, back to the first
    expect(menu.selected).toBe(0);
    menu.move(-1); // above the first, to the last
    expect(menu.selected).toBe(3);
  });

  it('selects a reply directly (mouse over), and ignores replies that are not there', () => {
    const menu = menuFor(THREE_REPLIES);
    expect(menu.select(2)).toBe(true);
    expect(menu.select(2)).toBe(false); // already selected: no change, no sound
    expect(menu.select(4)).toBe(false);
    expect(menu.select(-1)).toBe(false);
    expect(menu.selected).toBe(2);
  });

  it('answers with the selected reply and returns what it does', () => {
    const menu = menuFor(THREE_REPLIES);
    menu.move(1);
    expect(menu.answer()).toEqual({ action: 'barter' });
    const leaving = menuFor(THREE_REPLIES);
    leaving.select(2);
    expect(leaving.answer()).toEqual({ action: 'leave' });
    const attacking = menuFor(THREE_REPLIES);
    attacking.select(3);
    expect(attacking.answer()).toEqual({ action: 'attack' });
  });

  it('answers by number too, and ignores a number with no reply', () => {
    const menu = menuFor(THREE_REPLIES);
    expect(menu.answer(5)).toBeNull();
    expect(menu.answer(2)).toEqual({ action: 'leave' });
  });

  it('keeps the answered reply selected on the next line', () => {
    const menu = menuFor(getCreatureDef('rosa').dialog!);
    menu.select(2); // What is a mole rat?
    expect(menu.answer()).toEqual({ action: null });
    expect(menu.selected).toBe(2);
    expect(menu.labels[2]).toBe('> What is a mole rat?');
    // Answering by number (or mouse) selects that reply too.
    expect(menu.answer(3)).toEqual({ action: null }); // What's a radroach?
    expect(menu.labels[3]).toBe("> What's a radroach?");
  });

  it('moves to the last reply when the next line has fewer', () => {
    const menu = menuFor(THREE_REPLIES);
    menu.select(0); // leads to a line with just Goodbye and *Attack*
    expect(menu.answer()).toEqual({ action: null });
    expect(menu.labels).toEqual(['> Goodbye.', '  *Attack*']);
    const deeper = menuFor({
      start: 'a',
      nodes: {
        a: { text: 'A', replies: [{ text: '1', next: 'b' }, { text: '2', next: 'b' }, { text: '3', next: 'b' }] },
        b: { text: 'B', replies: [{ text: 'Bye.', action: 'leave' }] },
      },
    });
    deeper.answer(2); // the third reply; line b has only Bye. and *Attack*
    expect(deeper.selected).toBe(1);
  });

  it("takes Gus from his greeting to 'Anything else?' after bartering", () => {
    const menu = menuFor(getCreatureDef('shopkeeper').dialog!);
    expect(menu.answer()).toEqual({ action: 'barter' });
    expect(menu.labels).toEqual(["> Let's barter.", '  Goodbye.', '  *Attack*']);
    menu.move(1);
    expect(menu.answer()).toEqual({ action: 'leave' });
  });
});

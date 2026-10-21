import { describe, expect, it } from 'vitest';
import { getCreatureDef } from './creature';
import { Conversation, validateDialog, type Dialog } from './dialog';

const SHOP: Dialog = {
  start: 'hello',
  nodes: {
    hello: {
      text: 'Hello.',
      replies: [
        { text: 'Trade.', next: 'more', action: 'barter' },
        { text: 'Bye.', action: 'leave' },
      ],
    },
    more: { text: 'Anything else?', replies: [{ text: 'Bye.', action: 'leave' }] },
  },
};

const texts = (conversation: Conversation) => conversation.replies.map((r) => r.text);

describe('Conversation', () => {
  it('opens at the start node and follows replies, returning their actions', () => {
    const talk = new Conversation(SHOP);
    expect(talk.text).toBe('Hello.');
    expect(talk.choose(0)).toBe('barter');
    expect(talk.text).toBe('Anything else?');
    expect(talk.choose(0)).toBe('leave');
  });

  it('always offers *Attack*, last', () => {
    const talk = new Conversation(SHOP);
    expect(texts(talk)).toEqual(['Trade.', 'Bye.', '*Attack*']);
    expect(talk.choose(2)).toBe('attack');
  });

  it('offers "Leave." first on a line with no replies of its own, so *Attack* is never the default', () => {
    const talk = new Conversation({ start: 'warn', nodes: { warn: { text: 'Move along.', replies: [] } } });
    expect(texts(talk)).toEqual(['Leave.', '*Attack*']);
    expect(talk.choose(0)).toBe('leave');
  });

  it('rejects a reply that is not there', () => {
    expect(() => new Conversation(SHOP).choose(5)).toThrow(RangeError);
  });
});

describe('validateDialog', () => {
  it("accepts well-formed dialogs, including Gus's and the guard's", () => {
    expect(() => validateDialog(SHOP, 'shop')).not.toThrow();
    expect(() => validateDialog(getCreatureDef('shopkeeper').dialog!, 'Gus')).not.toThrow();
    expect(() => validateDialog(getCreatureDef('guard').dialog!, 'Guard')).not.toThrow();
    expect(() => validateDialog(getCreatureDef('rosa').dialog!, 'Rosa')).not.toThrow();
  });

  it('lets you ask Rosa what a mole rat is, then ask her something else', () => {
    const talk = new Conversation(getCreatureDef('rosa').dialog!);
    expect(talk.text).toMatch(/footlocker/);
    const question = texts(talk).indexOf('What is a mole rat?');
    expect(question).toBeGreaterThanOrEqual(0);
    expect(talk.choose(question)).toBeNull();
    expect(talk.text).toMatch(/^Big, bald, pink and mean\./);
    expect(talk.text).not.toMatch(/Anything else/);
    expect(texts(talk)).toContain('Is it dangerous out there?');
    expect(texts(talk).at(-1)).toBe('*Attack*');
  });

  it('rejects unknown nodes and replies that go nowhere', () => {
    expect(() => validateDialog({ ...SHOP, start: 'nope' }, 'x')).toThrow(/unknown node 'nope'/);
    const nowhere = { start: 'a', nodes: { a: { text: '...', replies: [{ text: 'Hm.' }] } } };
    expect(() => validateDialog(nowhere, 'x')).toThrow(/goes nowhere/);
  });
});

import { describe, expect, it } from 'vitest';
import { getCreatureDef } from './creature';
import { Conversation, validateDialog, type Dialog, type DialogCondition, type DialogWorld, type QuestStep } from './dialog';

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

describe('Conversation with conditions and quest steps', () => {
  /** A made-up world where quest stages are set by hand, recording the steps taken. */
  function fakeWorld(stages: Record<string, string>) {
    const taken: QuestStep[] = [];
    const world: DialogWorld = {
      holds: (c: DialogCondition) => (Array.isArray(c.stage) ? c.stage : [c.stage]).includes(stages[c.quest] as never),
      take: (step) => {
        taken.push(step);
        if ('start' in step) stages[step.start] = 'active';
        return ['news'];
      },
    };
    return { world, taken };
  }
  const QUESTY: Dialog = {
    start: 'hello',
    greetings: [{ when: { quest: 'q', stage: ['active', 'ready'] }, node: 'back' }],
    nodes: {
      hello: {
        text: 'Hello.',
        replies: [
          { text: 'Help?', next: 'back', when: { quest: 'q', stage: 'new' }, quest: { start: 'q' } },
          { text: 'Bye.', action: 'leave' },
        ],
      },
      back: { text: 'Back again.', replies: [{ text: 'Done!', when: { quest: 'q', stage: 'ready' }, action: 'leave' }] },
    },
  };

  it('opens with the first greeting whose condition holds, else the start', () => {
    expect(new Conversation(QUESTY, fakeWorld({ q: 'new' }).world).text).toBe('Hello.');
    expect(new Conversation(QUESTY, fakeWorld({ q: 'active' }).world).text).toBe('Back again.');
  });

  it("offers only the replies whose conditions hold; with none left, 'Leave.'", () => {
    expect(texts(new Conversation(QUESTY, fakeWorld({ q: 'new' }).world))).toEqual(['Help?', 'Bye.', '*Attack*']);
    expect(texts(new Conversation(QUESTY, fakeWorld({ q: 'done' }).world))).toEqual(['Bye.', '*Attack*']);
    expect(texts(new Conversation(QUESTY, fakeWorld({ q: 'active' }).world))).toEqual(['Leave.', '*Attack*']);
    expect(texts(new Conversation(QUESTY, fakeWorld({ q: 'ready' }).world))).toEqual(['Done!', '*Attack*']);
  });

  it("takes a reply's quest step before moving on, and keeps what it said until the next reply", () => {
    const { world, taken } = fakeWorld({ q: 'new' });
    const talk = new Conversation(QUESTY, world);
    expect(talk.notice).toEqual([]);
    expect(talk.choose(0)).toBeNull();
    expect(taken).toEqual([{ start: 'q' }]);
    expect(talk.notice).toEqual(['news']);
    expect(talk.text).toBe('Back again.');
    talk.choose(0); // Leave.
    expect(talk.notice).toEqual([]);
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

  it('rejects quests that do not exist, in greetings, conditions and steps', () => {
    const isQuest = (id: string) => id === 'real';
    const reply = (extra: object) => ({ start: 'a', nodes: { a: { text: '...', replies: [{ text: 'Hm.', action: 'leave' as const, ...extra }] } } });
    expect(() => validateDialog(reply({ when: { quest: 'real', stage: 'new' } }), 'x', isQuest)).not.toThrow();
    expect(() => validateDialog(reply({ when: { quest: 'fake', stage: 'new' } }), 'x', isQuest)).toThrow(/unknown quest 'fake'/);
    expect(() => validateDialog(reply({ quest: { finish: 'fake' } }), 'x', isQuest)).toThrow(/unknown quest 'fake'/);
    const greeting = { ...reply({}), greetings: [{ when: { quest: 'fake', stage: 'done' as const }, node: 'a' }] };
    expect(() => validateDialog(greeting, 'x', isQuest)).toThrow(/unknown quest 'fake'/);
  });
});

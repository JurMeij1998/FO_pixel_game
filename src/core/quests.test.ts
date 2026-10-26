import { describe, expect, it } from 'vitest';
import { buildKnownMap, buildMap } from '../data/world';
import { Character } from './character';
import { getCreatureDef, type Creature } from './creature';
import { Conversation, type Dialog } from './dialog';
import { getItem } from './items';
import {
  finishQuest,
  getQuest,
  QUEST_IDS,
  questDialogWorld,
  questEntries,
  QuestLog,
  questStage,
  startQuest,
  type QuestWorld,
} from './quests';
import { loadGame, saveGame } from './save';

const SEED = 777;

function newWorld(): QuestWorld {
  const player = new Character('Quester', {
    strength: 5,
    perception: 5,
    endurance: 5,
    charisma: 5,
    intelligence: 5,
    agility: 5,
    luck: 5,
  });
  return { player, maps: { wasteland: buildMap('wasteland', SEED) }, quests: new QuestLog() };
}

/** The world with the village visited too. */
function withVillage(): QuestWorld {
  const world = newWorld();
  world.maps.village = buildMap('village', SEED);
  return world;
}

function person(world: QuestWorld, map: string, id: string): Creature {
  const found = world.maps[map].creatures.find((c) => c.def.id === id);
  if (!found) throw new Error(`no ${id} on ${map}`);
  return found;
}

function killAll(world: QuestWorld, map: string, creature: string): void {
  for (const c of world.maps[map].creatures) if (c.def.id === creature) c.hitPoints = 0;
}

const talk = (world: QuestWorld, dialog: Dialog) => new Conversation(dialog, questDialogWorld(world));
const replyTexts = (conversation: Conversation) => conversation.replies.map((r) => r.text);
/** Picks the reply with that text, failing the test if it isn't on offer. */
function say(conversation: Conversation, text: string) {
  const index = replyTexts(conversation).indexOf(text);
  expect(replyTexts(conversation)).toContain(text);
  return conversation.choose(index);
}

describe('quest definitions', () => {
  it.each(QUEST_IDS)('%s: its people, creatures and items exist, and the right people start and finish it', (id) => {
    const def = getQuest(id);
    const giver = getCreatureDef(def.giver.creature);
    expect(giver.friendly).toBe(true);
    const finisher = getCreatureDef(def.goal.kind === 'deliver' ? def.goal.to.creature : def.giver.creature);
    if (def.goal.kind === 'kill') getCreatureDef(def.goal.creature);
    else getItem(def.goal.itemId);
    for (const [itemId] of def.reward.items ?? []) getItem(itemId);
    const steps = (dialog: Dialog | undefined) =>
      Object.values(dialog?.nodes ?? {}).flatMap((node) => node.replies.flatMap((r) => (r.quest ? [r.quest] : [])));
    expect(steps(giver.dialog)).toContainEqual({ start: id });
    expect(steps(finisher.dialog)).toContainEqual({ finish: id });
  });

  it('places every giver and finisher on the map the quest says', () => {
    const world = withVillage();
    for (const id of QUEST_IDS) {
      const def = getQuest(id);
      person(world, def.giver.map, def.giver.creature);
      if (def.goal.kind === 'deliver') person(world, def.goal.to.map, def.goal.to.creature);
      if (def.goal.kind === 'kill') {
        expect(world.maps[def.goal.map].creatures.some((c) => c.def.id === (def.goal as { creature: string }).creature)).toBe(true);
      }
    }
  });
});

describe('QuestLog', () => {
  it('takes a quest on once, and finishes it once', () => {
    const log = new QuestLog();
    expect(log.status('pond_pests')).toBeNull();
    expect(log.start('pond_pests')).toBe(true);
    expect(log.start('pond_pests')).toBe(false);
    expect(log.status('pond_pests')).toBe('active');
    expect(log.finish('pond_pests')).toBe(true);
    expect(log.finish('pond_pests')).toBe(false);
    expect(log.start('pond_pests')).toBe(false);
    expect(log.status('pond_pests')).toBe('done');
    expect(log.finish('hides_for_silas')).toBe(false); // never taken on
    expect(() => log.start('no_such_quest')).toThrow();
  });

  it('round-trips through its data, keeping the order quests were taken on', () => {
    const log = new QuestLog();
    log.start('hides_for_silas');
    log.start('pond_pests');
    log.finish('pond_pests');
    const copy = QuestLog.fromData(JSON.parse(JSON.stringify(log.toData())));
    expect(copy.ids).toEqual(['hides_for_silas', 'pond_pests']);
    expect(copy.status('pond_pests')).toBe('done');
    expect(copy.status('hides_for_silas')).toBe('active');
  });

  it('reads a missing or broken log as empty, and skips unknown quests and statuses', () => {
    for (const data of [undefined, null, 5, 'pond_pests', ['pond_pests']]) expect(QuestLog.fromData(data).ids).toEqual([]);
    const log = QuestLog.fromData({ pond_pests: 'done', gone_quest: 'active', hides_for_silas: 'won', medicine_for_mags: 'active' });
    expect(log.ids).toEqual(['pond_pests', 'medicine_for_mags']);
  });
});

describe('quest stages and rewards', () => {
  it('kill: ready once every radroach on the wasteland is dead, then pays once', () => {
    const world = newWorld();
    expect(questStage('pond_pests', world)).toBe('new');
    expect(startQuest('pond_pests', world)).toEqual(['New quest: Pond Pests. Press J for your quests.']);
    expect(startQuest('pond_pests', world)).toEqual([]);
    expect(questStage('pond_pests', world)).toBe('active');
    expect(finishQuest('pond_pests', world)).toEqual([]); // not done yet: nothing paid
    expect(world.player.backpack.count('bottle_caps')).toBe(0);

    const roaches = world.maps.wasteland.creatures.filter((c) => c.def.id === 'radroach');
    expect(roaches.length).toBeGreaterThan(1);
    roaches[0].hitPoints = 0;
    expect(questStage('pond_pests', world)).toBe('active');
    killAll(world, 'wasteland', 'radroach');
    expect(questStage('pond_pests', world)).toBe('ready');

    // (100 XP is a level for a new character, so there's a level-up line after these.)
    expect(finishQuest('pond_pests', world).slice(0, 2)).toEqual(['Quest done: Pond Pests.', 'You got 40 caps, 100 XP.']);
    expect(questStage('pond_pests', world)).toBe('done');
    expect(world.player.backpack.count('bottle_caps')).toBe(40);
    expect(world.player.experience).toBe(100);
    expect(finishQuest('pond_pests', world)).toEqual([]);
    expect(world.player.backpack.count('bottle_caps')).toBe(40);
  });

  it('fetch: ready with enough of the item, which the giver takes; the rest stays yours', () => {
    const world = newWorld();
    startQuest('hides_for_silas', world);
    world.player.backpack.add('leather', 2);
    expect(questStage('hides_for_silas', world)).toBe('active');
    world.player.backpack.add('leather', 2);
    expect(questStage('hides_for_silas', world)).toBe('ready');
    expect(finishQuest('hides_for_silas', world)).toEqual(['Quest done: Hides for Silas.', `You got 30 caps, 10 ${getItem('ammo_223').name}, 75 XP.`]);
    expect(world.player.backpack.count('leather')).toBe(1);
    expect(world.player.backpack.count('ammo_223')).toBe(10);
    expect(world.player.backpack.count('bottle_caps')).toBe(30);
  });

  it('deliver: hands you the item on taking it on, and the one it is for takes it and pays', () => {
    const world = withVillage();
    expect(startQuest('medicine_for_mags', world)).toEqual([
      'New quest: Medicine for Mags. Press J for your quests.',
      'You got the Medicine Pouch.',
    ]);
    expect(world.player.backpack.count('medicine_pouch')).toBe(1);
    expect(questStage('medicine_for_mags', world)).toBe('ready');
    world.player.backpack.remove('medicine_pouch');
    expect(questStage('medicine_for_mags', world)).toBe('active'); // lost it (sold, dropped)
    world.player.backpack.add('medicine_pouch');
    finishQuest('medicine_for_mags', world);
    expect(questStage('medicine_for_mags', world)).toBe('done');
    expect(world.player.backpack.count('medicine_pouch')).toBe(0);
    expect(world.player.backpack.count('stimpak')).toBe(1);
  });

  it('fails when whoever hands it in is dead or has turned hostile, and then pays nothing', () => {
    const world = withVillage();
    startQuest('medicine_for_mags', world);
    startQuest('pond_pests', world);
    killAll(world, 'wasteland', 'radroach');
    // The doctor gave it, but it's Mags who takes it: the doctor's fate doesn't matter.
    person(world, 'village', 'doctor').hitPoints = 0;
    expect(questStage('medicine_for_mags', world)).toBe('ready');

    world.maps.wasteland.provoke(person(world, 'wasteland', 'mags'));
    expect(questStage('medicine_for_mags', world)).toBe('failed');
    expect(questStage('pond_pests', world)).toBe('failed');
    expect(finishQuest('pond_pests', world)).toEqual([]);
    expect(world.player.backpack.count('bottle_caps')).toBe(0);

    person(world, 'wasteland', 'mags').hitPoints = 0;
    expect(questStage('pond_pests', world)).toBe('failed');
  });

  it("doesn't call a delivery failed while the one it's for is on a map not visited yet", () => {
    const world = withVillage();
    delete world.maps.wasteland;
    startQuest('medicine_for_mags', world);
    expect(questStage('medicine_for_mags', world)).toBe('ready');
  });

  it('levels you up when the reward is enough XP', () => {
    const world = newWorld();
    world.player.experience = world.player.experienceForNextLevel - 50;
    startQuest('pond_pests', world);
    killAll(world, 'wasteland', 'radroach');
    const lines = finishQuest('pond_pests', world);
    expect(lines.at(-1)).toBe('Level up! You are now level 2. Press C to spend skill points.');
    expect(world.player.level).toBe(2);
  });

  it('lists open quests first, with what to do next, then finished and failed ones', () => {
    const world = newWorld();
    startQuest('pond_pests', world);
    startQuest('hides_for_silas', world);
    killAll(world, 'wasteland', 'radroach');
    finishQuest('pond_pests', world);
    expect(questEntries(world)).toEqual([
      { id: 'hides_for_silas', title: 'Hides for Silas', stage: 'active', todo: getQuest('hides_for_silas').objective },
      { id: 'pond_pests', title: 'Pond Pests', stage: 'done', todo: '' },
    ]);
    world.player.backpack.add('leather', 3);
    expect(questEntries(world)[0].todo).toBe(getQuest('hides_for_silas').whenReady);
  });
});

describe('quest dialog', () => {
  it("Mags offers her quest, greets you by how it stands, and pays once when it's done", () => {
    const world = newWorld();
    const mags = getCreatureDef('mags').dialog!;
    let conversation = talk(world, mags);
    expect(conversation.text).toMatch(/^Name's Mags/);
    expect(replyTexts(conversation)).not.toContain('The radroaches by the pond are dead.');
    say(conversation, 'I could clear out those roaches for you.');
    expect(say(conversation, 'Deal.')).toBeNull();
    expect(conversation.notice).toEqual(['New quest: Pond Pests. Press J for your quests.']);
    expect(world.quests.status('pond_pests')).toBe('active');
    // The offer is gone once taken.
    expect(replyTexts(conversation)).not.toContain('I could clear out those roaches for you.');

    say(conversation, 'Found anything good lately?');
    expect(conversation.notice).toEqual([]);

    conversation = talk(world, mags);
    expect(conversation.text).toMatch(/still out there/);
    expect(replyTexts(conversation)).not.toContain('The radroaches by the pond are dead.');

    killAll(world, 'wasteland', 'radroach');
    conversation = talk(world, mags);
    expect(conversation.text).toMatch(/racket/);
    say(conversation, 'The radroaches by the pond are dead.');
    expect(conversation.text).toMatch(/40 caps/);
    expect(conversation.notice[0]).toBe('Quest done: Pond Pests.');
    expect(replyTexts(conversation)).not.toContain('The radroaches by the pond are dead.');
    expect(world.player.backpack.count('bottle_caps')).toBe(40);

    conversation = talk(world, mags);
    expect(conversation.text).toMatch(/My water is my own again/);
    expect(replyTexts(conversation)).toEqual(['Found anything good lately?', 'Goodbye.', '*Attack*']);
  });

  it('turning the offer down leaves the quest on offer', () => {
    const world = newWorld();
    const conversation = talk(world, getCreatureDef('silas').dialog!);
    say(conversation, 'Need anything?');
    say(conversation, 'Not now.');
    expect(world.quests.status('hides_for_silas')).toBeNull();
    expect(replyTexts(conversation)).toContain('Need anything?');
  });

  it('the doctor hands over the medicine, Mags takes it, and the doctor knows', () => {
    const world = withVillage();
    const doctor = getCreatureDef('doctor').dialog!;
    let conversation = talk(world, doctor);
    say(conversation, 'Anything I can help with?');
    say(conversation, "I'll take it to her.");
    expect(conversation.notice).toContain('You got the Medicine Pouch.');
    expect(talk(world, doctor).text).toBe('Has Mags had her medicine yet?');

    conversation = talk(world, getCreatureDef('mags').dialog!);
    say(conversation, 'Doc Mendez sent this medicine for you.');
    expect(world.quests.status('medicine_for_mags')).toBe('done');
    expect(talk(world, doctor).text).toMatch(/brought her the medicine/);
  });

  it('the doctor knows when Mags is gone, and offers nothing once it failed', () => {
    const world = withVillage();
    startQuest('medicine_for_mags', world);
    person(world, 'wasteland', 'mags').hitPoints = 0;
    const conversation = talk(world, getCreatureDef('doctor').dialog!);
    expect(conversation.text).toMatch(/won't be needing that medicine/);
    expect(replyTexts(conversation)).toEqual(['Goodbye.', '*Attack*']);
  });

  it('without a world (as in older code paths), quest replies stay hidden', () => {
    const conversation = new Conversation(getCreatureDef('mags').dialog!);
    expect(replyTexts(conversation)).toEqual(['Found anything good lately?', 'Goodbye.', '*Attack*']);
  });
});

describe('quests in a save', () => {
  it('come back from a save as they were', () => {
    const world = newWorld();
    startQuest('pond_pests', world);
    startQuest('hides_for_silas', world);
    killAll(world, 'wasteland', 'radroach');
    finishQuest('pond_pests', world);
    const game = { ...world, worldSeed: SEED, difficulty: 'normal' as const, currentMap: 'wasteland' };
    world.player.pos = { ...world.maps.wasteland.playerStart };
    const loaded = loadGame(JSON.parse(JSON.stringify(saveGame(game))), buildKnownMap, 'wasteland');
    expect(loaded.quests.status('pond_pests')).toBe('done');
    expect(loaded.quests.status('hides_for_silas')).toBe('active');
    // The roaches stay dead, so the finished quest can't be paid again either way.
    expect(questStage('pond_pests', loaded)).toBe('done');
    expect(finishQuest('pond_pests', loaded)).toEqual([]);
  });

  it('a save from before quests loads with none taken on, and the new people in their places', () => {
    const world = newWorld();
    world.player.pos = { ...world.maps.wasteland.playerStart };
    const game = { ...world, worldSeed: SEED, difficulty: 'normal' as const, currentMap: 'wasteland' };
    const old = JSON.parse(JSON.stringify(saveGame(game)));
    delete old.quests;
    // Saved before Mags and Silas moved in: the save doesn't mention them.
    for (const id of Object.keys(old.maps.wasteland.creatures)) {
      if (id.startsWith('mags') || id.startsWith('silas')) delete old.maps.wasteland.creatures[id];
    }
    const loaded = loadGame(old, buildKnownMap, 'wasteland');
    expect(loaded.quests.ids).toEqual([]);
    expect(person(loaded, 'wasteland', 'mags').canTalk).toBe(true);
    expect(person(loaded, 'wasteland', 'silas').canTalk).toBe(true);
  });
});

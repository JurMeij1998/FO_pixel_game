import { describe, expect, it } from 'vitest';
import {
  BASE_STAT,
  checkBuild,
  createCharacter,
  EXTRA_POINTS,
  eraseFromName,
  lowerStat,
  MAX_NAME_LENGTH,
  newBuild,
  pointsLeft,
  raiseStat,
  typeIntoName,
} from './creation';
import { SPECIAL_KEYS } from './stats';

describe('character creation', () => {
  it('starts every stat at 5, with 8 points to spend', () => {
    const build = newBuild();
    for (const key of SPECIAL_KEYS) expect(build.special[key]).toBe(BASE_STAT);
    expect(pointsLeft(build.special)).toBe(EXTRA_POINTS);
    expect(build.difficulty).toBe('normal');
  });

  it('spends points on raising stats, up to 10', () => {
    const build = newBuild();
    for (let i = 0; i < 5; i++) expect(raiseStat(build, 'agility')).toBe(true);
    expect(build.special.agility).toBe(10);
    expect(raiseStat(build, 'agility')).toBe(false); // the maximum
    expect(pointsLeft(build.special)).toBe(3);
  });

  it("can't raise a stat once the points are spent", () => {
    const build = newBuild();
    for (let i = 0; i < 4; i++) raiseStat(build, 'strength');
    for (let i = 0; i < 4; i++) raiseStat(build, 'luck');
    expect(pointsLeft(build.special)).toBe(0);
    expect(raiseStat(build, 'charisma')).toBe(false);
    expect(build.special.charisma).toBe(5);
  });

  it('frees points by lowering a stat below 5, down to 1', () => {
    const build = newBuild();
    for (let i = 0; i < 4; i++) expect(lowerStat(build, 'charisma')).toBe(true);
    expect(lowerStat(build, 'charisma')).toBe(false); // the minimum
    expect(build.special.charisma).toBe(1);
    expect(pointsLeft(build.special)).toBe(EXTRA_POINTS + 4);
  });

  it('types a name, within limits', () => {
    const build = newBuild();
    build.name = '';
    for (const char of 'Max ') typeIntoName(build, char);
    expect(typeIntoName(build, ' ')).toBe(false); // no double spaces
    for (const char of "O'Ryan-2") typeIntoName(build, char);
    expect(build.name).toBe("Max O'Ryan-2");
    expect(typeIntoName(build, '!')).toBe(false);
    while (typeIntoName(build, 'x'));
    expect(build.name.length).toBe(MAX_NAME_LENGTH);
    eraseFromName(build);
    expect(build.name.length).toBe(MAX_NAME_LENGTH - 1);
  });

  it("doesn't start a name with a space", () => {
    const build = newBuild();
    build.name = '';
    expect(typeIntoName(build, ' ')).toBe(false);
  });

  it('is ready to play only with a name and every point spent', () => {
    const build = newBuild();
    expect(checkBuild(build)).toMatchObject({ ok: false, message: 'You still have 8 points to spend.' });
    for (let i = 0; i < 7; i++) raiseStat(build, 'intelligence');
    expect(checkBuild(build).ok).toBe(false); // intelligence stops at 10: 5 spent
    for (let i = 0; i < 3; i++) raiseStat(build, 'endurance');
    expect(checkBuild(build).ok).toBe(true);
    build.name = '   ';
    expect(checkBuild(build)).toMatchObject({ ok: false, message: 'Give your character a name.' });
  });

  it('makes the character it describes', () => {
    const build = newBuild();
    build.name = '  Vera  ';
    build.gender = 'female';
    raiseStat(build, 'endurance');
    const character = createCharacter(build);
    expect(character.name).toBe('Vera');
    expect(character.gender).toBe('female');
    expect(character.special.endurance).toBe(6);
    build.special.endurance = 9; // later changes to the build don't reach the character
    expect(character.special.endurance).toBe(6);
  });
});

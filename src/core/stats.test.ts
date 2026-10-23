import { describe, expect, it } from 'vitest';
import { SKILL_EFFECTS, SKILLS, SPECIAL_EFFECTS, SPECIAL_KEYS } from './stats';

describe('character sheet explanations', () => {
  it('explain every S.P.E.C.I.A.L. stat and every skill', () => {
    for (const key of SPECIAL_KEYS) expect(SPECIAL_EFFECTS[key].length).toBeGreaterThan(10);
    for (const skill of SKILLS) expect(SKILL_EFFECTS[skill].length).toBeGreaterThan(10);
  });

  it('mention every skill a stat feeds into', () => {
    expect(SPECIAL_EFFECTS.perception).toMatch(/Lockpick/);
    expect(SPECIAL_EFFECTS.agility).toMatch(/Lockpick/);
  });
});

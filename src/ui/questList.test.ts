import { describe, expect, it } from 'vitest';
import { isClosed, questRow } from './questList';

describe('quest list rows', () => {
  it('puts the status flush right, the selected row marked with >', () => {
    const row = questRow({ id: 'q', title: 'Pond Pests', stage: 'active', todo: '' }, 30, true);
    expect(row).toHaveLength(30);
    expect(row.startsWith('> Pond Pests')).toBe(true);
    expect(row.endsWith('Active')).toBe(true);
    expect(questRow({ id: 'q', title: 'Pond Pests', stage: 'ready', todo: '' }, 30, false).startsWith('  Pond')).toBe(true);
  });

  it('cuts a title too long for its column, keeping the status', () => {
    const row = questRow({ id: 'q', title: 'A very long quest title indeed', stage: 'failed', todo: '' }, 20, false);
    expect(row).toHaveLength(20);
    expect(row.endsWith(' Failed')).toBe(true);
  });

  it('dims done and failed quests only', () => {
    expect(['active', 'ready', 'done', 'failed'].map((stage) => isClosed({ id: 'q', title: 'Q', stage: stage as 'done', todo: '' }))).toEqual([
      false,
      false,
      true,
      true,
    ]);
  });
});

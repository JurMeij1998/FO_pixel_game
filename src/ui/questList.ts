import type { QuestEntry, QuestStage } from '../core/quests';

/** What the quest list's STATUS column says for each stage ('new' quests aren't listed). */
export const STAGE_LABELS: Record<QuestStage, string> = {
  new: '',
  active: 'Active',
  ready: 'Ready',
  done: 'Done',
  failed: 'Failed',
};

/** One row of the quest list, `columns` characters wide: the title, and its status flush right. */
export function questRow(entry: QuestEntry, columns: number, selected: boolean): string {
  const status = STAGE_LABELS[entry.stage];
  const title = `${selected ? '>' : ' '} ${entry.title}`;
  return `${title.slice(0, columns - status.length - 1).padEnd(columns - status.length)}${status}`;
}

/** Whether a quest is over (done or failed): its row is dimmed. */
export function isClosed(entry: QuestEntry): boolean {
  return entry.stage === 'done' || entry.stage === 'failed';
}

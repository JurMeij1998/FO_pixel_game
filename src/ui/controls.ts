/** Every key binding, for the Controls screen: [keys, while exploring, in combat]. */
export const CONTROL_ROWS: Array<[keys: string, exploring: string, combat: string]> = [
  ['Arrows / WASD', 'Move', 'Move (1 AP per tile)'],
  ['E', 'Interact with what you face', '-'],
  ['Space', 'Interact', 'End your turn'],
  ['Click an enemy', 'Attack it (starts combat)', 'Attack it'],
  ['F', '-', 'Attack the target'],
  ['Tab', '-', 'Next target'],
  ['R', 'Reload', 'Reload (2 AP)'],
  ['Q', 'Swap weapon hands', 'Swap weapon hands'],
  ['I', 'Inventory', 'Inventory (4 AP)'],
  ['C', 'Character sheet', '-'],
  ['Esc', 'Pause menu / close', 'Pause menu'],
  ['M', 'Sound on/off', 'Sound on/off'],
  ['Space (loot)', 'Take all', '-'],
];

import type Phaser from 'phaser';

/** Game-wide event carrying one line for the HUD message log. */
export const MESSAGE_EVENT = 'message';

export function postMessage(scene: Phaser.Scene, text: string): void {
  scene.game.events.emit(MESSAGE_EVENT, text);
}

/**
 * The lines the log shows: the newest messages that fit in `maxLines` once wrapped, whole
 * messages only, so an older long message never shows just its second half. Only a newest
 * message that's longer than the log on its own is cut, keeping its end.
 */
export function logLines(messages: readonly string[], wrap: (text: string) => string[], maxLines: number): string[] {
  let lines: string[] = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const withThis = [...wrap(messages[i]), ...lines];
    if (withThis.length > maxLines) return lines.length > 0 ? lines : withThis.slice(-maxLines);
    lines = withThis;
  }
  return lines;
}

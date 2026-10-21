import { describe, expect, it } from 'vitest';
import { logLines } from './messages';

/** Wraps at 10 characters, by words, like the log does at its width. */
function wrap(text: string): string[] {
  const lines: string[] = [];
  for (const word of text.split(' ')) {
    const last = lines[lines.length - 1];
    if (last !== undefined && `${last} ${word}`.length <= 10) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return lines;
}

describe('log lines', () => {
  it('shows the newest messages that fit, one line each', () => {
    expect(logLines(['one', 'two', 'three', 'four'], wrap, 3)).toEqual(['two', 'three', 'four']);
  });

  it('drops an older long message whole, rather than showing only its second half', () => {
    // 'a long message' wraps onto two lines; with two short ones after it, only those fit.
    expect(logLines(['a long message', 'two', 'three'], wrap, 3)).toEqual(['two', 'three']);
  });

  it('keeps a long message while it still fits', () => {
    expect(logLines(['a long message', 'two'], wrap, 3)).toEqual(['a long', 'message', 'two']);
  });

  it('cuts only a newest message too long for the log on its own, keeping its end', () => {
    const long = 'one two three four five six seven eight';
    expect(logLines(['old', long], wrap, 3)).toEqual(wrap(long).slice(-3));
  });
});

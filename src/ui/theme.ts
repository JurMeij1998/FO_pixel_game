import type Phaser from 'phaser';

type TextStyle = Phaser.Types.GameObjects.Text.TextStyle;

/** Green-on-black terminal look, in the spirit of the Pip-Boy. */
export const COLORS = {
  text: '#3cd070',
  bright: '#b4ffbe',
  dim: '#1f7a3e',
  warn: '#ff6a4d',
  panel: 0x0a140c,
  border: 0x3cd070,
};

const FONT = '"Courier New", Courier, monospace';

export const TEXT: TextStyle = { fontFamily: FONT, fontSize: '18px', color: COLORS.text };
export const DIM_TEXT: TextStyle = { ...TEXT, color: COLORS.dim };
export const SMALL_TEXT: TextStyle = { ...TEXT, fontSize: '14px', color: COLORS.dim };
export const HEADER_TEXT: TextStyle = { ...TEXT, color: COLORS.bright, fontStyle: 'bold' };
export const TITLE_TEXT: TextStyle = { ...TEXT, fontSize: '24px', color: COLORS.bright, fontStyle: 'bold' };

/** Approximate width of one character of TEXT; Courier is 0.6em wide. */
export const CHAR_WIDTH = 10.8;
export const ROW_HEIGHT = 24;

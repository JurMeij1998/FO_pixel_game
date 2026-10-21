/** Logical screen size; Phaser scales this to fit the window. */
export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 640;

/** Size of one map tile in texture pixels. */
export const TILE_SIZE = 16;

/** The world is drawn at this integer zoom so the pixel art stays crisp. */
export const WORLD_ZOOM = 3;

/**
 * Screen pixels the HUD covers at the bottom: the message log, across the left half. The rest
 * of the HUD (the health bar, the combat label) sits straight on the map.
 */
export const HUD_BOTTOM = 72;
/**
 * Where the floating "COMBAT - YOUR TURN" label goes, in screen pixels (top left corner, and
 * room for the longest text). The AP gauge keeps clear of it.
 */
export const COMBAT_LABEL = { x: 12, y: 10, width: 220, height: 24 };

import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { loadSavedGame, savedGameSummary } from '../state';
import { COLORS, DIM_TEXT, SMALL_TEXT, TITLE_TEXT } from '../ui/theme';
import { MenuList } from '../ui/widgets';
import { playTestArena, playTestShop, showCharacterCreation, showControls, startPlaying } from './flow';

/** The title screen: continue the saved game, start a new one, or look up the controls. */
export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create(): void {
    const centerX = GAME_WIDTH / 2;
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLORS.panel).setOrigin(0);
    this.add
      // Padding leaves room for the glow, which would otherwise be clipped at the text's edges.
      .text(centerX, 150, 'WASTELAND', { ...TITLE_TEXT, fontSize: '72px', padding: { x: 24, y: 24 } })
      .setOrigin(0.5)
      .setShadow(0, 0, COLORS.text, 16, false, true);
    this.add.text(centerX, 215, 'a post-nuclear pixel RPG', DIM_TEXT).setOrigin(0.5);

    const summary = savedGameSummary();
    let confirmingNewGame = false;
    const menu = new MenuList(this, centerX, 300, [
      {
        label: summary ? `Continue (${summary})` : 'Continue',
        disabled: !summary,
        onSelect: () => {
          if (loadSavedGame()) startPlaying(this);
        },
      },
      {
        label: 'New game',
        onSelect: () => {
          // Ask once before overwriting an existing save.
          if (summary && !confirmingNewGame) {
            confirmingNewGame = true;
            menu.setLabel(1, 'Overwrite your save? Choose again');
            return;
          }
          showCharacterCreation(this);
        },
      },
      { label: 'Controls', onSelect: () => showControls(this) },
      // Development builds only (npm run dev): quick ways into a fight, or a shop, to try out UI.
      ...(import.meta.env.DEV
        ? [
            { label: 'Test arena (dev)', onSelect: () => playTestArena(this) },
            { label: 'Test shop (dev)', onSelect: () => playTestShop(this) },
          ]
        : []),
    ]);

    this.add
      .text(centerX, GAME_HEIGHT - 40, 'Up/Down to choose, Enter to select, M for sound on/off. The game saves automatically.', SMALL_TEXT)
      .setOrigin(0.5);
  }
}

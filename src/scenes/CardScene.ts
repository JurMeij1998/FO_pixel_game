import Phaser from 'phaser';
import { CombatCard } from '../ui/combatCard';

/** The combat card is drawn at this zoom: crisp pixel art, but smaller than the 3x world. */
export const CARD_ZOOM = 2;

/**
 * An overlay that only holds the combat card, drawn above the world but below the HUD. Its
 * camera has its origin at the top-left, so card pixel (x, y) lands on screen at (2x, 2y).
 * The world scene feeds the card each frame, converting world positions into card pixels.
 */
export class CardScene extends Phaser.Scene {
  card: CombatCard | null = null;

  constructor() {
    super('Card');
  }

  create(): void {
    this.cameras.main.setOrigin(0, 0).setZoom(CARD_ZOOM);
    this.card = new CombatCard(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => (this.card = null));
  }
}

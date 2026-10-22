import Phaser from 'phaser';
import { playSound } from '../audio/sfx';
import { SKILL_NAMES, SKILLS, type Skill, type Special } from '../core/stats';
import { state } from '../state';
import { ListCursor } from '../ui/listCursor';
import { COLORS, DIM_TEXT, HEADER_TEXT, TEXT } from '../ui/theme';
import { addButton, bindCursorKeys, closeOverlay, drawPanel, PANEL } from '../ui/widgets';

const SPECIAL_NAMES: Array<[keyof Special, string]> = [
  ['strength', 'Strength'],
  ['perception', 'Perception'],
  ['endurance', 'Endurance'],
  ['charisma', 'Charisma'],
  ['intelligence', 'Intelligence'],
  ['agility', 'Agility'],
  ['luck', 'Luck'],
];

const LEFT = PANEL.x + 30;
const RIGHT = PANEL.x + 470;

/**
 * Fallout-style character sheet: S.P.E.C.I.A.L., derived stats, and skills to spend points on.
 * W/S choose a skill and E spends a point on it (or click its + button).
 */
export class CharacterScene extends Phaser.Scene {
  private summary!: Phaser.GameObjects.Text;
  private derived!: Phaser.GameObjects.Text;
  private skillTexts: Phaser.GameObjects.Text[] = [];
  private plusButtons: Phaser.GameObjects.Text[] = [];
  private pointsText!: Phaser.GameObjects.Text;
  private feedback!: Phaser.GameObjects.Text;
  /** The keyboard cursor on the skills list. */
  private cursor!: ListCursor;

  constructor() {
    super('Character');
  }

  create(): void {
    const player = state.player;
    drawPanel(this, 'CHARACTER');
    addButton(this, PANEL.x + PANEL.width - 130, PANEL.y + 18, 'Close', () => closeOverlay(this));

    this.summary = this.add.text(LEFT, 90, '', TEXT);

    this.add.text(LEFT, 170, 'S.P.E.C.I.A.L.', HEADER_TEXT);
    this.add.text(
      LEFT,
      200,
      SPECIAL_NAMES.map(([key, name]) => `${name.padEnd(14)}${String(player.special[key]).padStart(2)}`).join('\n'),
      TEXT,
    );

    this.add.text(RIGHT, 90, 'DERIVED', HEADER_TEXT);
    this.derived = this.add.text(RIGHT, 120, '', TEXT);

    this.add.text(RIGHT, 300, 'SKILLS', HEADER_TEXT);
    this.skillTexts = [];
    this.plusButtons = [];
    this.cursor = new ListCursor([[...SKILLS]]);
    SKILLS.forEach((skill, i) => {
      const y = 332 + i * 30;
      const text = this.add.text(RIGHT, y, '', TEXT).setInteractive({ useHandCursor: true });
      text.on('pointerdown', () => {
        this.cursor.focus(0, skill);
        this.refresh();
      });
      this.skillTexts.push(text);
      this.plusButtons.push(addButton(this, RIGHT + 300, y, '+', () => this.improve(skill)));
    });
    this.pointsText = this.add.text(RIGHT, 432, '', TEXT);
    this.add.text(RIGHT, 460, '* tagged: +20%, and each point adds 2%', DIM_TEXT);
    this.feedback = this.add.text(LEFT, PANEL.y + PANEL.height - 36, '', TEXT);

    bindCursorKeys(this, this.cursor, () => this.refresh());
    const keyboard = this.input.keyboard!;
    keyboard.on('keydown-E', (event: KeyboardEvent) => {
      const skill = this.cursor.selectedKey as Skill | null;
      if (!event.repeat && skill) this.improve(skill);
    });
    keyboard.on('keydown-C', () => closeOverlay(this));
    keyboard.on('keydown-ESC', () => closeOverlay(this));

    this.refresh();
  }

  /** Spends a skill point on a skill (selecting it, if it was its + button that was clicked). */
  private improve(skill: Skill): void {
    this.cursor.focus(0, skill);
    const result = state.player.improveSkill(skill);
    if (result.ok) playSound('menuSelect');
    this.feedback.setText(result.message).setColor(result.ok ? COLORS.text : COLORS.warn);
    this.refresh();
  }

  private refresh(): void {
    const p = state.player;
    this.summary.setText(
      [`${p.name}`, `Level ${p.level}`, `XP ${p.experience} / ${p.experienceForNextLevel}`].join('\n'),
    );
    this.derived.setText(
      [
        `Hit Points    ${p.hitPoints}/${p.maxHitPoints}`,
        `Armor Class   ${p.armorClass}`,
        `Action Points ${p.maxActionPoints}`,
        `Carry Weight  ${p.carryCapacity} lb`,
        `Damage Resist ${p.damageResist}%`,
        `Critical      ${p.critChance}%`,
      ].join('\n'),
    );
    SKILLS.forEach((skill, i) => {
      const tag = p.taggedSkills.has(skill) ? '*' : ' ';
      const selected = this.cursor.selectedKey === skill;
      this.skillTexts[i]
        .setText(`${selected ? '>' : ' '}${tag} ${SKILL_NAMES[skill].padEnd(16)}${String(p.skill(skill)).padStart(3)}%`)
        .setColor(selected ? COLORS.bright : COLORS.text);
      this.plusButtons[i].setVisible(p.skillPoints > 0);
    });
    this.pointsText
      .setText(`Skill points: ${p.skillPoints}`)
      .setColor(p.skillPoints > 0 ? COLORS.bright : COLORS.dim);
  }
}

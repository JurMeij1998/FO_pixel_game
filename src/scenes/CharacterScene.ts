import Phaser from 'phaser';
import { SKILL_NAMES, SKILLS, type Special } from '../core/stats';
import { state } from '../state';
import { COLORS, DIM_TEXT, HEADER_TEXT, TEXT } from '../ui/theme';
import { addButton, closeOverlay, drawPanel, PANEL } from '../ui/widgets';

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

/** Fallout-style character sheet: S.P.E.C.I.A.L., derived stats, and skills to spend points on. */
export class CharacterScene extends Phaser.Scene {
  private summary!: Phaser.GameObjects.Text;
  private derived!: Phaser.GameObjects.Text;
  private skillTexts: Phaser.GameObjects.Text[] = [];
  private plusButtons: Phaser.GameObjects.Text[] = [];
  private pointsText!: Phaser.GameObjects.Text;
  private feedback!: Phaser.GameObjects.Text;

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
    SKILLS.forEach((skill, i) => {
      const y = 332 + i * 30;
      this.skillTexts.push(this.add.text(RIGHT, y, '', TEXT));
      this.plusButtons.push(
        addButton(this, RIGHT + 300, y, '+', () => {
          const result = player.improveSkill(skill);
          this.feedback.setText(result.message).setColor(result.ok ? COLORS.text : COLORS.warn);
          this.refresh();
        }),
      );
    });
    this.pointsText = this.add.text(RIGHT, 432, '', TEXT);
    this.add.text(RIGHT, 460, '* tagged: +20%, and each point adds 2%', DIM_TEXT);
    this.feedback = this.add.text(LEFT, PANEL.y + PANEL.height - 36, '', TEXT);

    const keyboard = this.input.keyboard!;
    keyboard.on('keydown-C', () => closeOverlay(this));
    keyboard.on('keydown-ESC', () => closeOverlay(this));

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
      this.skillTexts[i].setText(`${tag} ${SKILL_NAMES[skill].padEnd(16)}${String(p.skill(skill)).padStart(3)}%`);
      this.plusButtons[i].setVisible(p.skillPoints > 0);
    });
    this.pointsText
      .setText(`Skill points: ${p.skillPoints}`)
      .setColor(p.skillPoints > 0 ? COLORS.bright : COLORS.dim);
  }
}

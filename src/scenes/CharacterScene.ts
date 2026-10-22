import Phaser from 'phaser';
import { playSound } from '../audio/sfx';
import { SKILL_EFFECTS, SKILL_NAMES, SKILLS, SPECIAL_EFFECTS, type Skill, type Special } from '../core/stats';
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

/** The two lists the cursor walks: S.P.E.C.I.A.L. on the left, the skills on the right. */
const SPECIAL_COLUMN = 0;
const SKILL_COLUMN = 1;

/**
 * Fallout-style character sheet: S.P.E.C.I.A.L., derived stats, and skills to spend points on.
 * W/S move through a list and A/D between S.P.E.C.I.A.L. and the skills; what the selected one
 * does shows in the bottom left. E spends a point on the selected skill (or click its +).
 */
export class CharacterScene extends Phaser.Scene {
  private summary!: Phaser.GameObjects.Text;
  private derived!: Phaser.GameObjects.Text;
  private specialTexts: Phaser.GameObjects.Text[] = [];
  private skillTexts: Phaser.GameObjects.Text[] = [];
  /** What the selected stat or skill does, in the bottom left. */
  private explanation!: Phaser.GameObjects.Text;
  private explanationTitle!: Phaser.GameObjects.Text;
  private plusButtons: Phaser.GameObjects.Text[] = [];
  private pointsText!: Phaser.GameObjects.Text;
  private feedback!: Phaser.GameObjects.Text;
  /** The keyboard cursor, on S.P.E.C.I.A.L. or the skills. */
  private cursor!: ListCursor;

  constructor() {
    super('Character');
  }

  create(): void {
    const player = state.player;
    drawPanel(this, 'CHARACTER');
    addButton(this, PANEL.x + PANEL.width - 130, PANEL.y + 18, 'Close', () => closeOverlay(this));

    this.summary = this.add.text(LEFT, 90, '', TEXT);

    // Open on the skills when there are points to spend, else on S.P.E.C.I.A.L.
    this.cursor = new ListCursor(
      [SPECIAL_NAMES.map(([key]) => key), [...SKILLS]],
      player.skillPoints > 0 ? SKILL_COLUMN : SPECIAL_COLUMN,
    );

    this.add.text(LEFT, 170, 'S.P.E.C.I.A.L.', HEADER_TEXT);
    this.specialTexts = SPECIAL_NAMES.map(([key], i) => {
      const text = this.add.text(LEFT, 200 + i * 24, '', TEXT).setInteractive({ useHandCursor: true });
      text.on('pointerdown', () => {
        this.cursor.focus(SPECIAL_COLUMN, key);
        this.refresh();
      });
      return text;
    });
    this.explanationTitle = this.add.text(LEFT, 390, '', HEADER_TEXT);
    this.explanation = this.add.text(LEFT, 418, '', { ...TEXT, wordWrap: { width: RIGHT - LEFT - 40 } });

    this.add.text(RIGHT, 90, 'DERIVED', HEADER_TEXT);
    this.derived = this.add.text(RIGHT, 120, '', TEXT);

    this.add.text(RIGHT, 300, 'SKILLS', HEADER_TEXT);
    this.skillTexts = [];
    this.plusButtons = [];
    SKILLS.forEach((skill, i) => {
      const y = 332 + i * 30;
      const text = this.add.text(RIGHT, y, '', TEXT).setInteractive({ useHandCursor: true });
      text.on('pointerdown', () => {
        this.cursor.focus(SKILL_COLUMN, skill);
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
      const key = this.cursor.selectedKey;
      if (event.repeat || !key) return;
      if (this.cursor.activeColumn === SKILL_COLUMN) this.improve(key as Skill);
      else this.feedback.setText("S.P.E.C.I.A.L. doesn't change; spend skill points on skills.").setColor(COLORS.warn);
    });
    keyboard.on('keydown-C', (event: KeyboardEvent) => !event.repeat && closeOverlay(this));
    keyboard.on('keydown-ESC', () => closeOverlay(this));

    this.refresh();
  }

  /** Spends a skill point on a skill (selecting it, if it was its + button that was clicked). */
  private improve(skill: Skill): void {
    this.cursor.focus(SKILL_COLUMN, skill);
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
    const selected = (column: number, key: string) =>
      this.cursor.activeColumn === column && this.cursor.selectedKey === key;
    SPECIAL_NAMES.forEach(([key, name], i) => {
      const isSelected = selected(SPECIAL_COLUMN, key);
      this.specialTexts[i]
        .setText(`${isSelected ? '>' : ' '} ${name.padEnd(14)}${String(p.special[key]).padStart(2)}`)
        .setColor(isSelected ? COLORS.bright : COLORS.text);
    });
    const key = this.cursor.selectedKey;
    if (this.cursor.activeColumn === SPECIAL_COLUMN && key) {
      this.explanationTitle.setText(SPECIAL_NAMES.find(([k]) => k === key)![1].toUpperCase());
      this.explanation.setText(SPECIAL_EFFECTS[key as keyof Special]);
    } else if (key) {
      this.explanationTitle.setText(SKILL_NAMES[key as Skill].toUpperCase());
      this.explanation.setText(SKILL_EFFECTS[key as Skill]);
    }
    SKILLS.forEach((skill, i) => {
      const tag = p.taggedSkills.has(skill) ? '*' : ' ';
      const isSelected = selected(SKILL_COLUMN, skill);
      this.skillTexts[i]
        .setText(`${isSelected ? '>' : ' '}${tag} ${SKILL_NAMES[skill].padEnd(16)}${String(p.skill(skill)).padStart(3)}%`)
        .setColor(isSelected ? COLORS.bright : COLORS.text);
      this.plusButtons[i].setVisible(p.skillPoints > 0);
    });
    this.pointsText
      .setText(`Skill points: ${p.skillPoints}`)
      .setColor(p.skillPoints > 0 ? COLORS.bright : COLORS.dim);
  }
}

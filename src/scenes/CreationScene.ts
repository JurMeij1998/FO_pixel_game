import Phaser from 'phaser';
import { playSound } from '../audio/sfx';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import {
  checkBuild,
  eraseFromName,
  lowerStat,
  newBuild,
  pointsLeft,
  raiseStat,
  typeIntoName,
  type CharacterBuild,
} from '../core/creation';
import { DIFFICULTIES, DIFFICULTY_LEVELS } from '../core/difficulty';
import { carryCapacity, maxActionPoints, maxHitPoints, skillPointsPerLevel, SPECIAL_EFFECTS, SPECIAL_KEYS, type Special } from '../core/stats';
import { startNewGame } from '../state';
import { ListCursor } from '../ui/listCursor';
import { RepeatGuard } from '../ui/repeatGuard';
import { COLORS, HEADER_TEXT, TEXT, TITLE_TEXT } from '../ui/theme';
import { addButton } from '../ui/widgets';
import { startPlaying } from './flow';

const SPECIAL_NAMES: Record<keyof Special, string> = {
  strength: 'Strength',
  perception: 'Perception',
  endurance: 'Endurance',
  charisma: 'Charisma',
  intelligence: 'Intelligence',
  agility: 'Agility',
  luck: 'Luck',
};

/** The rows the cursor walks, top to bottom. */
const ROWS = ['name', 'gender', ...SPECIAL_KEYS, 'difficulty', 'start'] as const;
type Row = (typeof ROWS)[number];
const isStat = (row: Row): row is keyof Special => (SPECIAL_KEYS as readonly string[]).includes(row);

const LEFT = 60;
/** Where a row's value goes: the name right away, the others between a [<] and a [>] button. */
const VALUE_X = 260;
const VALUE_WIDTH = 150;
const RIGHT = 520;
const NAME_Y = 110;
const GENDER_Y = 145;
const SPECIAL_TOP = 215;
const ROW_HEIGHT = 28;
const DIFFICULTY_Y = SPECIAL_TOP + SPECIAL_KEYS.length * ROW_HEIGHT + 24;
const START_Y = DIFFICULTY_Y + 50;

/**
 * Character creation, between choosing "New game" and the game itself: a name (typed), a
 * gender (how you look), the S.P.E.C.I.A.L. stats (5 each, with 8 more points; lowering one
 * frees its points) and the difficulty. Up/Down (or W/S) choose a row, Left/Right (or A/D)
 * change it; on the name row you just type, so W/S/A/D are letters there and the arrow keys
 * move on. Enter moves on, and on Start begins the game; Esc goes back to the menu. The rules
 * are in core/creation.ts.
 */
export class CreationScene extends Phaser.Scene {
  private build!: CharacterBuild;
  private cursor!: ListCursor;
  private readonly rowTexts = new Map<Row, Phaser.GameObjects.Text>();
  private readonly valueTexts = new Map<Row, Phaser.GameObjects.Text>();
  private pointsText!: Phaser.GameObjects.Text;
  private explanationTitle!: Phaser.GameObjects.Text;
  private explanation!: Phaser.GameObjects.Text;
  private derived!: Phaser.GameObjects.Text;
  private portrait!: Phaser.GameObjects.Image;
  private feedback!: Phaser.GameObjects.Text;

  constructor() {
    super('Creation');
  }

  create(): void {
    // A scene object is reused each time it's started, so start from a fresh build every time.
    this.build = newBuild();
    this.cursor = new ListCursor([[...ROWS]]);
    this.rowTexts.clear();
    this.valueTexts.clear();

    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLORS.panel).setOrigin(0);
    this.add.rectangle(30, 30, GAME_WIDTH - 60, GAME_HEIGHT - 60).setOrigin(0).setStrokeStyle(2, COLORS.border);
    this.add.text(LEFT, 50, 'CREATE YOUR CHARACTER', TITLE_TEXT);

    this.addRow('name', NAME_Y);
    this.addRow('gender', GENDER_Y);
    this.addArrows(GENDER_Y, () => this.toggleGender(), () => this.toggleGender());

    this.add.text(LEFT, SPECIAL_TOP - 32, 'S.P.E.C.I.A.L.', HEADER_TEXT);
    this.pointsText = this.add.text(VALUE_X, SPECIAL_TOP - 32, '', HEADER_TEXT);
    SPECIAL_KEYS.forEach((key, i) => {
      const y = SPECIAL_TOP + i * ROW_HEIGHT;
      this.addRow(key, y);
      this.addArrows(y, () => this.change(key, -1), () => this.change(key, 1), '-', '+');
    });

    this.addRow('difficulty', DIFFICULTY_Y);
    this.addArrows(DIFFICULTY_Y, () => this.cycleDifficulty(-1), () => this.cycleDifficulty(1));
    this.addRow('start', START_Y);

    this.portrait = this.add.image(GAME_WIDTH - 130, 115, 'player_down').setScale(4);
    this.explanationTitle = this.add.text(RIGHT, 190, '', HEADER_TEXT);
    this.explanation = this.add.text(RIGHT, 218, '', { ...TEXT, wordWrap: { width: GAME_WIDTH - RIGHT - 60 } });
    this.add.text(RIGHT, 380, 'WHAT THIS MAKES YOU', HEADER_TEXT);
    this.derived = this.add.text(RIGHT, 408, '', TEXT);
    this.feedback = this.add.text(LEFT, GAME_HEIGHT - 70, '', TEXT);

    const guard = new RepeatGuard(); // a key held from the menu doesn't act here
    this.input.keyboard!.on('keydown', (event: KeyboardEvent) => {
      if (guard.allow(event.key, event.repeat)) this.onKey(event);
    });

    this.refresh();
  }

  private get row(): Row {
    return this.cursor.selectedKey as Row;
  }

  private onKey(event: KeyboardEvent): void {
    const onName = this.row === 'name';
    const key = event.key;
    const letter = key.length === 1 ? key.toLowerCase() : '';
    if (key === 'Escape') {
      this.scene.start('Menu');
    } else if (key === 'Enter') {
      if (event.repeat) return;
      if (this.row === 'start') this.start();
      else this.move(1);
    } else if (key === 'ArrowUp' || (!onName && letter === 'w')) {
      this.move(-1);
    } else if (key === 'ArrowDown' || (!onName && letter === 's')) {
      this.move(1);
    } else if (key === 'ArrowLeft' || (!onName && letter === 'a')) {
      this.adjust(-1);
    } else if (key === 'ArrowRight' || (!onName && letter === 'd')) {
      this.adjust(1);
    } else if (onName && key === 'Backspace') {
      if (eraseFromName(this.build)) this.refresh();
    } else if (onName && key.length === 1) {
      if (typeIntoName(this.build, key)) this.refresh();
    }
  }

  private move(delta: number): void {
    if (!this.cursor.moveRow(delta)) return;
    playSound('menuMove');
    this.feedback.setText('');
    this.refresh();
  }

  /** Left/Right on the selected row: change the gender, a stat, or the difficulty. */
  private adjust(delta: number): void {
    const row = this.row;
    if (row === 'gender') this.toggleGender();
    else if (row === 'difficulty') this.cycleDifficulty(delta);
    else if (isStat(row)) this.change(row, delta);
  }

  private change(key: keyof Special, delta: number): void {
    this.cursor.focus(0, key);
    const changed = delta > 0 ? raiseStat(this.build, key) : lowerStat(this.build, key);
    if (changed) {
      playSound('menuMove');
      this.feedback.setText('');
    } else {
      const why = delta > 0 && pointsLeft(this.build.special) <= 0 ? 'No points left: lower another stat first.' : null;
      this.feedback.setText(why ?? '').setColor(COLORS.warn);
    }
    this.refresh();
  }

  private toggleGender(): void {
    this.cursor.focus(0, 'gender');
    this.build.gender = this.build.gender === 'male' ? 'female' : 'male';
    playSound('menuMove');
    this.refresh();
  }

  private cycleDifficulty(delta: number): void {
    this.cursor.focus(0, 'difficulty');
    const index = DIFFICULTY_LEVELS.indexOf(this.build.difficulty);
    const next = index + delta;
    if (next < 0 || next >= DIFFICULTY_LEVELS.length) return;
    this.build.difficulty = DIFFICULTY_LEVELS[next];
    playSound('menuMove');
    this.refresh();
  }

  private start(): void {
    this.cursor.focus(0, 'start');
    const ready = checkBuild(this.build);
    if (!ready.ok) {
      this.feedback.setText(ready.message).setColor(COLORS.warn);
      this.refresh();
      return;
    }
    playSound('menuSelect');
    startNewGame(this.build);
    startPlaying(this);
  }

  /**
   * A row: its title (which selects the row when clicked, and starts the game for Start) and,
   * except for Start, its value.
   */
  private addRow(row: Row, y: number): void {
    if (row === 'name') this.valueTexts.set(row, this.add.text(VALUE_X, y, '', TEXT));
    else if (row !== 'start') this.valueTexts.set(row, this.add.text(VALUE_X + VALUE_WIDTH / 2 + 27, y, '', TEXT).setOrigin(0.5, 0));
    const text = this.add.text(LEFT, y, '', TEXT).setInteractive({ useHandCursor: true });
    text.on('pointerdown', () => {
      if (row === 'start') this.start();
      else {
        this.cursor.focus(0, row);
        this.refresh();
      }
    });
    this.rowTexts.set(row, text);
  }

  /** Clickable buttons either side of a row's value. */
  private addArrows(y: number, onLeft: () => void, onRight: () => void, left = '<', right = '>'): void {
    addButton(this, VALUE_X, y, left, onLeft);
    addButton(this, VALUE_X + VALUE_WIDTH, y, right, onRight);
  }

  private refresh(): void {
    const build = this.build;
    const label = (row: Row, title: string, value = '') => {
      const selected = this.row === row;
      const color = selected ? COLORS.bright : COLORS.text;
      this.rowTexts.get(row)!.setText(`${selected ? '>' : ' '} ${title}`).setColor(color);
      this.valueTexts.get(row)?.setText(value).setColor(color);
    };
    const typing = this.row === 'name' ? '_' : '';
    label('name', 'Name', `${build.name}${typing}`);
    label('gender', 'Gender', build.gender === 'male' ? 'Male' : 'Female');
    for (const key of SPECIAL_KEYS) label(key, SPECIAL_NAMES[key], String(build.special[key]));
    label('difficulty', 'Difficulty', DIFFICULTIES[build.difficulty].name);
    label('start', '[ Start the game ]');

    const left = pointsLeft(build.special);
    this.pointsText.setText(`Points left: ${left}`).setColor(left > 0 ? COLORS.bright : COLORS.dim);

    this.portrait.setTexture(build.gender === 'female' ? 'player_female_down' : 'player_down');
    const [title, text] = this.explain(this.row);
    this.explanationTitle.setText(title);
    this.explanation.setText(text);

    const s = build.special;
    this.derived.setText(
      [
        `Hit Points    ${maxHitPoints(s)}`,
        `Action Points ${maxActionPoints(s)}`,
        `Carry Weight  ${carryCapacity(s)} lb`,
        `Armor Class   ${s.agility}`,
        `Critical      ${s.luck}%`,
        `Skill points  ${skillPointsPerLevel(s)} per level`,
      ].join('\n'),
    );
  }

  private explain(row: Row): [string, string] {
    if (isStat(row)) return [SPECIAL_NAMES[row].toUpperCase(), SPECIAL_EFFECTS[row]];
    switch (row) {
      case 'name':
        return ['NAME', 'Type a name for your character. Backspace erases.'];
      case 'gender':
        return ['GENDER', 'How your character looks in the wasteland.'];
      case 'difficulty':
        return [`DIFFICULTY: ${DIFFICULTIES[this.build.difficulty].name.toUpperCase()}`, DIFFICULTIES[this.build.difficulty].description];
      case 'start':
        return ['READY?', 'Every stat starts at 5, with 8 more points to spend. Lower a stat to free its points.'];
    }
  }
}


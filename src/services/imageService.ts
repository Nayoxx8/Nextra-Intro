import { createCanvas, loadImage, GlobalFonts, type Canvas } from "@napi-rs/canvas";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import type { GuildBasicSettingRecord, GuildQuestionRecord } from "../types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = join(__dirname, "../assets/fonts");

let fontsRegistered = false;

function ensureFonts(): void {
  if (fontsRegistered) return;
  GlobalFonts.registerFromPath(join(FONTS_DIR, "NotoSansJP-Regular.otf"), "NotoSansJP");
  GlobalFonts.registerFromPath(join(FONTS_DIR, "NotoSansJP-Bold.otf"), "NotoSansJP");
  GlobalFonts.registerFromPath(join(FONTS_DIR, "NotoEmoji-Regular.ttf"), "NotoEmoji");
  fontsRegistered = true;
}

const CARD_WIDTH = 800;
const CARD_HEIGHT = 450;
const PADDING = 40;
const AVATAR_RADIUS = 48;
const HEADER_TOP = 32;
const AVATAR_CX = PADDING + AVATAR_RADIUS;        // 88
const AVATAR_CY = HEADER_TOP + AVATAR_RADIUS;     // 80
const RIGHT_X = PADDING + AVATAR_RADIUS * 2 + 20; // 156
const RIGHT_MAX_W = CARD_WIDTH - PADDING - RIGHT_X; // 604
const USERNAME_Y = HEADER_TOP + 26;               // 58
const BASIC_LABEL_Y = USERNAME_Y + 26;            // 84
const BASIC_VALUE_Y = BASIC_LABEL_Y + 28;         // 112
const AVATAR_BOTTOM = HEADER_TOP + AVATAR_RADIUS * 2; // 128
const DIVIDER_Y = Math.max(AVATAR_BOTTOM, BASIC_VALUE_Y + 20) + 24; // 156
const FOOTER_HEIGHT = 48;
const QA_START_Y = DIVIDER_Y + 24;               // 180
const QA_AVAILABLE = CARD_HEIGHT - QA_START_Y - FOOTER_HEIGHT; // 222

// Fonts shrink only when many rows are needed; content is vertically centered.
const ROW_HEIGHT_NATURAL = 56; // row height when fonts are at maximum size
const ROW_HEIGHT_MIN = 34;     // minimum row height to keep text readable

const MAX_TEXT_W = CARD_WIDTH - PADDING * 2;       // 720
const COL_GAP = 16;
const HALF_WIDTH = Math.floor((MAX_TEXT_W - COL_GAP) / 2); // 352

type BasicFields = {
  name?: string | null;
  age?: string | null;
  gender?: string | null;
};

// ── Emoji-aware text rendering ────────────────────────────────────────────
// Font fallback ("A, B") is unreliable in @napi-rs/canvas; we split text
// into emoji/non-emoji segments and switch ctx.font explicitly per segment.

function isEmojiCodePoint(cp: number): boolean {
  return (
    (cp >= 0x1F600 && cp <= 0x1F64F) ||
    (cp >= 0x1F300 && cp <= 0x1F5FF) ||
    (cp >= 0x1F680 && cp <= 0x1F6FF) ||
    (cp >= 0x1F700 && cp <= 0x1F77F) ||
    (cp >= 0x1F780 && cp <= 0x1F7FF) ||
    (cp >= 0x1F800 && cp <= 0x1F8FF) ||
    (cp >= 0x1F900 && cp <= 0x1F9FF) ||
    (cp >= 0x1FA00 && cp <= 0x1FAFF) ||
    (cp >= 0x2600 && cp <= 0x26FF) ||
    (cp >= 0x2700 && cp <= 0x27BF) ||
    (cp >= 0x2B00 && cp <= 0x2BFF) ||
    (cp >= 0x1F1E0 && cp <= 0x1F1FF) ||
    (cp >= 0xFE00 && cp <= 0xFE0F) ||
    (cp >= 0xE0000 && cp <= 0xE007F) ||
    cp === 0x200D ||
    cp === 0x20E3
  );
}

function segmentText(text: string): { text: string; isEmoji: boolean }[] {
  const segs: { text: string; isEmoji: boolean }[] = [];
  let buf = "";
  let curEmoji: boolean | null = null;
  for (const ch of text) {
    const emoji = isEmojiCodePoint(ch.codePointAt(0)!);
    if (curEmoji === null || emoji === curEmoji) {
      buf += ch;
      curEmoji = emoji;
    } else {
      segs.push({ text: buf, isEmoji: curEmoji });
      buf = ch;
      curEmoji = emoji;
    }
  }
  if (buf) segs.push({ text: buf, isEmoji: curEmoji! });
  return segs;
}

function fillTextSegmented(
  ctx: ReturnType<Canvas["getContext"]>,
  text: string,
  x: number,
  y: number,
  regularFont: string,
  emojiSize: number,
  maxRight?: number
): void {
  let cx = x;
  for (const seg of segmentText(text)) {
    if (maxRight !== undefined && cx >= maxRight) break;
    ctx.font = seg.isEmoji ? `${emojiSize}px NotoEmoji` : regularFont;
    const available = maxRight !== undefined ? maxRight - cx : undefined;
    ctx.fillText(seg.text, cx, y, available);
    cx += ctx.measureText(seg.text).width;
  }
}

// ─────────────────────────────────────────────────────────────────────────

function getActiveBasicFields(
  basic: GuildBasicSettingRecord,
  fields: BasicFields
): { label: string; value: string }[] {
  const result: { label: string; value: string }[] = [];
  if (basic.nameEnabled && fields.name) result.push({ label: "名前", value: fields.name });
  if (basic.ageEnabled && fields.age) result.push({ label: "年齢", value: fields.age });
  if (basic.genderEnabled && fields.gender) result.push({ label: "性別", value: fields.gender });
  return result;
}

// ── Q&A row layout ────────────────────────────────────────────────────────

type QAItem = { q: GuildQuestionRecord; answer: string };
type QARow =
  | { type: "single"; item: QAItem }
  | { type: "pair"; left: QAItem; right: QAItem };

// Measure with max font sizes (conservative: fits at max → fits at any smaller size)
function canFitHalf(
  ctx: ReturnType<Canvas["getContext"]>,
  label: string,
  answer: string
): boolean {
  ctx.font = "bold 13px NotoSansJP";
  const labelW = ctx.measureText(label).width;
  ctx.font = "16px NotoSansJP";
  const answerW = ctx.measureText(answer).width;
  return Math.max(labelW, answerW) <= HALF_WIDTH - 8;
}

function buildRows(
  ctx: ReturnType<Canvas["getContext"]>,
  answeredQuestions: GuildQuestionRecord[],
  answers: Record<string, string>
): QARow[] {
  const rows: QARow[] = [];
  let i = 0;
  while (i < answeredQuestions.length) {
    const q = answeredQuestions[i];
    const answer = answers[String(q.orderIndex)];
    const fitsLeft = canFitHalf(ctx, q.label, answer);

    if (fitsLeft && i + 1 < answeredQuestions.length) {
      const q2 = answeredQuestions[i + 1];
      const answer2 = answers[String(q2.orderIndex)];
      if (canFitHalf(ctx, q2.label, answer2)) {
        rows.push({ type: "pair", left: { q, answer }, right: { q: q2, answer: answer2 } });
        i += 2;
        continue;
      }
    }
    rows.push({ type: "single", item: { q, answer } });
    i++;
  }
  return rows;
}

// ── Font scaling + vertical centering ────────────────────────────────────
// Card is always CARD_HEIGHT (450px). Fonts shrink when rows don't fit at
// natural size. The Q&A block is centered vertically in the available area.

type CardLayout = {
  rowHeight: number;
  labelSize: number;  // px
  answerSize: number; // px
  qaTopPad: number;   // offset to center the block vertically
};

function computeCardLayout(rowCount: number): CardLayout {
  const rowHeight = rowCount === 0
    ? ROW_HEIGHT_NATURAL
    : Math.max(ROW_HEIGHT_MIN, Math.min(ROW_HEIGHT_NATURAL, Math.floor(QA_AVAILABLE / rowCount)));
  // t = 0 at min row height (smallest fonts), 1 at natural row height (largest fonts)
  const t = Math.max(0, Math.min(1, (rowHeight - ROW_HEIGHT_MIN) / (ROW_HEIGHT_NATURAL - ROW_HEIGHT_MIN)));
  const totalQAHeight = rowCount * rowHeight;
  const qaTopPad = Math.max(0, Math.floor((QA_AVAILABLE - totalQAHeight) / 2));
  return {
    rowHeight,
    labelSize: Math.round(11 + t * 2),   // 11..13 px
    answerSize: Math.round(13 + t * 3),  // 13..16 px
    qaTopPad,
  };
}

// ─────────────────────────────────────────────────────────────────────────

function drawRoundedRect(
  ctx: ReturnType<Canvas["getContext"]>,
  x: number, y: number, w: number, h: number, r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapText(
  ctx: ReturnType<Canvas["getContext"]>,
  text: string,
  maxWidth: number
): string[] {
  const lines: string[] = [];
  let current = "";
  for (const ch of [...text]) {
    const test = current + ch;
    if (ctx.measureText(test).width > maxWidth && current.length > 0) {
      lines.push(current);
      current = ch;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export async function generateIntroCard(params: {
  avatarUrl: string;
  username: string;
  basic: GuildBasicSettingRecord;
  basicFields: BasicFields;
  questions: GuildQuestionRecord[];
  answers: Record<string, string>;
}): Promise<Buffer> {
  ensureFonts();

  const { avatarUrl, username, basic, basicFields, questions, answers } = params;
  const activeBasic = getActiveBasicFields(basic, basicFields);
  const answeredQuestions = questions.filter((q) => !!answers[String(q.orderIndex)]);

  // Measure-only pass to decide row layout (uses max font sizes — conservative)
  const measureCanvas = createCanvas(CARD_WIDTH, 200);
  const measureCtx = measureCanvas.getContext("2d");
  const rows = buildRows(measureCtx, answeredQuestions, answers);

  const { rowHeight, labelSize, answerSize, qaTopPad } = computeCardLayout(rows.length);
  const labelFont = `bold ${labelSize}px NotoSansJP`;
  const answerFont = `${answerSize}px NotoSansJP`;

  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT);
  const ctx = canvas.getContext("2d");

  // Background
  const grad = ctx.createLinearGradient(0, 0, 0, CARD_HEIGHT);
  grad.addColorStop(0, "#1a1a2e");
  grad.addColorStop(1, "#16213e");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  // Border
  ctx.strokeStyle = "rgba(88, 101, 242, 0.3)";
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, 1, 1, CARD_WIDTH - 2, CARD_HEIGHT - 2, 12);
  ctx.stroke();

  // ── Avatar ───────────────────────────────────────────────────────────────
  try {
    const avatarBuffer = await fetch(avatarUrl).then((r) => r.arrayBuffer());
    const avatarImg = await loadImage(Buffer.from(avatarBuffer));
    ctx.save();
    ctx.beginPath();
    ctx.arc(AVATAR_CX, AVATAR_CY, AVATAR_RADIUS, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(
      avatarImg,
      AVATAR_CX - AVATAR_RADIUS, AVATAR_CY - AVATAR_RADIUS,
      AVATAR_RADIUS * 2, AVATAR_RADIUS * 2
    );
    ctx.restore();
    ctx.strokeStyle = "#5865f2";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(AVATAR_CX, AVATAR_CY, AVATAR_RADIUS + 3, 0, Math.PI * 2);
    ctx.stroke();
  } catch {
    ctx.fillStyle = "#5865f2";
    ctx.beginPath();
    ctx.arc(AVATAR_CX, AVATAR_CY, AVATAR_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Username ─────────────────────────────────────────────────────────────
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  fillTextSegmented(ctx, username, RIGHT_X, USERNAME_Y, "bold 20px NotoSansJP", 20, RIGHT_X + RIGHT_MAX_W);

  // ── Basic fields ─────────────────────────────────────────────────────────
  if (activeBasic.length > 0) {
    const colWidth = Math.floor(RIGHT_MAX_W / activeBasic.length);
    for (let i = 0; i < activeBasic.length; i++) {
      const { label, value } = activeBasic[i];
      const colX = RIGHT_X + i * colWidth;

      ctx.font = "bold 16px NotoSansJP";
      ctx.fillStyle = "#a0a0c0";
      ctx.fillText(label, colX, BASIC_LABEL_Y, colWidth - 8);

      ctx.fillStyle = "#ffffff";
      fillTextSegmented(ctx, value, colX, BASIC_VALUE_Y, "22px NotoSansJP", 22, colX + colWidth - 8);
    }
  }

  // ── Divider ──────────────────────────────────────────────────────────────
  ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PADDING, DIVIDER_Y);
  ctx.lineTo(CARD_WIDTH - PADDING, DIVIDER_Y);
  ctx.stroke();

  // ── Custom Q&A rows (vertically centered in QA_AVAILABLE) ───────────────
  let currentY = QA_START_Y + qaTopPad;

  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri];

    const labelY = currentY + 2;
    const answerY = labelY + labelSize + 6;
    const answer2Y = answerY + answerSize + 3;
    const canFit2Lines = answer2Y + answerSize <= currentY + rowHeight;

    if (row.type === "single") {
      const { q, answer } = row.item;

      ctx.font = labelFont;
      ctx.fillStyle = "#a0a0c0";
      ctx.fillText(q.label, PADDING, labelY, MAX_TEXT_W);

      ctx.font = answerFont;
      ctx.fillStyle = "#ffffff";
      const lines = wrapText(ctx, answer, MAX_TEXT_W);
      fillTextSegmented(ctx, lines[0], PADDING, answerY, answerFont, answerSize);
      if (canFit2Lines && lines[1]) {
        fillTextSegmented(ctx, lines[1], PADDING, answer2Y, answerFont, answerSize);
      }
    } else {
      const rightColX = PADDING + HALF_WIDTH + COL_GAP;

      for (const [item, colX] of [[row.left, PADDING], [row.right, rightColX]] as const) {
        const { q, answer } = item;

        ctx.font = labelFont;
        ctx.fillStyle = "#a0a0c0";
        ctx.fillText(q.label, colX, labelY, HALF_WIDTH - 8);

        ctx.fillStyle = "#ffffff";
        fillTextSegmented(ctx, answer, colX, answerY, answerFont, answerSize, colX + HALF_WIDTH - 8);
      }

      // Vertical separator between columns
      ctx.strokeStyle = "rgba(255, 255, 255, 0.07)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PADDING + HALF_WIDTH + COL_GAP / 2, currentY + 2);
      ctx.lineTo(PADDING + HALF_WIDTH + COL_GAP / 2, currentY + rowHeight - 8);
      ctx.stroke();
    }

    currentY += rowHeight;

    if (ri < rows.length - 1) {
      const divY = currentY - Math.max(6, Math.floor(rowHeight * 0.12));
      ctx.strokeStyle = "rgba(255, 255, 255, 0.07)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PADDING, divY);
      ctx.lineTo(CARD_WIDTH - PADDING, divY);
      ctx.stroke();
    }
  }

  // ── Footer ───────────────────────────────────────────────────────────────
  const bottomDividerY = CARD_HEIGHT - FOOTER_HEIGHT + 4;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PADDING, bottomDividerY);
  ctx.lineTo(CARD_WIDTH - PADDING, bottomDividerY);
  ctx.stroke();

  ctx.font = "11px NotoSansJP";
  ctx.fillStyle = "#404060";
  ctx.textAlign = "right";
  ctx.fillText("Nextra", CARD_WIDTH - PADDING, CARD_HEIGHT - 16);

  return canvas.toBuffer("image/png");
}

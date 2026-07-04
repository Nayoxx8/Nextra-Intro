import { createCanvas, loadImage, GlobalFonts, type Canvas } from "@napi-rs/canvas";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import type { GuildQuestionRecord } from "../types.js";

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
const CARD_HEIGHT = 600;
const PADDING = 40;
const AVATAR_RADIUS = 48;
const HEADER_TOP = 32;
const AVATAR_CX = PADDING + AVATAR_RADIUS;         // 88
const AVATAR_CY = HEADER_TOP + AVATAR_RADIUS;      // 80
const RIGHT_X = PADDING + AVATAR_RADIUS * 2 + 20;  // 156
const RIGHT_MAX_W = CARD_WIDTH - PADDING - RIGHT_X; // 604
const USERNAME_Y = HEADER_TOP + 26;                // 58
const AVATAR_BOTTOM = HEADER_TOP + AVATAR_RADIUS * 2; // 128
const DIVIDER_Y = AVATAR_BOTTOM + 24;              // 152
const FOOTER_HEIGHT = 48;
const QA_START_Y = DIVIDER_Y + 24;                // 176
const QA_AVAILABLE = CARD_HEIGHT - QA_START_Y - FOOTER_HEIGHT; // 376

const ROW_HEIGHT_MIN = 40;

const MAX_TEXT_W = CARD_WIDTH - PADDING * 2;        // 720

// ── Emoji-aware text rendering ────────────────────────────────────────────

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

// ── Q&A row layout ────────────────────────────────────────────────────────

type QAItem = { q: GuildQuestionRecord; answer: string };

// ── Font scaling ──────────────────────────────────────────────────────────

type CardLayout = {
  rowHeight: number;
  labelSize: number;
  answerSize: number;
  labelGap: number;
  lineGap: number;
};

function computeCardLayout(rowCount: number): CardLayout {
  if (rowCount === 0) {
    return { rowHeight: 0, labelSize: 14, answerSize: 20, labelGap: 6, lineGap: 5 };
  }
  const rowHeight = Math.max(ROW_HEIGHT_MIN, Math.floor(QA_AVAILABLE / rowCount));
  // フォントサイズを行の高さに直接比例させる
  const answerSize = Math.min(60, Math.max(14, Math.floor(rowHeight * 0.25)));
  const labelSize = Math.min(30, Math.max(10, Math.floor(rowHeight * 0.13)));
  return {
    rowHeight,
    labelSize,
    answerSize,
    labelGap: Math.max(4, Math.round(labelSize * 0.45)),
    lineGap: Math.max(3, Math.round(answerSize * 0.25)),
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
  questions: GuildQuestionRecord[];
  answers: Record<string, string>;
}): Promise<Buffer> {
  ensureFonts();

  const { avatarUrl, username, questions, answers } = params;
  const answeredQuestions = questions.filter((q) => !!answers[String(q.orderIndex)]);
  const rows: QAItem[] = answeredQuestions.map((q) => ({ q, answer: answers[String(q.orderIndex)] }));

  const { rowHeight, labelSize, answerSize, labelGap, lineGap } = computeCardLayout(rows.length);
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

  // ── Divider ──────────────────────────────────────────────────────────────
  ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PADDING, DIVIDER_Y);
  ctx.lineTo(CARD_WIDTH - PADDING, DIVIDER_Y);
  ctx.stroke();

  // ── Q&A rows (single column) ─────────────────────────────────────────────
  let currentY = QA_START_Y;

  for (let ri = 0; ri < rows.length; ri++) {
    const { q, answer } = rows[ri];

    const offsetLabel = 2;
    const offsetAnswer = offsetLabel + labelSize + labelGap;
    const offsetAnswer2 = offsetAnswer + answerSize + lineGap;
    const blockWith2 = offsetAnswer2 + answerSize;
    const blockWith1 = offsetAnswer + answerSize;
    const canFit2Lines = blockWith2 <= rowHeight - 2;
    const blockH = canFit2Lines ? blockWith2 : blockWith1;

    const vShift = Math.max(0, Math.floor((rowHeight - blockH) / 2));
    const labelY = currentY + vShift + offsetLabel;
    const answerY = currentY + vShift + offsetAnswer;
    const answer2Y = currentY + vShift + offsetAnswer2;

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

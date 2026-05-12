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
const ROW_HEIGHT = 56;
const FOOTER_HEIGHT = 48;

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
    (cp >= 0x1F600 && cp <= 0x1F64F) || // Emoticons
    (cp >= 0x1F300 && cp <= 0x1F5FF) || // Misc Symbols and Pictographs
    (cp >= 0x1F680 && cp <= 0x1F6FF) || // Transport and Map
    (cp >= 0x1F700 && cp <= 0x1F77F) || // Alchemical
    (cp >= 0x1F780 && cp <= 0x1F7FF) || // Geometric Shapes Extended
    (cp >= 0x1F800 && cp <= 0x1F8FF) || // Supplemental Arrows-C
    (cp >= 0x1F900 && cp <= 0x1F9FF) || // Supplemental Symbols and Pictographs
    (cp >= 0x1FA00 && cp <= 0x1FAFF) || // Symbols and Pictographs Extended-A
    (cp >= 0x2600 && cp <= 0x26FF) ||   // Misc Symbols
    (cp >= 0x2700 && cp <= 0x27BF) ||   // Dingbats
    (cp >= 0x2B00 && cp <= 0x2BFF) ||   // Misc Symbols and Arrows
    (cp >= 0x1F1E0 && cp <= 0x1F1FF) || // Regional Indicators (flags)
    (cp >= 0xFE00 && cp <= 0xFE0F) ||   // Variation Selectors
    (cp >= 0xE0000 && cp <= 0xE007F) || // Tags
    cp === 0x200D ||                     // ZWJ
    cp === 0x20E3                        // Combining Enclosing Keycap
  );
}

function segmentText(text: string): { text: string; isEmoji: boolean }[] {
  const segs: { text: string; isEmoji: boolean }[] = [];
  let buf = "";
  let curEmoji: boolean | null = null;
  for (const ch of text) { // iterates Unicode code points
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

function computeHeight(rowCount: number): number {
  return Math.max(280, DIVIDER_Y + 16 + rowCount * ROW_HEIGHT + FOOTER_HEIGHT);
}

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
  for (const ch of [...text]) { // spread iterates by Unicode code point
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

  // Measure-only pass to decide row layout
  const measureCanvas = createCanvas(CARD_WIDTH, 200);
  const measureCtx = measureCanvas.getContext("2d");
  const rows = buildRows(measureCtx, answeredQuestions, answers);

  const height = computeHeight(rows.length);
  const canvas = createCanvas(CARD_WIDTH, height);
  const ctx = canvas.getContext("2d");

  // Background
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, "#1a1a2e");
  grad.addColorStop(1, "#16213e");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CARD_WIDTH, height);

  // Border
  ctx.strokeStyle = "rgba(88, 101, 242, 0.3)";
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, 1, 1, CARD_WIDTH - 2, height - 2, 12);
  ctx.stroke();

  // ── Avatar (left) ────────────────────────────────────────────────────────
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

  // ── Basic fields (horizontal columns) ────────────────────────────────────
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

  // ── Custom Q&A rows ──────────────────────────────────────────────────────
  let currentY = DIVIDER_Y + 24;

  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri];

    if (row.type === "single") {
      const { q, answer } = row.item;

      ctx.font = "bold 13px NotoSansJP";
      ctx.fillStyle = "#a0a0c0";
      ctx.fillText(q.label, PADDING, currentY, MAX_TEXT_W);

      ctx.font = "16px NotoSansJP";
      ctx.fillStyle = "#ffffff";
      const lines = wrapText(ctx, answer, MAX_TEXT_W);
      let lineY = currentY + 22;
      for (const line of lines.slice(0, 2)) {
        fillTextSegmented(ctx, line, PADDING, lineY, "16px NotoSansJP", 16);
        lineY += 22;
      }
    } else {
      const rightColX = PADDING + HALF_WIDTH + COL_GAP;

      for (const [item, colX] of [[row.left, PADDING], [row.right, rightColX]] as const) {
        const { q, answer } = item;

        ctx.font = "bold 13px NotoSansJP";
        ctx.fillStyle = "#a0a0c0";
        ctx.fillText(q.label, colX, currentY, HALF_WIDTH - 8);

        ctx.fillStyle = "#ffffff";
        fillTextSegmented(ctx, answer, colX, currentY + 22, "16px NotoSansJP", 16, colX + HALF_WIDTH - 8);
      }

      // Vertical separator between columns
      ctx.strokeStyle = "rgba(255, 255, 255, 0.07)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PADDING + HALF_WIDTH + COL_GAP / 2, currentY - 4);
      ctx.lineTo(PADDING + HALF_WIDTH + COL_GAP / 2, currentY + ROW_HEIGHT - 12);
      ctx.stroke();
    }

    currentY += ROW_HEIGHT;

    if (ri < rows.length - 1) {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.07)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PADDING, currentY - 10);
      ctx.lineTo(CARD_WIDTH - PADDING, currentY - 10);
      ctx.stroke();
    }
  }

  // ── Footer ───────────────────────────────────────────────────────────────
  const bottomDividerY = height - FOOTER_HEIGHT + 4;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PADDING, bottomDividerY);
  ctx.lineTo(CARD_WIDTH - PADDING, bottomDividerY);
  ctx.stroke();

  ctx.font = "11px NotoSansJP";
  ctx.fillStyle = "#404060";
  ctx.textAlign = "right";
  ctx.fillText("Nextra", CARD_WIDTH - PADDING, height - 16);

  return canvas.toBuffer("image/png");
}

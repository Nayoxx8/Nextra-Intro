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
const BASIC_LABEL_Y = USERNAME_Y + 22;            // 80
const BASIC_VALUE_Y = BASIC_LABEL_Y + 22;         // 102
const AVATAR_BOTTOM = HEADER_TOP + AVATAR_RADIUS * 2; // 128
const DIVIDER_Y = Math.max(AVATAR_BOTTOM, BASIC_VALUE_Y + 20) + 24; // 152
const ROW_HEIGHT = 72;
const FOOTER_HEIGHT = 48;

type BasicFields = {
  name?: string | null;
  age?: string | null;
  gender?: string | null;
};

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

function computeHeight(answeredQuestionCount: number): number {
  return Math.max(280, DIVIDER_Y + 16 + answeredQuestionCount * ROW_HEIGHT + FOOTER_HEIGHT);
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
  const height = computeHeight(answeredQuestions.length);

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

  // ── Right side: username ─────────────────────────────────────────────────
  ctx.textAlign = "left";
  ctx.font = "bold 20px NotoSansJP, NotoEmoji";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(username, RIGHT_X, USERNAME_Y, RIGHT_MAX_W);

  // ── Basic fields (horizontal columns) ────────────────────────────────────
  if (activeBasic.length > 0) {
    const colWidth = Math.floor(RIGHT_MAX_W / activeBasic.length);
    for (let i = 0; i < activeBasic.length; i++) {
      const { label, value } = activeBasic[i];
      const colX = RIGHT_X + i * colWidth;

      ctx.font = "bold 13px NotoSansJP";
      ctx.fillStyle = "#a0a0c0";
      ctx.fillText(label, colX, BASIC_LABEL_Y, colWidth - 8);

      ctx.font = "17px NotoSansJP, NotoEmoji";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(value, colX, BASIC_VALUE_Y, colWidth - 8);
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
  const maxTextWidth = CARD_WIDTH - PADDING * 2;
  let currentY = DIVIDER_Y + 24;

  for (let i = 0; i < answeredQuestions.length; i++) {
    const q = answeredQuestions[i];
    const answerText = answers[String(q.orderIndex)];

    ctx.font = "bold 13px NotoSansJP";
    ctx.fillStyle = "#a0a0c0";
    ctx.fillText(q.label, PADDING, currentY, maxTextWidth);

    ctx.font = "16px NotoSansJP, NotoEmoji";
    ctx.fillStyle = "#ffffff";
    const lines = wrapText(ctx, answerText, maxTextWidth);
    let lineY = currentY + 22;
    for (const line of lines.slice(0, 2)) {
      ctx.fillText(line, PADDING, lineY, maxTextWidth);
      lineY += 22;
    }

    currentY += ROW_HEIGHT;

    if (i < answeredQuestions.length - 1) {
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

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
  fontsRegistered = true;
}

const CARD_WIDTH = 800;
const PADDING = 40;
const AVATAR_RADIUS = 50;
const AVATAR_Y = 36;
const USERNAME_Y = 175;
const DIVIDER_Y = 198;
const BASIC_ROW_HEIGHT = 52;
const ROW_HEIGHT = 76;
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

function computeHeight(
  basicCount: number,
  answeredQuestionCount: number
): number {
  const basicSection = basicCount > 0 ? basicCount * BASIC_ROW_HEIGHT + 16 : 0;
  return Math.max(300, DIVIDER_Y + basicSection + answeredQuestionCount * ROW_HEIGHT + FOOTER_HEIGHT + 32);
}

function drawRoundedRect(
  ctx: ReturnType<Canvas["getContext"]>,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
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
  for (const ch of text.split("")) {
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
  const height = computeHeight(activeBasic.length, answeredQuestions.length);
  const canvas = createCanvas(CARD_WIDTH, height);
  const ctx = canvas.getContext("2d");
  const maxTextWidth = CARD_WIDTH - PADDING * 2;

  // Background gradient
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

  // Avatar
  const avatarX = CARD_WIDTH / 2;
  const avatarCenterY = AVATAR_Y + AVATAR_RADIUS;
  try {
    const avatarBuffer = await fetch(avatarUrl).then((r) => r.arrayBuffer());
    const avatarImg = await loadImage(Buffer.from(avatarBuffer));
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX, avatarCenterY, AVATAR_RADIUS, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(avatarImg, avatarX - AVATAR_RADIUS, AVATAR_Y, AVATAR_RADIUS * 2, AVATAR_RADIUS * 2);
    ctx.restore();
    ctx.strokeStyle = "#5865f2";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(avatarX, avatarCenterY, AVATAR_RADIUS + 3, 0, Math.PI * 2);
    ctx.stroke();
  } catch {
    ctx.fillStyle = "#5865f2";
    ctx.beginPath();
    ctx.arc(avatarX, avatarCenterY, AVATAR_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  }

  // Username
  ctx.font = "bold 22px NotoSansJP";
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.fillText(username, avatarX, USERNAME_Y, maxTextWidth);

  // Divider after header
  ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PADDING, DIVIDER_Y);
  ctx.lineTo(CARD_WIDTH - PADDING, DIVIDER_Y);
  ctx.stroke();

  let currentY = DIVIDER_Y + 24;

  // ── Basic fields section ─────────────────────────────────────────────────
  if (activeBasic.length > 0) {
    for (const { label, value } of activeBasic) {
      // Label
      ctx.font = "bold 13px NotoSansJP";
      ctx.fillStyle = "#a0a0c0";
      ctx.textAlign = "left";
      ctx.fillText(label, PADDING, currentY);

      // Value
      ctx.font = "16px NotoSansJP";
      ctx.fillStyle = value ? "#ffffff" : "#606080";
      ctx.fillText(value || "（未入力）", PADDING, currentY + 22, maxTextWidth);

      currentY += BASIC_ROW_HEIGHT;
    }

    // Divider between basic and custom Q&A
    if (questions.length > 0) {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PADDING, currentY);
      ctx.lineTo(CARD_WIDTH - PADDING, currentY);
      ctx.stroke();
      currentY += 16;
    }
  }

  // ── Custom Q&A rows (answered only) ─────────────────────────────────────
  for (let i = 0; i < answeredQuestions.length; i++) {
    const q = answeredQuestions[i];
    const answerText = answers[String(q.orderIndex)];

    ctx.font = "bold 13px NotoSansJP";
    ctx.fillStyle = "#a0a0c0";
    ctx.textAlign = "left";
    ctx.fillText(q.label, PADDING, currentY, maxTextWidth);

    ctx.font = "16px NotoSansJP";
    ctx.fillStyle = "#ffffff";
    const lines = wrapText(ctx, answerText, maxTextWidth);
    let lineY = currentY + 24;
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

  // Bottom divider + watermark
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

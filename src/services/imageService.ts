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
  fontsRegistered = true;
}

const CARD_WIDTH = 800;
const PADDING = 40;
const AVATAR_RADIUS = 50;
const AVATAR_Y = 36;
const USERNAME_Y = 175;
const DIVIDER_Y = 198;
const QUESTIONS_START_Y = 230;
const ROW_HEIGHT = 76;
const FOOTER_HEIGHT = 48;

function computeHeight(questionCount: number): number {
  return Math.max(340, QUESTIONS_START_Y + questionCount * ROW_HEIGHT + FOOTER_HEIGHT);
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
  const words = text.split("");
  const lines: string[] = [];
  let current = "";

  for (const ch of words) {
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
  const height = computeHeight(questions.length);
  const canvas = createCanvas(CARD_WIDTH, height);
  const ctx = canvas.getContext("2d");

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, "#1a1a2e");
  grad.addColorStop(1, "#16213e");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CARD_WIDTH, height);

  // Subtle inner glow border
  ctx.strokeStyle = "rgba(88, 101, 242, 0.3)";
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, 1, 1, CARD_WIDTH - 2, height - 2, 12);
  ctx.stroke();

  // Avatar circle
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

    // Avatar border ring
    ctx.strokeStyle = "#5865f2";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(avatarX, avatarCenterY, AVATAR_RADIUS + 3, 0, Math.PI * 2);
    ctx.stroke();
  } catch {
    // Avatar fallback: colored circle
    ctx.fillStyle = "#5865f2";
    ctx.beginPath();
    ctx.arc(avatarX, avatarCenterY, AVATAR_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  }

  // Username
  ctx.font = "bold 22px NotoSansJP";
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.fillText(username, avatarX, USERNAME_Y, CARD_WIDTH - PADDING * 2);

  // Divider
  ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PADDING, DIVIDER_Y);
  ctx.lineTo(CARD_WIDTH - PADDING, DIVIDER_Y);
  ctx.stroke();

  // Q&A rows
  const maxTextWidth = CARD_WIDTH - PADDING * 2;
  let currentY = QUESTIONS_START_Y;

  for (const q of questions) {
    const answerText = answers[String(q.orderIndex)] ?? "";

    // Question label
    ctx.font = "bold 13px NotoSansJP";
    ctx.fillStyle = "#a0a0c0";
    ctx.textAlign = "left";
    ctx.fillText(q.label, PADDING, currentY, maxTextWidth);

    // Answer text with wrapping
    ctx.font = "16px NotoSansJP";
    ctx.fillStyle = answerText ? "#ffffff" : "#606080";
    const displayText = answerText || "（未入力）";
    const lines = wrapText(ctx, displayText, maxTextWidth);
    let lineY = currentY + 24;
    for (const line of lines.slice(0, 2)) {
      ctx.fillText(line, PADDING, lineY, maxTextWidth);
      lineY += 22;
    }

    currentY += ROW_HEIGHT;

    // Row separator (except after last)
    if (q.orderIndex < questions.length - 1) {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.07)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PADDING, currentY - 10);
      ctx.lineTo(CARD_WIDTH - PADDING, currentY - 10);
      ctx.stroke();
    }
  }

  // Bottom divider
  const bottomDividerY = height - FOOTER_HEIGHT + 4;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PADDING, bottomDividerY);
  ctx.lineTo(CARD_WIDTH - PADDING, bottomDividerY);
  ctx.stroke();

  // Nextra watermark
  ctx.font = "11px NotoSansJP";
  ctx.fillStyle = "#404060";
  ctx.textAlign = "right";
  ctx.fillText("Nextra", CARD_WIDTH - PADDING, height - 16);

  return canvas.toBuffer("image/png");
}

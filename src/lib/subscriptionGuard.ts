import prisma from "./prisma.js";
import { freeGuildIds } from "../config.js";

export async function checkSubscription(guildId: string, botName: string): Promise<boolean> {
  if (freeGuildIds.has(guildId)) return true;
  const rows = await prisma.$queryRaw<Array<{ status: string; selectedBots: string[] }>>`
    SELECT status, "selectedBots" FROM nextra."GuildSubscription" WHERE "guildId" = ${guildId}
  `;
  if (!rows.length) return false;
  const row = rows[0]!;
  return row.status === "ACTIVE" && row.selectedBots.includes(botName);
}

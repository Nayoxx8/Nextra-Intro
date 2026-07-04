import { config as dotenvConfig } from "dotenv";
import { z } from "zod";

dotenvConfig();

const schema = z.object({
  DISCORD_TOKEN: z.string().min(1),
  DISCORD_CLIENT_ID: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  FREE_GUILD_IDS: z.string().default(""),
});

export const freeGuildIds: ReadonlySet<string> = new Set(
  process.env.FREE_GUILD_IDS?.split(",").map((s) => s.trim()).filter(Boolean) ?? []
);

export const env = schema.parse(process.env);

import { config as dotenvConfig } from "dotenv";
import { z } from "zod";

dotenvConfig();

const schema = z.object({
  DISCORD_TOKEN: z.string().min(1),
  DISCORD_CLIENT_ID: z.string().min(1),
  DATABASE_URL: z.string().min(1),
});

export const env = schema.parse(process.env);

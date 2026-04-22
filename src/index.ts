import { Client, GatewayIntentBits } from "discord.js";
import { env } from "./config.js";
import { IntroRepository } from "./repositories/introRepository.js";
import { registerCommandsOnReady } from "./registerCommands.js";
import { registerInteractionHandler } from "./interactionHandler.js";
import type { BotContext } from "./types.js";

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const context: BotContext = {
  repo: new IntroRepository(),
};

registerCommandsOnReady(client);
registerInteractionHandler(client, context);

client.login(env.DISCORD_TOKEN);

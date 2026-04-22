import { Events, type Client, type Guild } from "discord.js";
import { introSetupCommand } from "./commands/introSetup.js";
import { introPanelCommand } from "./commands/introPanel.js";

const MAX_ATTEMPTS = 3;
const commandPayload = [introSetupCommand.toJSON(), introPanelCommand.toJSON()] as const;

type RegisterableGuild = Pick<Guild, "id" | "name" | "commands">;

const guildLabel = (g: Pick<RegisterableGuild, "id" | "name">): string => `${g.name} (${g.id})`;

async function registerForGuild(guild: RegisterableGuild): Promise<void> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await guild.commands.set(commandPayload);
      console.log(`[commands] registered guild=${guildLabel(guild)} attempt=${attempt}`);
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown";
      if (attempt === MAX_ATTEMPTS) {
        console.error(`[commands] failed guild=${guildLabel(guild)} error=${msg}`);
      } else {
        console.warn(`[commands] retry guild=${guildLabel(guild)} attempt=${attempt} error=${msg}`);
      }
    }
  }
}

export function registerCommandsOnReady(client: Client): void {
  client.on(Events.ClientReady, async (ready) => {
    const guilds = [...ready.guilds.cache.values()];
    await Promise.all(guilds.map(registerForGuild));
    console.log(`Logged in as ${ready.user.tag}`);
  });

  client.on(Events.GuildCreate, async (guild) => {
    await registerForGuild(guild);
  });
}

import { AttachmentBuilder, Events, VoiceChannel, type Client } from "discord.js";
import type { BotContext } from "./types.js";
import { checkSubscription } from "./lib/subscriptionGuard.js";
import { generateIntroCard } from "./services/imageService.js";

export function registerVoiceHandler(client: Client, context: BotContext): void {
  client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    if (!newState.channelId) return;
    if (newState.channelId === oldState.channelId) return;

    const channel = newState.channel;
    if (!(channel instanceof VoiceChannel)) return;

    const member = newState.member;
    if (!member || member.user.bot) return;

    const guildId = newState.guild.id;
    const userId = member.id;

    if (!(await checkSubscription(guildId, "Intro"))) return;

    try {
      const intro = await context.repo.getUserIntro(guildId, userId);
      if (!intro) return;

      const hasContent = !!(
        intro.basicName || intro.basicAge || intro.basicGender ||
        Object.keys(intro.answers ?? {}).length > 0
      );
      if (!hasContent) return;

      const [basic, questions] = await Promise.all([
        context.repo.getBasicSetting(guildId),
        context.repo.getQuestions(guildId),
      ]);

      const imageBuffer = await generateIntroCard({
        avatarUrl: member.displayAvatarURL({ extension: "png", size: 128 }),
        username: member.displayName,
        basic,
        basicFields: {
          name: intro.basicName,
          age: intro.basicAge,
          gender: intro.basicGender,
        },
        questions,
        answers: intro.answers ?? {},
      });

      const attachment = new AttachmentBuilder(imageBuffer, { name: `intro-${userId}.png` });
      await channel.send({ files: [attachment] });
    } catch (err) {
      console.error("[voice] failed to send intro:", err);
    }
  });
}

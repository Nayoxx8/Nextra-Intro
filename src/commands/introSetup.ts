import {
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  MessageFlags,
} from "discord.js";
import type { BotContext } from "../types.js";
import { buildSetupEmbed, buildSetupComponents } from "../panels/setupPanel.js";

export const introSetupCommand = new SlashCommandBuilder()
  .setName("自己紹介設定")
  .setDescription("自己紹介ボットの設定パネルを表示します")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setDMPermission(false);

export async function executeIntroSetup(
  interaction: ChatInputCommandInteraction,
  context: BotContext
): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId) return;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const [questions, setting] = await Promise.all([
    context.repo.getQuestions(guildId),
    context.repo.getGuildSetting(guildId),
  ]);

  await interaction.editReply({
    embeds: [buildSetupEmbed(questions, setting?.displayChannelId ?? null)],
    components: buildSetupComponents(questions.length),
  });
}

import {
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  MessageFlags,
  type TextChannel,
} from "discord.js";
import type { BotContext } from "../types.js";
import { buildIntroPanelEmbed, buildIntroPanelComponents } from "../panels/introPanel.js";

export const introPanelCommand = new SlashCommandBuilder()
  .setName("自己紹介パネル")
  .setDescription("自己紹介作成パネルを表示チャンネルに投稿します")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setDMPermission(false);

export async function executeIntroPanel(
  interaction: ChatInputCommandInteraction,
  context: BotContext
): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId) return;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const [setting, basic] = await Promise.all([
    context.repo.getGuildSetting(guildId),
    context.repo.getBasicSetting(guildId),
  ]);

  if (!setting?.displayChannelId) {
    await interaction.editReply({ content: "先に `/自己紹介設定` で表示チャンネルを設定してください。" });
    return;
  }

  const channel = await interaction.client.channels.fetch(setting.displayChannelId).catch(() => null);
  if (!channel || !channel.isTextBased()) {
    await interaction.editReply({ content: "表示チャンネルが見つかりません。チャンネルを再設定してください。" });
    return;
  }

  const hasBasic = basic.nameEnabled || basic.ageEnabled || basic.genderEnabled;

  // Disable old panel
  if (setting.panelMessageId) {
    try {
      const old = await (channel as TextChannel).messages.fetch(setting.panelMessageId);
      await old.edit({ components: buildIntroPanelComponents(true, hasBasic) });
    } catch { /* already gone */ }
  }

  const sent = await (channel as TextChannel).send({
    embeds: [buildIntroPanelEmbed()],
    components: buildIntroPanelComponents(false, hasBasic),
  });

  await context.repo.upsertGuildSetting({ guildId, panelMessageId: sent.id });
  await interaction.editReply({ content: `<#${setting.displayChannelId}> にパネルを投稿しました。` });
}

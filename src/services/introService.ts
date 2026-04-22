import {
  AttachmentBuilder,
  DiscordAPIError,
  GuildMember,
  MessageFlags,
  type ModalSubmitInteraction,
  type TextChannel,
} from "discord.js";
import type { BotContext, GuildQuestionRecord } from "../types.js";
import { generateIntroCard } from "./imageService.js";
import { buildIntroPanelComponents } from "../panels/introPanel.js";

const inFlightUsers = new Set<string>();

export async function handleIntroSubmit(
  interaction: ModalSubmitInteraction,
  context: BotContext,
  questions: GuildQuestionRecord[]
): Promise<void> {
  const { guildId, user } = interaction;
  if (!guildId) return;

  const key = `${guildId}:${user.id}`;
  if (inFlightUsers.has(key)) {
    await interaction.reply({
      content: "処理中です。しばらくお待ちください。",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  inFlightUsers.add(key);

  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Collect answers from modal fields
    const answers: Record<string, string> = {};
    for (const q of questions) {
      try {
        const val = interaction.fields.getTextInputValue(`nextra-intro:answer:${q.orderIndex}`).trim();
        if (val) answers[String(q.orderIndex)] = val;
      } catch {
        // Optional field not filled
      }
    }

    // Validate required fields
    for (const q of questions) {
      if (q.required && !answers[String(q.orderIndex)]) {
        await interaction.editReply({ content: `「${q.label}」は必須項目です。` });
        return;
      }
    }

    // Check display channel is configured
    const setting = await context.repo.getGuildSetting(guildId);
    if (!setting?.displayChannelId) {
      await interaction.editReply({ content: "表示チャンネルが設定されていません。管理者に連絡してください。" });
      return;
    }

    const channel = await interaction.client.channels.fetch(setting.displayChannelId).catch(() => null);
    if (!channel || !channel.isTextBased()) {
      await interaction.editReply({ content: "表示チャンネルが見つかりません。管理者に連絡してください。" });
      return;
    }

    // Generate image
    const avatarUrl = user.displayAvatarURL({ extension: "png", size: 128 });
    const displayName =
      interaction.member instanceof GuildMember
        ? interaction.member.displayName
        : user.displayName;
    const imageBuffer = await generateIntroCard({
      avatarUrl,
      username: displayName,
      questions,
      answers,
    });
    const attachment = new AttachmentBuilder(imageBuffer, { name: `intro-${user.id}.png` });

    // Get existing intro to update or post new
    const existing = await context.repo.getUserIntro(guildId, user.id);
    let newMessageId: string | null = null;

    if (existing?.messageId) {
      try {
        const msg = await (channel as TextChannel).messages.fetch(existing.messageId);
        const edited = await msg.edit({ files: [attachment] });
        newMessageId = edited.id;
      } catch (err) {
        if (err instanceof DiscordAPIError && err.code === 10008) {
          // Message was deleted, post a new one
          const sent = await (channel as TextChannel).send({ files: [attachment] });
          newMessageId = sent.id;
          await refreshPanelToBottom(channel as TextChannel, setting.panelMessageId);
        } else {
          throw err;
        }
      }
    } else {
      const sent = await (channel as TextChannel).send({ files: [attachment] });
      newMessageId = sent.id;
      await refreshPanelToBottom(channel as TextChannel, setting.panelMessageId);
    }

    await context.repo.saveUserIntro(guildId, user.id, answers, newMessageId);
    await interaction.editReply({ content: "自己紹介を保存しました！" });
  } finally {
    inFlightUsers.delete(key);
  }
}

async function refreshPanelToBottom(
  channel: TextChannel,
  panelMessageId: string | null
): Promise<void> {
  if (!panelMessageId) return;
  try {
    const panelMsg = await channel.messages.fetch(panelMessageId);
    const embed = panelMsg.embeds[0];
    if (!embed) return;
    await panelMsg.delete();
    await channel.send({
      embeds: [embed],
      components: buildIntroPanelComponents(),
    });
  } catch {
    // Panel already gone or permission issue — ignore
  }
}

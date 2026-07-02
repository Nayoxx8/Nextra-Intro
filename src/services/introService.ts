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
import { EDIT_INPUT_ID } from "../modals/introModal.js";

const inFlightUsers = new Set<string>();

async function postOrEditImage(
  interaction: ModalSubmitInteraction,
  context: BotContext,
  guildId: string,
  buildImageFn: () => Promise<Buffer>,
  saveData: Parameters<BotContext["repo"]["saveUserIntro"]>[2]
): Promise<void> {
  const { user } = interaction;
  const key = `${guildId}:${user.id}`;
  if (inFlightUsers.has(key)) {
    await interaction.reply({ content: "処理中です。しばらくお待ちください。", flags: MessageFlags.Ephemeral });
    return;
  }
  inFlightUsers.add(key);

  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

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

    const imageBuffer = await buildImageFn();
    const attachment = new AttachmentBuilder(imageBuffer, { name: `intro-${user.id}.png` });

    const existing = await context.repo.getUserIntro(guildId, user.id);
    let newMessageId: string | null = null;

    if (existing?.messageId) {
      try {
        const msg = await (channel as TextChannel).messages.fetch(existing.messageId);
        const edited = await msg.edit({ files: [attachment] });
        newMessageId = edited.id;
      } catch (err) {
        if (err instanceof DiscordAPIError && err.code === 10008) {
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

    await context.repo.saveUserIntro(guildId, user.id, { ...saveData, messageId: newMessageId });
    await interaction.editReply({ content: "自己紹介を保存しました！" });
  } finally {
    inFlightUsers.delete(key);
  }
}

export async function handleIntroSubmit(
  interaction: ModalSubmitInteraction,
  context: BotContext,
  questions: GuildQuestionRecord[]
): Promise<void> {
  const { guildId, user } = interaction;
  if (!guildId) return;

  const answers: Record<string, string> = {};
  for (const q of questions) {
    try {
      const val = interaction.fields.getTextInputValue(`nextra-intro:answer:${q.orderIndex}`).trim();
      if (val) answers[String(q.orderIndex)] = val;
    } catch { /* optional field */ }
  }

  for (const q of questions) {
    if (q.required && !answers[String(q.orderIndex)]) {
      await interaction.reply({ content: `「${q.label}」は必須項目です。`, flags: MessageFlags.Ephemeral });
      return;
    }
  }

  const member = interaction.member instanceof GuildMember ? interaction.member : null;
  const displayName = member?.displayName ?? user.displayName;
  const avatarUrl = member?.displayAvatarURL({ extension: "png", size: 128 })
    ?? user.displayAvatarURL({ extension: "png", size: 128 });

  await postOrEditImage(
    interaction,
    context,
    guildId,
    () => generateIntroCard({ avatarUrl, username: displayName, questions, answers }),
    { answers }
  );
}

export async function handleSingleFieldEdit(
  interaction: ModalSubmitInteraction,
  context: BotContext
): Promise<void> {
  const { guildId, user } = interaction;
  if (!guildId) return;

  // customId: nextra-intro:edit:custom:0
  const parts = interaction.customId.split(":");
  const orderIndex = parseInt(parts[3], 10);

  const newValue = getField(interaction, EDIT_INPUT_ID);

  const [questions, existing] = await Promise.all([
    context.repo.getQuestions(guildId),
    context.repo.getUserIntro(guildId, user.id),
  ]);

  const mergedAnswers: Record<string, string> = { ...(existing?.answers ?? {}) };
  if (newValue) {
    mergedAnswers[String(orderIndex)] = newValue;
  } else {
    delete mergedAnswers[String(orderIndex)];
  }

  const member = interaction.member instanceof GuildMember ? interaction.member : null;
  const displayName = member?.displayName ?? user.displayName;
  const avatarUrl = member?.displayAvatarURL({ extension: "png", size: 128 })
    ?? user.displayAvatarURL({ extension: "png", size: 128 });

  await postOrEditImage(
    interaction,
    context,
    guildId,
    () => generateIntroCard({ avatarUrl, username: displayName, questions, answers: mergedAnswers }),
    { answers: mergedAnswers }
  );
}

function getField(interaction: ModalSubmitInteraction, customId: string): string | null {
  try {
    const val = interaction.fields.getTextInputValue(customId).trim();
    return val || null;
  } catch {
    return null;
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
    await channel.send({ embeds: [embed], components: buildIntroPanelComponents() });
  } catch { /* ignore */ }
}

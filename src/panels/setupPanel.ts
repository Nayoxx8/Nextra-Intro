import {
  ActionRowBuilder,
  EmbedBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import type { GuildQuestionRecord } from "../types.js";

export const SETUP_SELECT_MENU_ID = "nextra-intro:setup:select";
export const SETUP_QUESTION_SUBMENU_ID = "nextra-intro:setup:q-submenu";
export const ADD_QUESTION_MODAL_ID = "nextra-intro:setup:add-q:modal";
export const ADD_QUESTION_LABEL_INPUT_ID = "nextra-intro:setup:add-q:label";
export const ADD_QUESTION_REQUIRED_INPUT_ID = "nextra-intro:setup:add-q:required";
export const SET_CHANNEL_MODAL_ID = "nextra-intro:setup:set-channel:modal";
export const SET_CHANNEL_INPUT_ID = "nextra-intro:setup:set-channel:input";

export function buildSetupEmbed(
  questions: GuildQuestionRecord[],
  displayChannelId: string | null
): EmbedBuilder {
  const channelText = displayChannelId ? `<#${displayChannelId}>` : "未設定";
  const questionLines =
    questions.length === 0
      ? "質問なし"
      : questions.map((q, i) => `**${i + 1}.** ${q.label}${q.required ? "（必須）" : "（任意）"}`).join("\n");

  return new EmbedBuilder()
    .setTitle("自己紹介 設定パネル")
    .setColor(0x5865f2)
    .addFields(
      { name: "表示チャンネル", value: channelText, inline: false },
      { name: `質問（${questions.length}/5）`, value: questionLines, inline: false }
    );
}

export function buildSetupComponents(
  questionCount: number
): ActionRowBuilder<StringSelectMenuBuilder>[] {
  const options: StringSelectMenuOptionBuilder[] = [
    new StringSelectMenuOptionBuilder()
      .setValue("edit-questions")
      .setLabel("質問の編集")
      .setDescription("質問の追加・削除を行います"),
    new StringSelectMenuOptionBuilder()
      .setValue("set-channel")
      .setLabel("チャンネルを設定")
      .setDescription("自己紹介の表示先チャンネルを変更します"),
  ];

  const menu = new StringSelectMenuBuilder()
    .setCustomId(SETUP_SELECT_MENU_ID)
    .setPlaceholder("設定項目を選んでください")
    .addOptions(options);

  return [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)];
}

export function buildQuestionSubMenu(
  questions: GuildQuestionRecord[]
): ActionRowBuilder<StringSelectMenuBuilder>[] {
  const options: StringSelectMenuOptionBuilder[] = [
    new StringSelectMenuOptionBuilder()
      .setValue("q-back")
      .setLabel("← 戻る")
      .setDescription("メインメニューに戻ります"),
  ];

  if (questions.length < 5) {
    options.push(
      new StringSelectMenuOptionBuilder()
        .setValue("q-add")
        .setLabel("質問を追加")
        .setDescription(`新しい質問を追加します（現在 ${questions.length}/5）`)
    );
  }

  for (const q of questions) {
    options.push(
      new StringSelectMenuOptionBuilder()
        .setValue(`q-del:${q.orderIndex}`)
        .setLabel(`「${q.label}」を削除`)
        .setDescription(q.required ? "必須の質問" : "任意の質問")
    );
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId(SETUP_QUESTION_SUBMENU_ID)
    .setPlaceholder("操作を選んでください")
    .addOptions(options);

  return [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)];
}

export function buildAddQuestionModal(): ModalBuilder {
  const labelInput = new TextInputBuilder()
    .setCustomId(ADD_QUESTION_LABEL_INPUT_ID)
    .setLabel("質問テキスト")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("例：趣味は何ですか？")
    .setMaxLength(45)
    .setRequired(true);

  const requiredInput = new TextInputBuilder()
    .setCustomId(ADD_QUESTION_REQUIRED_INPUT_ID)
    .setLabel("必須にする？（yes / no）")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("yes")
    .setMaxLength(3)
    .setRequired(false);

  return new ModalBuilder()
    .setCustomId(ADD_QUESTION_MODAL_ID)
    .setTitle("質問を追加")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(labelInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(requiredInput)
    );
}

export function buildSetChannelModal(): ModalBuilder {
  const channelInput = new TextInputBuilder()
    .setCustomId(SET_CHANNEL_INPUT_ID)
    .setLabel("チャンネルID またはメンション")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("例：#intro-channel または 123456789012345678")
    .setRequired(true);

  return new ModalBuilder()
    .setCustomId(SET_CHANNEL_MODAL_ID)
    .setTitle("表示チャンネルを設定")
    .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(channelInput));
}

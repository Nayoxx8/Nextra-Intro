import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import type { GuildBasicSettingRecord, GuildQuestionRecord } from "../types.js";

export const ADD_QUESTION_BUTTON_ID = "nextra-intro:setup:add-q";
export const REMOVE_QUESTION_BUTTON_ID = "nextra-intro:setup:remove-q";
export const SET_CHANNEL_BUTTON_ID = "nextra-intro:setup:set-channel";
export const ADD_QUESTION_MODAL_ID = "nextra-intro:setup:add-q:modal";
export const ADD_QUESTION_LABEL_INPUT_ID = "nextra-intro:setup:add-q:label";
export const ADD_QUESTION_REQUIRED_INPUT_ID = "nextra-intro:setup:add-q:required";
export const SET_CHANNEL_MODAL_ID = "nextra-intro:setup:set-channel:modal";
export const SET_CHANNEL_INPUT_ID = "nextra-intro:setup:set-channel:input";
export const TOGGLE_NAME_BUTTON_ID = "nextra-intro:setup:toggle-name";
export const TOGGLE_AGE_BUTTON_ID = "nextra-intro:setup:toggle-age";
export const TOGGLE_GENDER_BUTTON_ID = "nextra-intro:setup:toggle-gender";

export function buildSetupEmbed(
  questions: GuildQuestionRecord[],
  displayChannelId: string | null,
  basic: GuildBasicSettingRecord
): EmbedBuilder {
  const channelText = displayChannelId ? `<#${displayChannelId}>` : "未設定";
  const questionLines =
    questions.length === 0
      ? "質問なし"
      : questions.map((q, i) => `**${i + 1}.** ${q.label}${q.required ? "（必須）" : "（任意）"}`).join("\n");

  const basicLines = [
    `名前: ${basic.nameEnabled ? "✅ ON" : "❌ OFF"}`,
    `年齢: ${basic.ageEnabled ? "✅ ON" : "❌ OFF"}`,
    `性別: ${basic.genderEnabled ? "✅ ON" : "❌ OFF"}`,
  ].join("　");

  return new EmbedBuilder()
    .setTitle("自己紹介 設定パネル")
    .setColor(0x5865f2)
    .addFields(
      { name: "表示チャンネル", value: channelText, inline: false },
      { name: "基礎質問", value: basicLines, inline: false },
      { name: `カスタム質問（${questions.length}/5）`, value: questionLines, inline: false }
    );
}

export function buildSetupComponents(
  questionCount: number,
  basic: GuildBasicSettingRecord
): ActionRowBuilder<ButtonBuilder>[] {
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(ADD_QUESTION_BUTTON_ID)
      .setLabel("質問を追加")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(questionCount >= 5),
    new ButtonBuilder()
      .setCustomId(REMOVE_QUESTION_BUTTON_ID)
      .setLabel("質問を削除")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(questionCount === 0),
    new ButtonBuilder()
      .setCustomId(SET_CHANNEL_BUTTON_ID)
      .setLabel("チャンネルを設定")
      .setStyle(ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(TOGGLE_NAME_BUTTON_ID)
      .setLabel(`名前: ${basic.nameEnabled ? "ON" : "OFF"}`)
      .setStyle(basic.nameEnabled ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(TOGGLE_AGE_BUTTON_ID)
      .setLabel(`年齢: ${basic.ageEnabled ? "ON" : "OFF"}`)
      .setStyle(basic.ageEnabled ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(TOGGLE_GENDER_BUTTON_ID)
      .setLabel(`性別: ${basic.genderEnabled ? "ON" : "OFF"}`)
      .setStyle(basic.genderEnabled ? ButtonStyle.Success : ButtonStyle.Secondary)
  );

  return [row1, row2];
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

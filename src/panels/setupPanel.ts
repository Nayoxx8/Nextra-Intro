import {
  ActionRowBuilder,
  EmbedBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import type { GuildBasicSettingRecord, GuildQuestionRecord } from "../types.js";

export const SETUP_SELECT_MENU_ID = "nextra-intro:setup:select";
export const ADD_QUESTION_MODAL_ID = "nextra-intro:setup:add-q:modal";
export const ADD_QUESTION_LABEL_INPUT_ID = "nextra-intro:setup:add-q:label";
export const ADD_QUESTION_REQUIRED_INPUT_ID = "nextra-intro:setup:add-q:required";
export const SET_CHANNEL_MODAL_ID = "nextra-intro:setup:set-channel:modal";
export const SET_CHANNEL_INPUT_ID = "nextra-intro:setup:set-channel:input";

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
): ActionRowBuilder<StringSelectMenuBuilder>[] {
  const options: StringSelectMenuOptionBuilder[] = [];

  if (questionCount < 5) {
    options.push(
      new StringSelectMenuOptionBuilder()
        .setValue("add-q")
        .setLabel("質問を追加")
        .setDescription(`カスタム質問を1件追加します（現在 ${questionCount}/5）`)
    );
  }

  if (questionCount > 0) {
    options.push(
      new StringSelectMenuOptionBuilder()
        .setValue("remove-q")
        .setLabel("質問を削除")
        .setDescription("最後のカスタム質問を削除します")
    );
  }

  options.push(
    new StringSelectMenuOptionBuilder()
      .setValue("set-channel")
      .setLabel("チャンネルを設定")
      .setDescription("自己紹介の表示先チャンネルを変更します"),
    new StringSelectMenuOptionBuilder()
      .setValue("toggle-name")
      .setLabel(`名前: ${basic.nameEnabled ? "ON → OFF に切替" : "OFF → ON に切替"}`)
      .setDescription("基礎質問「名前」のON/OFFを切り替えます"),
    new StringSelectMenuOptionBuilder()
      .setValue("toggle-age")
      .setLabel(`年齢: ${basic.ageEnabled ? "ON → OFF に切替" : "OFF → ON に切替"}`)
      .setDescription("基礎質問「年齢」のON/OFFを切り替えます"),
    new StringSelectMenuOptionBuilder()
      .setValue("toggle-gender")
      .setLabel(`性別: ${basic.genderEnabled ? "ON → OFF に切替" : "OFF → ON に切替"}`)
      .setDescription("基礎質問「性別」のON/OFFを切り替えます")
  );

  const menu = new StringSelectMenuBuilder()
    .setCustomId(SETUP_SELECT_MENU_ID)
    .setPlaceholder("設定項目を選んでください")
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

import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";

export const CREATE_INTRO_BUTTON_ID = "nextra-intro:user:create";
export const EDIT_INTRO_BUTTON_ID = "nextra-intro:user:edit";
export const BASIC_INTRO_BUTTON_ID = "nextra-intro:user:basic";
export const SELECT_BASIC_BUTTON_ID = "nextra-intro:user:select:basic";
export const SELECT_CUSTOM_BUTTON_ID = "nextra-intro:user:select:custom";

export function buildIntroPanelEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("自己紹介")
    .setColor(0x5865f2)
    .setDescription(
      "下のボタンを押して自己紹介を作成・編集してください。\n作成した自己紹介はこのチャンネルに画像として投稿されます。"
    );
}

export function buildIntroPanelComponents(disabled = false): ActionRowBuilder<ButtonBuilder>[] {
  const createBtn = new ButtonBuilder()
    .setCustomId(CREATE_INTRO_BUTTON_ID)
    .setLabel("自己紹介を作成")
    .setStyle(ButtonStyle.Primary)
    .setDisabled(disabled);

  const editBtn = new ButtonBuilder()
    .setCustomId(EDIT_INTRO_BUTTON_ID)
    .setLabel("修正する")
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(disabled);

  const basicBtn = new ButtonBuilder()
    .setCustomId(BASIC_INTRO_BUTTON_ID)
    .setLabel("基礎質問に回答する")
    .setStyle(ButtonStyle.Success)
    .setDisabled(disabled);

  return [new ActionRowBuilder<ButtonBuilder>().addComponents(createBtn, editBtn, basicBtn)];
}

export function buildSelectComponents(): ActionRowBuilder<ButtonBuilder>[] {
  const basicBtn = new ButtonBuilder()
    .setCustomId(SELECT_BASIC_BUTTON_ID)
    .setLabel("基礎質問")
    .setStyle(ButtonStyle.Success);

  const customBtn = new ButtonBuilder()
    .setCustomId(SELECT_CUSTOM_BUTTON_ID)
    .setLabel("追加質問")
    .setStyle(ButtonStyle.Primary);

  return [new ActionRowBuilder<ButtonBuilder>().addComponents(basicBtn, customBtn)];
}

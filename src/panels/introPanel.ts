import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";

export const CREATE_INTRO_BUTTON_ID = "nextra-intro:user:create";
export const EDIT_INTRO_BUTTON_ID = "nextra-intro:user:edit";

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

  return [new ActionRowBuilder<ButtonBuilder>().addComponents(createBtn, editBtn)];
}

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";
import type { GuildQuestionRecord } from "../types.js";

export const CREATE_INTRO_BUTTON_ID = "nexbase-intro:user:create";
export const EDIT_INTRO_BUTTON_ID = "nexbase-intro:user:edit";
export const EDIT_SELECT_MENU_ID = "nexbase-intro:user:edit:select";

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

export function buildEditSelectMenu(
  questions: GuildQuestionRecord[]
): ActionRowBuilder<StringSelectMenuBuilder>[] {
  if (questions.length === 0) return [];

  const options = questions.map((q) =>
    new StringSelectMenuOptionBuilder()
      .setLabel(q.label.slice(0, 100))
      .setValue(`custom:${q.orderIndex}`)
  );

  const menu = new StringSelectMenuBuilder()
    .setCustomId(EDIT_SELECT_MENU_ID)
    .setPlaceholder("編集する項目を選んでください")
    .addOptions(options)
    .setMinValues(1)
    .setMaxValues(1);

  return [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)];
}

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";
import type { GuildBasicSettingRecord, GuildQuestionRecord } from "../types.js";

export const CREATE_INTRO_BUTTON_ID = "nextra-intro:user:create";
export const EDIT_INTRO_BUTTON_ID = "nextra-intro:user:edit";
export const BASIC_INTRO_BUTTON_ID = "nextra-intro:user:basic";
export const SELECT_BASIC_BUTTON_ID = "nextra-intro:user:select:basic";
export const SELECT_CUSTOM_BUTTON_ID = "nextra-intro:user:select:custom";
export const EDIT_SELECT_MENU_ID = "nextra-intro:user:edit:select";

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

export function buildEditSelectMenu(
  basic: GuildBasicSettingRecord,
  questions: GuildQuestionRecord[]
): ActionRowBuilder<StringSelectMenuBuilder>[] {
  const options: StringSelectMenuOptionBuilder[] = [];

  if (basic.nameEnabled) {
    options.push(new StringSelectMenuOptionBuilder().setLabel("名前").setValue("basic:name"));
  }
  if (basic.ageEnabled) {
    options.push(new StringSelectMenuOptionBuilder().setLabel("年齢").setValue("basic:age"));
  }
  if (basic.genderEnabled) {
    options.push(new StringSelectMenuOptionBuilder().setLabel("性別").setValue("basic:gender"));
  }
  for (const q of questions) {
    options.push(
      new StringSelectMenuOptionBuilder()
        .setLabel(q.label.slice(0, 100))
        .setValue(`custom:${q.orderIndex}`)
    );
  }

  if (options.length === 0) return [];

  const menu = new StringSelectMenuBuilder()
    .setCustomId(EDIT_SELECT_MENU_ID)
    .setPlaceholder("編集する項目を選んでください")
    .addOptions(options)
    .setMinValues(1)
    .setMaxValues(1);

  return [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)];
}

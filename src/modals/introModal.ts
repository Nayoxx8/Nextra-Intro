import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import type { GuildBasicSettingRecord, GuildQuestionRecord } from "../types.js";

export const INTRO_MODAL_ID = "nextra-intro:user:modal";
export const BASIC_MODAL_ID = "nextra-intro:user:basic:modal";
export const EDIT_INPUT_ID = "nextra-intro:edit:input";

export function buildIntroModal(
  questions: GuildQuestionRecord[],
  existingAnswers: Record<string, string> = {}
): ModalBuilder {
  const modal = new ModalBuilder().setCustomId(INTRO_MODAL_ID).setTitle("自己紹介");

  for (const q of questions) {
    const input = new TextInputBuilder()
      .setCustomId(`nextra-intro:answer:${q.orderIndex}`)
      .setLabel(q.label)
      .setStyle(TextInputStyle.Short)
      .setMaxLength(100)
      .setRequired(q.required);

    const existing = existingAnswers[String(q.orderIndex)];
    if (existing) input.setValue(existing);

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
  }

  return modal;
}

export function buildBasicModal(
  basic: GuildBasicSettingRecord,
  existing: { basicName?: string | null; basicAge?: string | null; basicGender?: string | null } = {}
): ModalBuilder {
  const modal = new ModalBuilder().setCustomId(BASIC_MODAL_ID).setTitle("基礎質問");

  if (basic.nameEnabled) {
    const input = new TextInputBuilder()
      .setCustomId("nextra-intro:basic:name")
      .setLabel("名前")
      .setStyle(TextInputStyle.Short)
      .setMaxLength(50)
      .setRequired(false);
    if (existing.basicName) input.setValue(existing.basicName);
    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
  }

  if (basic.ageEnabled) {
    const input = new TextInputBuilder()
      .setCustomId("nextra-intro:basic:age")
      .setLabel("年齢")
      .setStyle(TextInputStyle.Short)
      .setMaxLength(10)
      .setRequired(false);
    if (existing.basicAge) input.setValue(existing.basicAge);
    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
  }

  if (basic.genderEnabled) {
    const input = new TextInputBuilder()
      .setCustomId("nextra-intro:basic:gender")
      .setLabel("性別")
      .setStyle(TextInputStyle.Short)
      .setMaxLength(20)
      .setRequired(false);
    if (existing.basicGender) input.setValue(existing.basicGender);
    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
  }

  return modal;
}

export function buildSingleBasicModal(
  field: "name" | "age" | "gender",
  currentValue: string | null | undefined
): ModalBuilder {
  const labels = { name: "名前", age: "年齢", gender: "性別" } as const;
  const maxLengths = { name: 50, age: 10, gender: 20 } as const;

  const modal = new ModalBuilder()
    .setCustomId(`nextra-intro:edit:basic:${field}`)
    .setTitle(`${labels[field]}を編集`);

  const input = new TextInputBuilder()
    .setCustomId(EDIT_INPUT_ID)
    .setLabel(labels[field])
    .setStyle(TextInputStyle.Short)
    .setMaxLength(maxLengths[field])
    .setRequired(false);
  if (currentValue) input.setValue(currentValue);

  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
  return modal;
}

export function buildSingleCustomModal(
  q: GuildQuestionRecord,
  currentAnswer: string | null | undefined
): ModalBuilder {
  const title = `${q.label}を編集`.slice(0, 45);

  const modal = new ModalBuilder()
    .setCustomId(`nextra-intro:edit:custom:${q.orderIndex}`)
    .setTitle(title);

  const input = new TextInputBuilder()
    .setCustomId(EDIT_INPUT_ID)
    .setLabel(q.label.slice(0, 45))
    .setStyle(TextInputStyle.Short)
    .setMaxLength(100)
    .setRequired(false);
  if (currentAnswer) input.setValue(currentAnswer);

  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
  return modal;
}

import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import type { GuildBasicSettingRecord, GuildQuestionRecord } from "../types.js";

export const INTRO_MODAL_ID = "nextra-intro:user:modal";
export const BASIC_MODAL_ID = "nextra-intro:user:basic:modal";

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

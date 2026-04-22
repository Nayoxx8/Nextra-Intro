import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import type { GuildQuestionRecord } from "../types.js";

export const INTRO_MODAL_ID = "nextra-intro:user:modal";

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

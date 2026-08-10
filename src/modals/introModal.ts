import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import type { GuildQuestionRecord } from "../types.js";

export const INTRO_MODAL_ID = "nexbase-intro:user:modal";
export const EDIT_INPUT_ID = "nexbase-intro:edit:input";

export function buildIntroModal(
  questions: GuildQuestionRecord[],
  existingAnswers: Record<string, string> = {}
): ModalBuilder {
  const modal = new ModalBuilder().setCustomId(INTRO_MODAL_ID).setTitle("自己紹介");

  for (const q of questions) {
    const input = new TextInputBuilder()
      .setCustomId(`nexbase-intro:answer:${q.orderIndex}`)
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

export function buildSingleCustomModal(
  q: GuildQuestionRecord,
  currentAnswer: string | null | undefined
): ModalBuilder {
  const title = `${q.label}を編集`.slice(0, 45);

  const modal = new ModalBuilder()
    .setCustomId(`nexbase-intro:edit:custom:${q.orderIndex}`)
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

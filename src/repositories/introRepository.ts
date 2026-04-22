import prisma from "../lib/prisma.js";
import type { GuildSettingRecord, GuildQuestionRecord, UserIntroRecord } from "../types.js";

export class IntroRepository {
  async getGuildSetting(guildId: string): Promise<GuildSettingRecord | null> {
    const row = await prisma.guildSetting.findUnique({ where: { guildId } });
    if (!row) return null;
    return {
      guildId: row.guildId,
      displayChannelId: row.displayChannelId,
      panelMessageId: row.panelMessageId,
    };
  }

  async upsertGuildSetting(record: Partial<GuildSettingRecord> & { guildId: string }): Promise<void> {
    await prisma.guildSetting.upsert({
      where: { guildId: record.guildId },
      create: {
        guildId: record.guildId,
        displayChannelId: record.displayChannelId ?? null,
        panelMessageId: record.panelMessageId ?? null,
      },
      update: {
        ...(record.displayChannelId !== undefined && { displayChannelId: record.displayChannelId }),
        ...(record.panelMessageId !== undefined && { panelMessageId: record.panelMessageId }),
      },
    });
  }

  async getQuestions(guildId: string): Promise<GuildQuestionRecord[]> {
    const rows = await prisma.guildQuestion.findMany({
      where: { guildId },
      orderBy: { orderIndex: "asc" },
    });
    return rows.map((r) => ({
      guildId: r.guildId,
      orderIndex: r.orderIndex,
      label: r.label,
      required: r.required,
    }));
  }

  async countQuestions(guildId: string): Promise<number> {
    return prisma.guildQuestion.count({ where: { guildId } });
  }

  async addQuestion(guildId: string, label: string, required: boolean): Promise<void> {
    const count = await this.countQuestions(guildId);
    if (count >= 5) throw new Error("question_limit_reached");
    await prisma.guildQuestion.create({
      data: { guildId, orderIndex: count, label, required },
    });
  }

  async deleteLastQuestion(guildId: string): Promise<void> {
    const questions = await this.getQuestions(guildId);
    if (questions.length === 0) return;
    const last = questions[questions.length - 1];
    await prisma.guildQuestion.delete({
      where: { guildId_orderIndex: { guildId, orderIndex: last.orderIndex } },
    });
  }

  async getUserIntro(guildId: string, userId: string): Promise<UserIntroRecord | null> {
    const row = await prisma.userIntro.findUnique({
      where: { guildId_userId: { guildId, userId } },
    });
    if (!row) return null;
    return {
      guildId: row.guildId,
      userId: row.userId,
      answers: row.answers as Record<string, string>,
      messageId: row.messageId,
    };
  }

  async saveUserIntro(
    guildId: string,
    userId: string,
    answers: Record<string, string>,
    messageId: string | null
  ): Promise<void> {
    await prisma.userIntro.upsert({
      where: { guildId_userId: { guildId, userId } },
      create: { guildId, userId, answers, messageId },
      update: { answers, messageId },
    });
  }
}

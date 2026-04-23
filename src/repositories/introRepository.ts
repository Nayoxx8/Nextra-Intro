import prisma from "../lib/prisma.js";
import type { GuildSettingRecord, GuildBasicSettingRecord, GuildQuestionRecord, UserIntroRecord } from "../types.js";

const CACHE_TTL = 60_000; // 60 seconds

type CacheEntry<T> = { value: T; expiresAt: number };

function fresh<T>(entry: CacheEntry<T> | undefined): entry is CacheEntry<T> {
  return !!entry && entry.expiresAt > Date.now();
}

function entry<T>(value: T): CacheEntry<T> {
  return { value, expiresAt: Date.now() + CACHE_TTL };
}

export class IntroRepository {
  private settingCache = new Map<string, CacheEntry<GuildSettingRecord | null>>();
  private basicCache = new Map<string, CacheEntry<GuildBasicSettingRecord>>();
  private questionsCache = new Map<string, CacheEntry<GuildQuestionRecord[]>>();

  // ── Guild settings ───────────────────────────────────────────────────────

  async getGuildSetting(guildId: string): Promise<GuildSettingRecord | null> {
    const cached = this.settingCache.get(guildId);
    if (fresh(cached)) return cached.value;
    const row = await prisma.guildSetting.findUnique({ where: { guildId } });
    const value = row
      ? { guildId: row.guildId, displayChannelId: row.displayChannelId, panelMessageId: row.panelMessageId }
      : null;
    this.settingCache.set(guildId, entry(value));
    return value;
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
    this.settingCache.delete(record.guildId);
  }

  // ── Basic settings ───────────────────────────────────────────────────────

  async getBasicSetting(guildId: string): Promise<GuildBasicSettingRecord> {
    const cached = this.basicCache.get(guildId);
    if (fresh(cached)) return cached.value;
    const row = await prisma.guildBasicSetting.findUnique({ where: { guildId } });
    const value: GuildBasicSettingRecord = {
      guildId,
      nameEnabled: row?.nameEnabled ?? true,
      ageEnabled: row?.ageEnabled ?? true,
      genderEnabled: row?.genderEnabled ?? true,
    };
    this.basicCache.set(guildId, entry(value));
    return value;
  }

  async toggleBasicField(
    guildId: string,
    field: "nameEnabled" | "ageEnabled" | "genderEnabled"
  ): Promise<GuildBasicSettingRecord> {
    const current = await this.getBasicSetting(guildId);
    const updated = { ...current, [field]: !current[field] };
    await prisma.guildBasicSetting.upsert({
      where: { guildId },
      create: { guildId, nameEnabled: updated.nameEnabled, ageEnabled: updated.ageEnabled, genderEnabled: updated.genderEnabled },
      update: { [field]: updated[field] },
    });
    this.basicCache.set(guildId, entry(updated));
    return updated;
  }

  // ── Questions ────────────────────────────────────────────────────────────

  async getQuestions(guildId: string): Promise<GuildQuestionRecord[]> {
    const cached = this.questionsCache.get(guildId);
    if (fresh(cached)) return cached.value;
    const rows = await prisma.guildQuestion.findMany({
      where: { guildId },
      orderBy: { orderIndex: "asc" },
    });
    const value = rows.map((r) => ({
      guildId: r.guildId,
      orderIndex: r.orderIndex,
      label: r.label,
      required: r.required,
    }));
    this.questionsCache.set(guildId, entry(value));
    return value;
  }

  async countQuestions(guildId: string): Promise<number> {
    return (await this.getQuestions(guildId)).length;
  }

  async addQuestion(guildId: string, label: string, required: boolean): Promise<void> {
    const count = await this.countQuestions(guildId);
    if (count >= 5) throw new Error("question_limit_reached");
    await prisma.guildQuestion.create({
      data: { guildId, orderIndex: count, label, required },
    });
    this.questionsCache.delete(guildId);
  }

  async deleteLastQuestion(guildId: string): Promise<void> {
    const questions = await this.getQuestions(guildId);
    if (questions.length === 0) return;
    const last = questions[questions.length - 1];
    await prisma.guildQuestion.delete({
      where: { guildId_orderIndex: { guildId, orderIndex: last.orderIndex } },
    });
    this.questionsCache.delete(guildId);
  }

  // ── User intros ──────────────────────────────────────────────────────────

  async getUserIntro(guildId: string, userId: string): Promise<UserIntroRecord | null> {
    const row = await prisma.userIntro.findUnique({
      where: { guildId_userId: { guildId, userId } },
    });
    if (!row) return null;
    return {
      guildId: row.guildId,
      userId: row.userId,
      answers: row.answers as Record<string, string>,
      basicName: row.basicName,
      basicAge: row.basicAge,
      basicGender: row.basicGender,
      messageId: row.messageId,
    };
  }

  async saveUserIntro(
    guildId: string,
    userId: string,
    data: {
      answers?: Record<string, string>;
      basicName?: string | null;
      basicAge?: string | null;
      basicGender?: string | null;
      messageId?: string | null;
    }
  ): Promise<void> {
    const existing = await this.getUserIntro(guildId, userId);
    const merged = {
      answers: data.answers ?? existing?.answers ?? {},
      basicName: data.basicName !== undefined ? data.basicName : (existing?.basicName ?? null),
      basicAge: data.basicAge !== undefined ? data.basicAge : (existing?.basicAge ?? null),
      basicGender: data.basicGender !== undefined ? data.basicGender : (existing?.basicGender ?? null),
      messageId: data.messageId !== undefined ? data.messageId : (existing?.messageId ?? null),
    };
    await prisma.userIntro.upsert({
      where: { guildId_userId: { guildId, userId } },
      create: { guildId, userId, ...merged },
      update: merged,
    });
  }
}

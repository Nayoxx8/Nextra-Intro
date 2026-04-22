import type { IntroRepository } from "./repositories/introRepository.js";

export type BotContext = {
  repo: IntroRepository;
};

export type GuildSettingRecord = {
  guildId: string;
  displayChannelId: string | null;
  panelMessageId: string | null;
};

export type GuildBasicSettingRecord = {
  guildId: string;
  nameEnabled: boolean;
  ageEnabled: boolean;
  genderEnabled: boolean;
};

export type GuildQuestionRecord = {
  guildId: string;
  orderIndex: number;
  label: string;
  required: boolean;
};

export type UserIntroRecord = {
  guildId: string;
  userId: string;
  answers: Record<string, string>;
  basicName: string | null;
  basicAge: string | null;
  basicGender: string | null;
  messageId: string | null;
};

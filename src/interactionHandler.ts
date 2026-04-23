import { Events, MessageFlags, type Client, type TextChannel } from "discord.js";
import type { BotContext } from "./types.js";
import { executeIntroSetup } from "./commands/introSetup.js";
import { executeIntroPanel } from "./commands/introPanel.js";
import {
  ADD_QUESTION_BUTTON_ID,
  REMOVE_QUESTION_BUTTON_ID,
  SET_CHANNEL_BUTTON_ID,
  TOGGLE_NAME_BUTTON_ID,
  TOGGLE_AGE_BUTTON_ID,
  TOGGLE_GENDER_BUTTON_ID,
  ADD_QUESTION_MODAL_ID,
  ADD_QUESTION_LABEL_INPUT_ID,
  ADD_QUESTION_REQUIRED_INPUT_ID,
  SET_CHANNEL_MODAL_ID,
  SET_CHANNEL_INPUT_ID,
  buildSetupEmbed,
  buildSetupComponents,
  buildAddQuestionModal,
  buildSetChannelModal,
} from "./panels/setupPanel.js";
import {
  CREATE_INTRO_BUTTON_ID,
  EDIT_INTRO_BUTTON_ID,
  BASIC_INTRO_BUTTON_ID,
  SELECT_BASIC_BUTTON_ID,
  SELECT_CUSTOM_BUTTON_ID,
  EDIT_SELECT_MENU_ID,
  buildIntroPanelComponents,
  buildSelectComponents,
  buildEditSelectMenu,
} from "./panels/introPanel.js";
import {
  INTRO_MODAL_ID,
  BASIC_MODAL_ID,
  buildIntroModal,
  buildBasicModal,
  buildSingleBasicModal,
  buildSingleCustomModal,
} from "./modals/introModal.js";
import { handleIntroSubmit, handleBasicSubmit, handleSingleFieldEdit } from "./services/introService.js";

export function registerInteractionHandler(client: Client, context: BotContext): void {
  client.on(Events.InteractionCreate, async (interaction) => {
    const guildId = interaction.guildId;
    if (!guildId) return;

    try {
      // ── Slash commands ──────────────────────────────────────────────────
      if (interaction.isChatInputCommand()) {
        if (interaction.commandName === "自己紹介設定") {
          await executeIntroSetup(interaction, context);
        } else if (interaction.commandName === "自己紹介パネル") {
          await executeIntroPanel(interaction, context);
        }
        return;
      }

      // ── Buttons ─────────────────────────────────────────────────────────
      if (interaction.isButton()) {
        const { customId } = interaction;

        // Setup panel: add question
        if (customId === ADD_QUESTION_BUTTON_ID) {
          const count = await context.repo.countQuestions(guildId);
          if (count >= 5) {
            await interaction.reply({ content: "質問は最大5つまでです。", flags: MessageFlags.Ephemeral });
            return;
          }
          await interaction.showModal(buildAddQuestionModal());
          return;
        }

        // Setup panel: remove last question
        if (customId === REMOVE_QUESTION_BUTTON_ID) {
          await interaction.deferUpdate();
          await context.repo.deleteLastQuestion(guildId);
          const [questions, setting, basic] = await Promise.all([
            context.repo.getQuestions(guildId),
            context.repo.getGuildSetting(guildId),
            context.repo.getBasicSetting(guildId),
          ]);
          await interaction.editReply({
            embeds: [buildSetupEmbed(questions, setting?.displayChannelId ?? null, basic)],
            components: buildSetupComponents(questions.length, basic),
          });
          return;
        }

        // Setup panel: set channel
        if (customId === SET_CHANNEL_BUTTON_ID) {
          await interaction.showModal(buildSetChannelModal());
          return;
        }

        // Setup panel: toggle basic fields
        if (customId === TOGGLE_NAME_BUTTON_ID || customId === TOGGLE_AGE_BUTTON_ID || customId === TOGGLE_GENDER_BUTTON_ID) {
          await interaction.deferUpdate();
          const fieldMap = {
            [TOGGLE_NAME_BUTTON_ID]: "nameEnabled",
            [TOGGLE_AGE_BUTTON_ID]: "ageEnabled",
            [TOGGLE_GENDER_BUTTON_ID]: "genderEnabled",
          } as const;
          const basic = await context.repo.toggleBasicField(guildId, fieldMap[customId]);
          const [questions, setting] = await Promise.all([
            context.repo.getQuestions(guildId),
            context.repo.getGuildSetting(guildId),
          ]);
          await interaction.editReply({
            embeds: [buildSetupEmbed(questions, setting?.displayChannelId ?? null, basic)],
            components: buildSetupComponents(questions.length, basic),
          });
          return;
        }

        // Intro panel: create → smart routing
        if (customId === CREATE_INTRO_BUTTON_ID) {
          const [basic, questions] = await Promise.all([
            context.repo.getBasicSetting(guildId),
            context.repo.getQuestions(guildId),
          ]);
          const anyBasic = basic.nameEnabled || basic.ageEnabled || basic.genderEnabled;
          const anyCustom = questions.length > 0;

          if (!anyBasic && !anyCustom) {
            await interaction.reply({ content: "サーバーに自己紹介の質問が設定されていません。", flags: MessageFlags.Ephemeral });
            return;
          }

          const existing = await context.repo.getUserIntro(guildId, interaction.user.id);

          if (anyBasic && !anyCustom) {
            await interaction.showModal(buildBasicModal(basic, existing ?? {}));
            return;
          }
          if (!anyBasic && anyCustom) {
            await interaction.showModal(buildIntroModal(questions, existing?.answers ?? {}));
            return;
          }
          // Both exist → show selection
          await interaction.reply({
            content: "どちらに回答しますか？",
            components: buildSelectComponents(),
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        // Intro panel: edit → show select menu of all configured fields
        if (customId === EDIT_INTRO_BUTTON_ID) {
          const [basic, questions] = await Promise.all([
            context.repo.getBasicSetting(guildId),
            context.repo.getQuestions(guildId),
          ]);
          const editComponents = buildEditSelectMenu(basic, questions);
          if (editComponents.length === 0) {
            await interaction.reply({ content: "サーバーに自己紹介の質問が設定されていません。", flags: MessageFlags.Ephemeral });
            return;
          }
          await interaction.reply({
            content: "編集する項目を選んでください。",
            components: editComponents,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        // Selection: basic
        if (customId === SELECT_BASIC_BUTTON_ID) {
          const basic = await context.repo.getBasicSetting(guildId);
          const anyEnabled = basic.nameEnabled || basic.ageEnabled || basic.genderEnabled;
          if (!anyEnabled) {
            await interaction.reply({ content: "基礎質問は現在すべてオフです。", flags: MessageFlags.Ephemeral });
            return;
          }
          const existing = await context.repo.getUserIntro(guildId, interaction.user.id);
          await interaction.showModal(buildBasicModal(basic, existing ?? {}));
          return;
        }

        // Selection: custom questions
        if (customId === SELECT_CUSTOM_BUTTON_ID) {
          const questions = await context.repo.getQuestions(guildId);
          if (questions.length === 0) {
            await interaction.reply({ content: "管理者が追加質問をまだ設定していません。", flags: MessageFlags.Ephemeral });
            return;
          }
          const existing = await context.repo.getUserIntro(guildId, interaction.user.id);
          await interaction.showModal(buildIntroModal(questions, existing?.answers ?? {}));
          return;
        }

        // Intro panel: basic questions (direct shortcut)
        if (customId === BASIC_INTRO_BUTTON_ID) {
          const basic = await context.repo.getBasicSetting(guildId);
          const anyEnabled = basic.nameEnabled || basic.ageEnabled || basic.genderEnabled;
          if (!anyEnabled) {
            await interaction.reply({ content: "基礎質問は現在すべてオフです。", flags: MessageFlags.Ephemeral });
            return;
          }
          const existing = await context.repo.getUserIntro(guildId, interaction.user.id);
          await interaction.showModal(buildBasicModal(basic, existing ?? {}));
          return;
        }

        return;
      }

      // ── Select menus ─────────────────────────────────────────────────────
      if (interaction.isStringSelectMenu()) {
        const { customId } = interaction;

        if (customId === EDIT_SELECT_MENU_ID) {
          const value = interaction.values[0]; // "basic:name" | "basic:age" | "basic:gender" | "custom:0"
          const colonIdx = value.indexOf(":");
          const editType = value.slice(0, colonIdx);
          const fieldOrIndex = value.slice(colonIdx + 1);

          const existing = await context.repo.getUserIntro(guildId, interaction.user.id);

          if (editType === "basic") {
            const field = fieldOrIndex as "name" | "age" | "gender";
            const current = field === "name" ? existing?.basicName : field === "age" ? existing?.basicAge : existing?.basicGender;
            await interaction.showModal(buildSingleBasicModal(field, current));
          } else {
            const orderIndex = parseInt(fieldOrIndex, 10);
            const questions = await context.repo.getQuestions(guildId);
            const q = questions.find((q) => q.orderIndex === orderIndex);
            if (!q) return;
            const currentAnswer = (existing?.answers ?? {})[String(orderIndex)];
            await interaction.showModal(buildSingleCustomModal(q, currentAnswer));
          }
          return;
        }

        return;
      }

      // ── Modals ───────────────────────────────────────────────────────────
      if (interaction.isModalSubmit()) {
        const { customId } = interaction;

        if (customId === ADD_QUESTION_MODAL_ID) {
          await interaction.deferUpdate();
          const label = interaction.fields.getTextInputValue(ADD_QUESTION_LABEL_INPUT_ID).trim();
          const requiredRaw = interaction.fields
            .getTextInputValue(ADD_QUESTION_REQUIRED_INPUT_ID)
            .trim()
            .toLowerCase();
          const required = requiredRaw !== "no" && requiredRaw !== "n";
          try {
            await context.repo.addQuestion(guildId, label, required);
          } catch { /* at limit */ }
          const [questions, setting, basic] = await Promise.all([
            context.repo.getQuestions(guildId),
            context.repo.getGuildSetting(guildId),
            context.repo.getBasicSetting(guildId),
          ]);
          await interaction.editReply({
            embeds: [buildSetupEmbed(questions, setting?.displayChannelId ?? null, basic)],
            components: buildSetupComponents(questions.length, basic),
          });
          return;
        }

        if (customId === SET_CHANNEL_MODAL_ID) {
          await interaction.deferUpdate();
          const raw = interaction.fields.getTextInputValue(SET_CHANNEL_INPUT_ID).trim();
          const channelId = raw.replace(/^<#(\d+)>$/, "$1").trim();
          const channel = await interaction.client.channels.fetch(channelId).catch(() => null);
          if (!channel || !channel.isTextBased() || channel.isDMBased()) {
            await interaction.followUp({ content: "有効なテキストチャンネルのIDを入力してください。", flags: MessageFlags.Ephemeral });
            return;
          }
          await context.repo.upsertGuildSetting({ guildId, displayChannelId: channelId });
          const [questions, setting, basic] = await Promise.all([
            context.repo.getQuestions(guildId),
            context.repo.getGuildSetting(guildId),
            context.repo.getBasicSetting(guildId),
          ]);
          await interaction.editReply({
            embeds: [buildSetupEmbed(questions, setting?.displayChannelId ?? null, basic)],
            components: buildSetupComponents(questions.length, basic),
          });
          return;
        }

        if (customId === INTRO_MODAL_ID) {
          const questions = await context.repo.getQuestions(guildId);
          await handleIntroSubmit(interaction, context, questions);
          return;
        }

        if (customId === BASIC_MODAL_ID) {
          await handleBasicSubmit(interaction, context);
          return;
        }

        // Single-field edit modals
        if (customId.startsWith("nextra-intro:edit:")) {
          await handleSingleFieldEdit(interaction, context);
          return;
        }

        return;
      }
    } catch (err) {
      console.error("[interactionHandler] unhandled error:", err);
      try {
        const errMsg = { content: "エラーが発生しました。しばらくしてから再試行してください。", ephemeral: true };
        if (interaction.isRepliable()) {
          if (interaction.deferred || interaction.replied) {
            await interaction.followUp(errMsg);
          } else {
            await interaction.reply(errMsg);
          }
        }
      } catch { /* ignore */ }
    }
  });
}

import { Events, MessageFlags, type Client, type TextChannel } from "discord.js";
import type { BotContext } from "./types.js";
import { executeIntroSetup } from "./commands/introSetup.js";
import { executeIntroPanel } from "./commands/introPanel.js";
import {
  SETUP_SELECT_MENU_ID,
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

        // Intro panel: create → smart routing
        if (customId === CREATE_INTRO_BUTTON_ID) {
          // 2 parallel queries only; showModal cannot follow deferReply
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
          if (anyBasic && !anyCustom) {
            await interaction.showModal(buildBasicModal(basic, {}));
            return;
          }
          if (!anyBasic && anyCustom) {
            await interaction.showModal(buildIntroModal(questions, {}));
            return;
          }
          await interaction.reply({
            content: "どちらに回答しますか？",
            components: buildSelectComponents(),
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        // Intro panel: edit → show select menu (deferReply safe: never calls showModal)
        if (customId === EDIT_INTRO_BUTTON_ID) {
          await interaction.deferReply({ flags: MessageFlags.Ephemeral });
          const [basic, questions] = await Promise.all([
            context.repo.getBasicSetting(guildId),
            context.repo.getQuestions(guildId),
          ]);
          const editComponents = buildEditSelectMenu(basic, questions);
          if (editComponents.length === 0) {
            await interaction.editReply({ content: "サーバーに自己紹介の質問が設定されていません。" });
            return;
          }
          await interaction.editReply({
            content: "編集する項目を選んでください。",
            components: editComponents,
          });
          return;
        }

        // Selection: basic (shown when both basic + custom exist after CREATE)
        if (customId === SELECT_BASIC_BUTTON_ID) {
          // Fetch both in parallel to stay within 3s window
          const [basic, existing] = await Promise.all([
            context.repo.getBasicSetting(guildId),
            context.repo.getUserIntro(guildId, interaction.user.id),
          ]);
          const anyEnabled = basic.nameEnabled || basic.ageEnabled || basic.genderEnabled;
          if (!anyEnabled) {
            await interaction.reply({ content: "基礎質問は現在すべてオフです。", flags: MessageFlags.Ephemeral });
            return;
          }
          await interaction.showModal(buildBasicModal(basic, existing ?? {}));
          return;
        }

        // Selection: custom questions
        if (customId === SELECT_CUSTOM_BUTTON_ID) {
          // Fetch both in parallel to stay within 3s window
          const [questions, existing] = await Promise.all([
            context.repo.getQuestions(guildId),
            context.repo.getUserIntro(guildId, interaction.user.id),
          ]);
          if (questions.length === 0) {
            await interaction.reply({ content: "管理者が追加質問をまだ設定していません。", flags: MessageFlags.Ephemeral });
            return;
          }
          await interaction.showModal(buildIntroModal(questions, existing?.answers ?? {}));
          return;
        }

        // Intro panel: basic questions (direct shortcut)
        if (customId === BASIC_INTRO_BUTTON_ID) {
          // Fetch both in parallel to stay within 3s window
          const [basic, existing] = await Promise.all([
            context.repo.getBasicSetting(guildId),
            context.repo.getUserIntro(guildId, interaction.user.id),
          ]);
          const anyEnabled = basic.nameEnabled || basic.ageEnabled || basic.genderEnabled;
          if (!anyEnabled) {
            await interaction.reply({ content: "基礎質問は現在すべてオフです。", flags: MessageFlags.Ephemeral });
            return;
          }
          await interaction.showModal(buildBasicModal(basic, existing ?? {}));
          return;
        }

        return;
      }

      // ── Select menus ─────────────────────────────────────────────────────
      if (interaction.isStringSelectMenu()) {
        const { customId } = interaction;

        // Setup panel select menu
        if (customId === SETUP_SELECT_MENU_ID) {
          const value = interaction.values[0];

          // These values trigger a modal (must be first response — no deferUpdate)
          if (value === "add-q") {
            const count = await context.repo.countQuestions(guildId);
            if (count >= 5) {
              await interaction.reply({ content: "質問は最大5つまでです。", flags: MessageFlags.Ephemeral });
              return;
            }
            await interaction.showModal(buildAddQuestionModal());
            return;
          }

          if (value === "set-channel") {
            await interaction.showModal(buildSetChannelModal());
            return;
          }

          // Remaining values are immediate updates
          await interaction.deferUpdate();

          if (value === "remove-q") {
            await context.repo.deleteLastQuestion(guildId);
          } else if (value === "toggle-name") {
            await context.repo.toggleBasicField(guildId, "nameEnabled");
          } else if (value === "toggle-age") {
            await context.repo.toggleBasicField(guildId, "ageEnabled");
          } else if (value === "toggle-gender") {
            await context.repo.toggleBasicField(guildId, "genderEnabled");
          }

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

        if (customId === EDIT_SELECT_MENU_ID) {
          const value = interaction.values[0]; // "basic:name" | "basic:age" | "basic:gender" | "custom:0"
          const colonIdx = value.indexOf(":");
          const editType = value.slice(0, colonIdx);
          const fieldOrIndex = value.slice(colonIdx + 1);

          // Fetch both in parallel to stay within 3s interaction window
          const [existing, questions] = await Promise.all([
            context.repo.getUserIntro(guildId, interaction.user.id),
            context.repo.getQuestions(guildId),
          ]);

          if (editType === "basic") {
            const field = fieldOrIndex as "name" | "age" | "gender";
            const current =
              field === "name" ? existing?.basicName
              : field === "age" ? existing?.basicAge
              : existing?.basicGender;
            await interaction.showModal(buildSingleBasicModal(field, current));
          } else {
            const orderIndex = parseInt(fieldOrIndex, 10);
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
        const errMsg = { content: "エラーが発生しました。しばらくしてから再試行してください。", flags: MessageFlags.Ephemeral } as const;
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

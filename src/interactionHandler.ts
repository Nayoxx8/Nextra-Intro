import { Events, MessageFlags, type Client, type TextChannel } from "discord.js";
import type { BotContext } from "./types.js";
import { executeIntroSetup } from "./commands/introSetup.js";
import { executeIntroPanel } from "./commands/introPanel.js";
import {
  SETUP_SELECT_MENU_ID,
  SETUP_QUESTION_SUBMENU_ID,
  ADD_QUESTION_MODAL_ID,
  ADD_QUESTION_LABEL_INPUT_ID,
  ADD_QUESTION_REQUIRED_INPUT_ID,
  SET_CHANNEL_MODAL_ID,
  SET_CHANNEL_INPUT_ID,
  buildSetupEmbed,
  buildSetupComponents,
  buildQuestionSubMenu,
  buildAddQuestionModal,
  buildSetChannelModal,
} from "./panels/setupPanel.js";
import {
  CREATE_INTRO_BUTTON_ID,
  EDIT_INTRO_BUTTON_ID,
  EDIT_SELECT_MENU_ID,
  buildIntroPanelComponents,
  buildEditSelectMenu,
} from "./panels/introPanel.js";
import {
  INTRO_MODAL_ID,
  buildIntroModal,
  buildSingleCustomModal,
} from "./modals/introModal.js";
import { handleIntroSubmit, handleSingleFieldEdit } from "./services/introService.js";
import { checkSubscription } from "./lib/subscriptionGuard.js";

export function registerInteractionHandler(client: Client, context: BotContext): void {
  client.on(Events.InteractionCreate, async (interaction) => {
    const guildId = interaction.guildId;
    if (!guildId) return;

    try {
      if (!(await checkSubscription(guildId, "Intro"))) {
        if (interaction.isRepliable()) {
          try { await interaction.reply({ content: "このBotはこのサーバーでご利用いただけません。ダッシュボードから購入・選択してください。", flags: MessageFlags.Ephemeral }); } catch { /* noop */ }
        }
        return;
      }

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

        if (customId === CREATE_INTRO_BUTTON_ID) {
          const questions = await context.repo.getQuestions(guildId);
          if (questions.length === 0) {
            await interaction.reply({ content: "サーバーに自己紹介の質問が設定されていません。", flags: MessageFlags.Ephemeral });
            return;
          }
          const existing = await context.repo.getUserIntro(guildId, interaction.user.id);
          await interaction.showModal(buildIntroModal(questions, existing?.answers ?? {}));
          return;
        }

        if (customId === EDIT_INTRO_BUTTON_ID) {
          await interaction.deferReply({ flags: MessageFlags.Ephemeral });
          const questions = await context.repo.getQuestions(guildId);
          const editComponents = buildEditSelectMenu(questions);
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

        return;
      }

      // ── Select menus ─────────────────────────────────────────────────────
      if (interaction.isStringSelectMenu()) {
        const { customId } = interaction;

        if (customId === SETUP_SELECT_MENU_ID) {
          const value = interaction.values[0];

          if (value === "set-channel") {
            await interaction.showModal(buildSetChannelModal());
            return;
          }

          await interaction.deferUpdate();

          if (value === "edit-questions") {
            const questions = await context.repo.getQuestions(guildId);
            await interaction.editReply({ components: buildQuestionSubMenu(questions) });
            return;
          }

          const [questions, setting] = await Promise.all([
            context.repo.getQuestions(guildId),
            context.repo.getGuildSetting(guildId),
          ]);
          await interaction.editReply({
            embeds: [buildSetupEmbed(questions, setting?.displayChannelId ?? null)],
            components: buildSetupComponents(questions.length),
          });
          return;
        }

        if (customId === SETUP_QUESTION_SUBMENU_ID) {
          const value = interaction.values[0];

          if (value === "q-add") {
            const count = await context.repo.countQuestions(guildId);
            if (count >= 5) {
              await interaction.reply({ content: "質問は最大5つまでです。", flags: MessageFlags.Ephemeral });
              return;
            }
            await interaction.showModal(buildAddQuestionModal());
            return;
          }

          await interaction.deferUpdate();

          if (value === "q-back") {
            const [questions, setting] = await Promise.all([
              context.repo.getQuestions(guildId),
              context.repo.getGuildSetting(guildId),
            ]);
            await interaction.editReply({
              embeds: [buildSetupEmbed(questions, setting?.displayChannelId ?? null)],
              components: buildSetupComponents(questions.length),
            });
            return;
          }

          if (value.startsWith("q-del:")) {
            const orderIndex = parseInt(value.slice(6), 10);
            await context.repo.deleteQuestion(guildId, orderIndex);
          }

          const [questions, setting] = await Promise.all([
            context.repo.getQuestions(guildId),
            context.repo.getGuildSetting(guildId),
          ]);
          await interaction.editReply({
            embeds: [buildSetupEmbed(questions, setting?.displayChannelId ?? null)],
            components: buildSetupComponents(questions.length),
          });
          return;
        }

        if (customId === EDIT_SELECT_MENU_ID) {
          const value = interaction.values[0]; // "custom:0"
          const orderIndex = parseInt(value.slice("custom:".length), 10);

          const [existing, questions] = await Promise.all([
            context.repo.getUserIntro(guildId, interaction.user.id),
            context.repo.getQuestions(guildId),
          ]);

          const q = questions.find((q) => q.orderIndex === orderIndex);
          if (!q) return;
          const currentAnswer = (existing?.answers ?? {})[String(orderIndex)];
          await interaction.showModal(buildSingleCustomModal(q, currentAnswer));
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
          const [questions, setting] = await Promise.all([
            context.repo.getQuestions(guildId),
            context.repo.getGuildSetting(guildId),
          ]);
          await interaction.editReply({
            embeds: [buildSetupEmbed(questions, setting?.displayChannelId ?? null)],
            components: buildSetupComponents(questions.length),
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
          const [questions, setting] = await Promise.all([
            context.repo.getQuestions(guildId),
            context.repo.getGuildSetting(guildId),
          ]);
          await interaction.editReply({
            embeds: [buildSetupEmbed(questions, setting?.displayChannelId ?? null)],
            components: buildSetupComponents(questions.length),
          });
          return;
        }

        if (customId === INTRO_MODAL_ID) {
          const questions = await context.repo.getQuestions(guildId);
          await handleIntroSubmit(interaction, context, questions);
          return;
        }

        if (customId.startsWith("nexbase-intro:edit:custom:")) {
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

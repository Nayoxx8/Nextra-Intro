# Nextra-Intro

## 役割

**画像ベース自己紹介Bot。**  
ギルドごとにカスタマイズ可能な設問を設定し、メンバーが回答すると **`@napi-rs/canvas` で画像カードを生成** してチャンネルに投稿する。

---

## 起動・開発コマンド

```bash
npm run dev       # tsx watch（ホットリロード）
npm run build     # prisma generate + tsc + assets コピー
npm run start     # prisma db push → node dist/index.js（本番）
npm run db:generate  # Prisma クライアント生成
npm run db:push      # DB スキーマを適用
```

---

## 環境変数（`.env`）

```
DISCORD_TOKEN=
DATABASE_URL=      # PostgreSQL 接続文字列（nextra_intro スキーマ）
```

---

## ファイル構成

```
src/
├── index.ts               # エントリポイント・Client 初期化
├── config.ts              # 環境変数バリデーション（zod）
├── types.ts               # 共通型定義
├── interactionHandler.ts  # インタラクション振り分け
├── registerCommands.ts    # スラッシュコマンド登録（clientReady）
├── voiceHandler.ts        # VC イベント処理
├── commands/
│   ├── introPanel.ts      # /intro_panel コマンド（パネル設置）
│   └── introSetup.ts      # /intro_setup コマンド（設問設定）
├── modals/
│   └── introModal.ts      # 自己紹介入力モーダル定義
├── panels/
│   ├── introPanel.ts      # パネル Embed / Button 生成
│   └── setupPanel.ts      # セットアップ Embed / UI 生成
├── repositories/
│   └── introRepository.ts # DB 操作（GuildSetting, GuildQuestion, UserIntro）
├── services/
│   ├── imageService.ts    # canvas で自己紹介カード画像生成
│   └── introService.ts    # 自己紹介の保存・更新ロジック
└── lib/
    ├── prisma.ts          # Prisma クライアント シングルトン
    └── subscriptionGuard.ts # サブスクリプション認証
prisma/
└── schema.prisma          # DB スキーマ（nextra_intro スキーマ）
```

---

## DBスキーマ（Prisma・スキーマ名: `nextra_intro`）

```
GuildSetting         # パネル設置先チャンネル・メッセージID
  - guildId（PK）, displayChannelId, panelMessageId

GuildBasicSetting    # 基本項目の表示ON/OFF
  - guildId（PK）, nameEnabled, ageEnabled, genderEnabled

GuildQuestion        # カスタム設問（ギルド × orderIndex で一意）
  - guildId, orderIndex, label, required

UserIntro            # ユーザーの回答
  - guildId, userId（複合PK）
  - answers（JSON）, basicName, basicAge, basicGender, messageId
```

---

## コマンド一覧

| コマンド | 説明 | 権限 |
|---------|------|------|
| `/intro_setup` | 自己紹介の設問・表示チャンネルを設定するセットアップパネルを起動 | ManageGuild |
| `/intro_panel` | 自己紹介ボタンパネルを設置 | ManageGuild |

---

## 自己紹介フロー

```
1. 管理者が /intro_setup → 設問・基本項目・表示チャンネルを設定
2. 管理者が /intro_panel → チャンネルに「自己紹介する」ボタンを設置
3. ユーザーがボタンをクリック → Modal（入力フォーム）を表示
4. モーダル送信 → introService が回答を保存
5. imageService が @napi-rs/canvas で画像カードを生成（PNG バッファ）
6. 設定済みの displayChannel に画像を投稿（既存投稿は更新）
```

---

## 画像生成（`src/services/imageService.ts`）

- `@napi-rs/canvas` でカードサイズのキャンバスを生成
- 名前・年齢・性別（基本項目）+ カスタム設問の回答を描画
- アセット（フォント・背景）は `src/assets/` に配置し、ビルド時に `dist/assets/` へコピー

---

## subscriptionGuard

```ts
checkSubscription(guildId, 'Intro')
```
未契約サーバーのインタラクションは全て弾く。

---

## 実装上の注意点

- `GuildQuestion` は `orderIndex` で順序管理。設問変更時は既存ユーザーの `answers` に影響する可能性あり
- `UserIntro.answers` は JSON 型（`Record<orderIndex, string>`）で柔軟に回答を保持
- 既投稿の自己紹介は `messageId` を保持し、メッセージ編集で更新（新規投稿はしない）
- `zod` は `config.ts` での環境変数バリデーションに使用

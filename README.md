# Mastra Chat LLM - ランニングルート推薦システム

Mastra フレームワークと OpenAI LLM を使用したインテリジェントなランニングルート推薦システムです。自然言語でのユーザー入力を解析し、Strava API から最適なセグメントを提案します。

## 🚀 機能

- **自然言語での検索**: 「高尾山の北側エリアで走行距離 20km、累積標高 500m くらいのトレイルランニングのルートを探してほしい」など自由な表現で検索
- **LLM 解析**: OpenAI GPT がユーザーの入力を構造化データに変換
- **Strava API 統合**: 実際の Strava セグメントデータから候補を取得
- **インテリジェントなフィルタリング**: 距離・標高・勾配による複合スコアリング
- **エリア分割検索**: 広範囲を複数タイルに分けて効率的に検索
- **モック対応**: Strava アクセストークンなしでもサンプルデータで動作

## 📁 プロジェクト構成

```
mastra-chat-llm/
├── src/
│   └── mastra/
│       ├── index.ts                 # Mastraアプリケーションのエントリーポイント
│       ├── agents/
│       │   └── recommend-agent.ts   # ルート推薦エージェント
│       ├── lib/
│       │   ├── llm.ts               # OpenAI LLMクライアント設定
│       │   └── score.ts             # セグメントスコアリング関数
│       └── tools/
│           ├── parseQuery.ts        # 自然言語解析ツール
│           ├── stravaExplore.ts     # Strava API連携ツール
│           ├── summarize.ts         # 結果要約ツール
│           └── tileBounds.ts        # エリア分割ツール
├── mock/
│   └── explorer.sample.json         # モックセグメントデータ
├── package.json
├── tsconfig.json
└── README.md
```

## ⚙️ セットアップ

### 前提条件

- Node.js 18+
- pnpm（推奨）または npm

### インストール

```bash
# リポジトリをクローン
git clone <repository-url>
cd mastra-chat-llm

# 依存関係をインストール
pnpm install

# 環境変数ファイルを作成
cp .env.example .env
```

### 環境変数設定

`.env`ファイルに以下を設定してください：

```bash
# 必須: OpenAI API キー
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxx

# オプション: Strava アクセストークン（なしでもモックデータで動作）
STRAVA_ACCESS_TOKEN=your_strava_token
```

## 🏃‍♂️ 起動方法

```bash
# 開発サーバーを起動
pnpm dev
```

起動後、Mastra の内蔵 UI にアクセスできます：

- **Playground UI**: http://localhost:4111/

## 💡 使用例

Playground UI で以下のような自然な表現で検索できます：

- 「高尾山の北側エリアで走行距離 20km、累積標高 500m くらいのトレイルランニングのルートを探してほしい」
- 「陣馬山あたりでトレイルランニングしたい」

システムが自動的に：

1. 自然言語を解析してパラメータを抽出
2. 不足情報があれば追加質問
3. Strava API からセグメントを検索
4. 条件に合う候補をスコアリング
5. 最適な推薦とコメントを生成

## 🛠️ 技術スタック

### フレームワーク・ライブラリ

- **Mastra**: AI エージェントフレームワーク
- **@ai-sdk/openai**: OpenAI 統合
- **Zod**: スキーマバリデーション
- **node-fetch**: HTTP クライアント
- **TypeScript**: 型安全性

### AI・API

- **OpenAI GPT-3.5-turbo**: 自然言語処理
- **Strava API**: セグメントデータ取得

## 🔧 主要コンポーネント

### エージェント (`recommend-agent.ts`)

- ユーザーとの会話を管理
- 複数ツールを組み合わせてルート推薦を実行

### ツール詳細

#### `parseQuery`

- 自然言語入力を構造化データに変換
- 位置情報（bounds）、距離、標高を抽出

#### `stravaExplore`

- Strava Explore API 経由でセグメント取得
- トークン未設定時はモックデータを使用

#### `tileBounds`

- 広範囲検索を複数タイルに分割
- API 制限回避と検索効率向上

#### `summarize`

- 候補リストから最適な 1 つを選定
- わかりやすい日本語コメント生成

### スコアリングシステム (`score.ts`)

```typescript
// 距離、標高、勾配の複合スコア
score = 0.6 * 距離スコア + 0.3 * 標高スコア + 0.1 * 勾配ボーナス;
```

## 📊 データフロー

1. **ユーザー入力** → 自然言語（例：「10km で上り 300m」）
2. **parseQuery** → 構造化データ（`{distanceM: 10000, elevM: 300, bounds: [...]}` ）
3. **tileBounds** → エリア分割（必要に応じて）
4. **stravaExplore** → セグメント取得（複数タイル並列実行）
5. **score.filterAndScore** → 条件フィルタリング＋スコアリング
6. **summarize** → 最終推薦の生成

## 🔍 開発とデバッグ

### ログ出力

主要ツールには console.log が仕込まれているため、実行時の状況を確認できます。

### モックデータ

`mock/explorer.sample.json`を編集することで、Strava アクセストークンなしでもテストデータを調整できます。

### コマンド

```bash
# 開発サーバー
pnpm dev

# ビルド
pnpm build

# 型チェック
pnpm type-check  # (要設定)
```

## 🚨 制限事項

- **累積標高の近似**: Strava Explore API の`elev_difference`は累積標高の近似値
- **検索範囲**: 1 回の API 呼び出しで取得できるセグメント数に制限あり
- **API 制限**: Strava API のレート制限に注意
- **座標系**: 緯度経度は日本国内を想定

## 🤝 貢献

プルリクエストやイシューを歓迎します。大きな変更を行う前に、まずイシューで議論していただけると助かります。

## 📝 ライセンス

ISC

---

**Note**: このプロジェクトは学習・実験目的で作成されています。商用利用の際は適切な API 制限やエラーハンドリングの追加を推奨します。

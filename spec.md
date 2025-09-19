# Mastra Chat MVP — LLM 統合・pnpm 構成（公式テンプレ準拠）

> **このままコピペで最小リポが作れる“ZIP 相当”です。**
>
> - `pnpm create mastra@latest my-mastra-app` の構成に準拠
> - **Express なし**（Mastra 内蔵サーバ）／**Playground（デフォチャット UI）**を使用
> - **LLM（OpenAI）**で「自然文 → パラメータ抽出」と「結果要約」を実装
> - **Strava OAuth なし**（`.env` の手貼りトークン or モック JSON）
> - 累積上昇は **`elev_difference` を近似値**として扱います

---

## 0. つくり方（最短手順）

```bash
# ひな型生成
pnpm create mastra@latest my-mastra-app
cd my-mastra-app

# 依存追加（LLM + Fetch + バリデーション）
pnpm add @ai-sdk/openai zod node-fetch dotenv

# このドキュメントのファイルを同じパスに作成/上書き
# （特に src/ 以下・mastra.config.ts・mock/ を配置）

# 環境変数
printf "OPENAI_API_KEY=
STRAVA_ACCESS_TOKEN=
" > .env

# 起動（Playgroundは http://localhost:4111/）
pnpm dev
```

---

## 1. ルート構成（ファイル一覧）

```
my-mastra-app/
├─ mastra.config.ts
├─ package.json
├─ tsconfig.json
├─ .env                # OPENAI_API_KEY=（必須）/ STRAVA_ACCESS_TOKEN=（任意）
├─ mock/
│  └─ explorer.sample.json
└─ src/
   ├─ index.ts
   ├─ agent.ts
   ├─ llm.ts
   ├─ score.ts
   ├─ tools/
   │  ├─ parseQuery.ts
   │  ├─ summarize.ts
   │  ├─ stravaExplore.ts
   │  └─ tiler.ts
   └─ workflows/
      └─ recommend.ts
```

---

## 2. `mastra.config.ts`

```ts
import { defineConfig } from "@mastra/core";

export default defineConfig({
  title: "Mastra Chat MVP",
  description: "LLMで入力解析→Stravaの人気セグメントを推薦するエージェント",
  entry: "src/index.ts",
});
```

---

## 3. `package.json`（生成物に追記する想定）

```json
{
  "name": "my-mastra-app",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "mastra dev",
    "build": "mastra build",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@ai-sdk/openai": "^0.0.45",
    "dotenv": "^16.4.5",
    "node-fetch": "^3.3.2",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "typescript": "^5.6.2"
  }
}
```

> `mastra dev` が **Playground（デフォチャット UI と API）**を起動します。

---

## 4. `tsconfig.json`（テンプレ既定で OK・参考）

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "outDir": "dist"
  },
  "include": ["src/**/*"]
}
```

---

## 5. `.env`（例）

```bash
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxx
# Stravaトークン未設定ならモックを返します
STRAVA_ACCESS_TOKEN=
```

---

## 6. `mock/explorer.sample.json`

```json
{
  "segments": [
    {
      "id": 229781,
      "name": "Sample Climb",
      "distance": 2684.8,
      "elev_difference": 152.8,
      "avg_grade": 5.7,
      "climb_category": 4,
      "points": "_p~iF~ps|U_ulLnnqC_mqNvxq`@"
    }
  ]
}
```

---

## 7. `src/index.ts`

```ts
import "dotenv/config";
import { mastra } from "@mastra/core";
import { recommendAgent } from "./agent";

async function main() {
  const app = await mastra({
    agents: [recommendAgent],
  });
  // 内蔵HTTP + Playground起動（UI: http://localhost:4111/）
  await app.start({ ui: true });
}

main();
```

---

## 8. `src/llm.ts`

```ts
import { OpenAIChatModel } from "@mastra/core";

export const chatModel = new OpenAIChatModel({
  model: "gpt-4o-mini", // 速さ重視の軽量モデル
  apiKey: process.env.OPENAI_API_KEY!,
});
```

---

## 9. `src/tools/parseQuery.ts`

```ts
import { defineTool } from "@mastra/core";
import { z } from "zod";
import { chatModel } from "../llm";

export const parseQueryTool = defineTool({
  name: "parseQuery",
  description: "自然文から bounds/distance/elev/activity を抽出してJSON化",
  inputSchema: z.object({ text: z.string() }),
  outputSchema: z.object({
    bounds: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
    distanceKm: z.number().optional(),
    elevM: z.number().optional(),
    activity: z.enum(["running", "riding"]).optional(),
    missing: z.array(z.enum(["bounds","distanceKm","elevM","activity")).optional(),
  }),
  async execute({ text }) {
    const sys = `あなたはラン/ライドのルート検索アシスタントです。出力は必ずJSON。数値は数値型。boundsは[南,西,北,東]順。不明はmissing配列に記載。`;
    const user = `文: "${text}" から {bounds?, distanceKm?, elevM?, activity?} を抽出してJSONで返して。`;
    const res = await chatModel.generate([
      { role: "system", content: sys },
      { role: "user", content: user },
    ]);
    try { return JSON.parse(res.outputText()); }
    catch { return { missing: ["bounds","distanceKm","elevM"] }; }
  }
});
```

---

## 10. `src/tools/summarize.ts`

```ts
import { defineTool } from "@mastra/core";
import { z } from "zod";
import { chatModel } from "../llm";

export const summarizeTool = defineTool({
  name: "summarize",
  description: "候補を要約し、1本推す",
  inputSchema: z.object({
    results: z.array(z.object({
      name: z.string(),
      distanceM: z.number(),
      elevDiffM: z.number(),
      avgGradePct: z.number().optional(),
      url: z.string(),
    }))
  }),
  outputSchema: z.object({ pickIndex: z.number().optional(), comment: z.string() }),
  async execute({ results }) {
    const list = results.map((r,i)=>`#${i+1} ${r.name} ${(r.distanceM/1000).toFixed(1)}km / ~${Math.round(r.elevDiffM)}m`).join("
");
    const sys = "候補の中からユーザーに合いそうな1つを選び、短い日本語コメントを返してください。JSONのみ。";
    const user = `候補:
${list}
JSON: {"pickIndex":<0-based>,"comment":""}`;
    const g = await chatModel.generate([
      { role:"system", content: sys },
      { role:"user", content: user },
    ]);
    try { return JSON.parse(g.outputText()); }
    catch { return { comment: "どれも良さそうです。距離や上りの許容幅を広げても◎。" }; }
  }
});
```

---

## 11. `src/tools/stravaExplore.ts`

```ts
import "dotenv/config";
import { defineTool } from "@mastra/core";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import fetch from "node-fetch";

const ExplorerSegment = z.object({
  id: z.number(),
  name: z.string(),
  distance: z.number(), // m
  elev_difference: z.number(), // m (累積の近似として扱う)
  avg_grade: z.number().optional(),
  climb_category: z.number().optional(),
  points: z.string().optional(), // encoded polyline
});
export type ExplorerSegmentT = z.infer<typeof ExplorerSegment>;

export const stravaExploreTool = defineTool({
  name: "strava.exploreSegments",
  description: "Strava Explore Segments を叩く（トークン無→モック）",
  inputSchema: z.object({
    bounds: z.tuple([z.number(), z.number(), z.number(), z.number()]), // [S,W,N,E]
    activity_type: z.enum(["running", "riding"]).default("running"),
  }),
  outputSchema: z.array(ExplorerSegment),
  async execute({ bounds, activity_type }) {
    const token = process.env.STRAVA_ACCESS_TOKEN?.trim();
    if (!token) {
      const p = path.join(process.cwd(), "mock/explorer.sample.json");
      return JSON.parse(fs.readFileSync(p, "utf-8"))
        .segments as ExplorerSegmentT[];
    }
    const url = new URL("https://www.strava.com/api/v3/segments/explore");
    url.searchParams.set("bounds", bounds.join(","));
    url.searchParams.set("activity_type", activity_type);
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok)
      throw new Error(`Strava API ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return (data.segments ?? []) as ExplorerSegmentT[];
  },
});
```

---

## 12. `src/tools/tiler.ts`

```ts
import { defineTool } from "@mastra/core";
import { z } from "zod";

export const tileBoundsTool = defineTool({
  name: "util.tileBounds",
  description: "矩形を rows×cols のタイルに分割",
  inputSchema: z.object({
    bounds: z.tuple([z.number(), z.number(), z.number(), z.number()]),
    rows: z.number().default(2),
    cols: z.number().default(2),
  }),
  outputSchema: z.array(
    z.tuple([z.number(), z.number(), z.number(), z.number()])
  ),
  async execute({ bounds, rows, cols }) {
    const [S, W, N, E] = bounds;
    const dLat = (N - S) / rows,
      dLng = (E - W) / cols;
    const tiles: [number, number, number, number][] = [];
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        tiles.push([
          S + r * dLat,
          W + c * dLng,
          S + (r + 1) * dLat,
          W + (c + 1) * dLng,
        ]);
    return tiles;
  },
});
```

---

## 13. `src/score.ts`

```ts
export function filterAndScore(
  segs: any[],
  opts: {
    targetDistanceM: number;
    targetElevDiffM: number;
    distTolRatio?: number;
    elevTolAbs?: number;
    top?: number;
  }
) {
  const {
    targetDistanceM,
    targetElevDiffM,
    distTolRatio = 0.1,
    elevTolAbs = 100,
    top = 5,
  } = opts;
  const minD = targetDistanceM * (1 - distTolRatio),
    maxD = targetDistanceM * (1 + distTolRatio);
  const minE = targetElevDiffM - elevTolAbs,
    maxE = targetElevDiffM + elevTolAbs;

  const cand = segs.filter(
    (s) =>
      s.distance >= minD &&
      s.distance <= maxD &&
      s.elev_difference >= minE &&
      s.elev_difference <= maxE
  );

  const scored = cand
    .map((s: any) => {
      const distScore = 1 / (1 + Math.abs(s.distance - targetDistanceM));
      const elevScore = 1 / (1 + Math.abs(s.elev_difference - targetElevDiffM));
      const gradeBonus = Math.max(0, Math.min((s.avg_grade ?? 0) / 10, 0.2));
      return {
        score: 0.6 * distScore + 0.3 * elevScore + 0.1 * gradeBonus,
        ...s,
      };
    })
    .sort((a: any, b: any) => b.score - a.score);

  return scored.slice(0, top);
}
```

---

## 14. `src/workflows/recommend.ts`

```ts
import { defineWorkflow } from "@mastra/workflow";
import { z } from "zod";
import { stravaExploreTool } from "../tools/stravaExplore";
import { tileBoundsTool } from "../tools/tiler";
import { filterAndScore } from "../score";
import { summarizeTool } from "../tools/summarize";

export const recommendWorkflow = defineWorkflow({
  name: "recommend.routes",
  inputSchema: z.object({
    bounds: z.tuple([z.number(), z.number(), z.number(), z.number()]),
    distanceKm: z.number().default(10),
    elevM: z.number().default(300),
    activity: z.enum(["running", "riding"]).default("running"),
    tiles: z.tuple([z.number(), z.number()]).default([2, 2]),
    distTolRatio: z.number().default(0.1),
    elevTolAbs: z.number().default(100),
    top: z.number().default(5),
  }),
  outputSchema: z.any(),
  async run(ctx, input) {
    const tiles = await ctx.callTool(tileBoundsTool, {
      bounds: input.bounds,
      rows: input.tiles[0],
      cols: input.tiles[1],
    });
    const results = await Promise.all(
      tiles.map((b) =>
        ctx.callTool(stravaExploreTool, {
          bounds: b,
          activity_type: input.activity,
        })
      )
    );

    const merged = [...new Map(results.flat().map((s) => [s.id, s])).values()];
    const picked = filterAndScore(merged, {
      targetDistanceM: input.distanceKm * 1000,
      targetElevDiffM: input.elevM,
      distTolRatio: input.distTolRatio,
      elevTolAbs: input.elevTolAbs,
      top: input.top,
    });

    const shaped = picked.map((s) => ({
      name: s.name,
      distanceM: s.distance,
      elevDiffM: s.elev_difference,
      avgGradePct: s.avg_grade,
      url: `https://www.strava.com/segments/${s.id}`,
    }));

    const summary = await ctx.callTool(summarizeTool, { results: shaped });

    return {
      note: "elev_difference は累積上昇の近似です（Strava Exploreの仕様）。",
      query: input,
      count: merged.length,
      results: shaped,
      summary,
    };
  },
});
```

---

## 15. `src/agent.ts`

```ts
import { defineAgent } from "@mastra/agent";
import { recommendWorkflow } from "./workflows/recommend";
import { parseQueryTool } from "./tools/parseQuery";

export const recommendAgent = defineAgent({
  name: "route-recommender",
  description: "エリア×距離×(近似)累積標高でStrava人気セグメントを推薦",
  tools: { parseQueryTool },
  workflows: { recommend: recommendWorkflow },
});
```

---

## 16. 使い方（Playground でチャット）

```bash
pnpm dev
# → Playground: http://localhost:4111/
```

- 「宮崎市内で 10km、上り 300m くらい、ロードで」など自由入力
- LLM が **自然文 → パラメータ化**（不足は会話で補完）→ `recommend.routes` 実行
- 候補リスト＋要約コメントを返します（注記: `elev_difference` は累積上昇の**近似**）

---

### 補足

- `STRAVA_ACCESS_TOKEN` が未設定なら `mock/explorer.sample.json` を返します
- 広いエリアは `tiles: [rows, cols]` で分割回数を調整
- モデルは `gpt-4o-mini` を想定（速度重視）。必要に応じて変更してください

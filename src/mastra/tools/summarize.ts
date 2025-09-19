import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { generateText } from "../lib/llm";

export const summarizeTool = createTool({
  id: "summarize",
  description:
    "stravaExploreのすべての結果からdistanceMとelevMの条件に近いひとつのセグメントを選ぶ",
  inputSchema: z.object({
    results: z.array(
      z.object({
        name: z.string(),
        distanceM: z.number(),
        elevDiffM: z.number(),
        avgGradePct: z.number().optional(),
        url: z.string(),
      })
    ),
  }),
  outputSchema: z.object({
    pickIndex: z.number().optional(),
    comment: z.string(),
  }),
  execute: async ({ context }) => {
    const { results } = context;
    console.log(results);
    const list = results
      .map(
        (r: any, i: number) =>
          `#${i + 1} ${r.name} ${(r.distanceM / 1000).toFixed(
            1
          )}km / ~${Math.round(r.elevDiffM)}m`
      )
      .join("\n");
    const sys =
      "候補の中からユーザーに合いそうな1つを選び、短い日本語コメントを返してください。JSONのみ。";
    const user = `候補:
${list}
JSON: {"pickIndex":<0-based>,"comment":""}`;
    const g = await generateText([
      { role: "system", content: sys },
      { role: "user", content: user },
    ]);
    try {
      return JSON.parse(g.outputText());
    } catch {
      return { comment: "どれも良さそうです。距離や上りの許容幅を広げても◎。" };
    }
  },
});

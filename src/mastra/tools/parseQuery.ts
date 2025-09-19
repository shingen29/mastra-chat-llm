import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { generateText } from "../lib/llm";

export const parseQueryTool = createTool({
  id: "parseQuery",
  description: "自然文から bounds/distance/elev/activity を抽出してJSON化",
  inputSchema: z.object({ text: z.string() }),
  outputSchema: z.object({
    bounds: z.array(z.number()).length(4).optional(),
    distanceM: z.number().optional(),
    elevM: z.number().optional(),
    missing: z.array(z.enum(["bounds", "distanceM", "elevM"])).optional(),
  }),
  execute: async ({ context }) => {
    const { text } = context;
    const sys = `あなたはランニングのルート検索アシスタントです。出力は必ずJSON。数値は数値型。boundsは[南,西,北,東]順。不明はmissing配列に記載。`;
    const user = `文: "${text}" から {bounds?, distanceM?, elevM?} を抽出してJSONで返して。`;
    const res = await generateText([
      { role: "system", content: sys },
      { role: "user", content: user },
    ]);
    console.log(res.outputText());
    try {
      return JSON.parse(res.outputText());
    } catch {
      return { missing: ["bounds", "distanceM", "elevM"] };
    }
  },
});

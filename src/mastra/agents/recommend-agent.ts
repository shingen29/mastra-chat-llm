import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";
import { parseQueryTool } from "../tools/parseQuery";
import { summarizeTool } from "../tools/summarize";
import { stravaExploreTool } from "../tools/stravaExplore";
import { tileBoundsTool } from "../tools/tileBounds";

export const recommendAgent = new Agent({
  name: "route-recommender",
  instructions:
    "エリア×距離×(近似)累積標高でStrava人気セグメントを推薦するエージェント。ユーザーの自然文入力を解析し、適切なルートを提案します。",
  model: openai("gpt-4o-mini"), // より大きなコンテキスト長（128k）
  tools: {
    parseQueryTool,
    summarizeTool,
    stravaExploreTool,
    tileBoundsTool,
  },
});

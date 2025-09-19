import { Mastra } from "@mastra/core/mastra";
import { recommendAgent } from "./agents/recommend-agent";

export const mastra = new Mastra({
  agents: { recommendAgent },
});

import { openai } from "@ai-sdk/openai";

export const chatModel = openai("gpt-3.5-turbo");

// Mastra互換のラッパー関数
export const generateText = async (
  messages: Array<{ role: string; content: string }>
) => {
  const { generateText } = await import("ai");
  const result = await generateText({
    model: chatModel,
    messages: messages as any,
  });
  return {
    outputText: () => result.text,
  };
};

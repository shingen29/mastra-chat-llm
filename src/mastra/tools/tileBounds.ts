import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const tileBoundsTool = createTool({
  id: "tileBounds",
  description: "矩形を rows×cols のタイルに分割",
  inputSchema: z.object({
    bounds: z.array(z.number()).length(4),
    rows: z.number().default(2),
    cols: z.number().default(2),
  }),
  outputSchema: z.array(z.array(z.number()).length(4)),
  execute: async ({ context }) => {
    const { bounds, rows, cols } = context;
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

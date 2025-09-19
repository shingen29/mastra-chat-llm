import "dotenv/config";
import { createTool } from "@mastra/core/tools";
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

export const stravaExploreTool = createTool({
  id: "exploreSegments",
  description: "Strava Explore Segments を叩く（トークン無→モック）",
  inputSchema: z.object({
    bounds: z.array(z.number()).length(4), // [S,W,N,E]
  }),
  outputSchema: z.array(ExplorerSegment),
  execute: async ({ context }) => {
    let { bounds } = context;

    // 緯度経度の逆転をチェックして修正
    // bounds = [南, 西, 北, 東] の想定
    let [val1, val2, val3, val4] = bounds;

    // 値の範囲から緯度経度を判定
    // 緯度: -90 to 90, 経度: -180 to 180
    // 日本周辺では緯度: 24-46, 経度: 122-154 程度
    if (Math.abs(val1) > 90 || Math.abs(val3) > 90) {
      // 最初の値が緯度範囲外なら、経度緯度が逆転している
      bounds = [val2, val1, val4, val3]; // [緯度1, 経度1, 緯度2, 経度2] に修正
    }

    // さらに南北・東西の順序をチェック
    let [S, W, N, E] = bounds;
    if (S > N) [S, N] = [N, S]; // 南北入れ替え
    if (W > E) [W, E] = [E, W]; // 東西入れ替え
    bounds = [S, W, N, E];

    const token = process.env.STRAVA_ACCESS_TOKEN?.trim();
    if (!token) {
      const p = path.join(process.cwd(), "mock/explorer.sample.json");
      return JSON.parse(fs.readFileSync(p, "utf-8"))
        .segments as ExplorerSegmentT[];
    }
    const url = new URL("https://www.strava.com/api/v3/segments/explore");
    url.searchParams.set("bounds", bounds.join(","));
    url.searchParams.set("activity_type", "running");
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok)
      throw new Error(`Strava API ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as any;
    return (data.segments ?? []) as ExplorerSegmentT[];
  },
});

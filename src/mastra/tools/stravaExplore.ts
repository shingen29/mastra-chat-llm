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
    const { bounds } = context;
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

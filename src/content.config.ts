import { defineCollection } from "astro:content";
// `z` re-exported from `astro:content` is deprecated; import it from
// `astro/zod` (the pattern nimbus-docs' own schema helpers document).
import { z } from "astro/zod";
import { docsCollection, partialsCollection } from "@cloudflare/nimbus-docs/content";

// 页面头字段的完整约定（一句话 description、状态与取代链、确认日期）由
// scripts/check-content.mjs 校验；这里只声明类型，构建时拒绝拼错的键。
export const collections = {
  docs: defineCollection(
    docsCollection({
      schemaFields: {
        // Nimbus docs are agent-friendly by default. Set `audience: human`
        // to flag a page that's written primarily for human readers.
        audience: z.literal("human").optional(),
        aliases: z.array(z.string().min(1)).optional(),
        status: z.enum(["current", "historical", "superseded"]).default("current"),
        supersededBy: z.string().startsWith("/").optional(),
        reviewed: z.coerce.date().optional(),
      },
      markdownFields: ["aliases", "status", "supersededBy", "reviewed"],
    }),
  ),
  partials: defineCollection(partialsCollection()),
};

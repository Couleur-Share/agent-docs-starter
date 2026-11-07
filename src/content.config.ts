import { defineCollection } from "astro:content";
// `z` re-exported from `astro:content` is deprecated; import it from
// `astro/zod` (the pattern nimbus-docs' own schema helpers document).
import { z } from "astro/zod";
import { docsCollection, partialsCollection } from "@cloudflare/nimbus-docs/content";

// 页面头遵循 OKF v0.2，见 AGENTS.md。这里只声明形状：Nimbus 的严格校验据此接受这些键、拒绝拼错的键。
// OKF 合规由 CI 里的 OKF 校验器检查，本站自己的写法规则在 scripts/check-content.mjs。
// 新增扩展键要先在这里声明。YAML 会把不加引号的时间解析成 Date，所以时间字段两种形式都接受。
const instant = z.union([z.date(), z.iso.datetime({ offset: true })]);
const actor = z.string().min(1);
const event = z.object({ by: actor, at: instant });

export const collections = {
  docs: defineCollection(
    docsCollection({
      schemaFields: {
        // Nimbus docs are agent-friendly by default. Set `audience: human`
        // to flag a page that's written primarily for human readers.
        audience: z.literal("human").optional(),
        type: z.string().min(1),
        tags: z.array(z.string().min(1)).optional(),
        resource: z.string().min(1).optional(),
        status: z.enum(["draft", "stable", "deprecated"]).optional(),
        generated: z.object({ by: actor, at: instant.optional() }).optional(),
        verified: z.union([event, z.array(event).min(1)]).optional(),
        stale_after: instant.optional(),
        sources: z.array(z.looseObject({ resource: z.string().min(1) })).optional(),
        usage_window: z.object({ from: instant, to: instant }).optional(),
        aliases: z.array(z.string().min(1)).optional(),
        supersededBy: z.string().startsWith("/").optional(),
      },
      markdownFields: ["type", "tags", "status", "stale_after", "aliases", "supersededBy"],
    }),
  ),
  partials: defineCollection(partialsCollection()),
};

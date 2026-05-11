import { z } from "zod";

export const LIBRARY_ITEM_KIND = z.enum(["skill", "agent"]);
export const APP_LANGUAGE = z.enum(["system", "en", "nl"]);
export const EDITOR_VIEW_MODE = z.enum(["preview", "edit"]);

export const ToolInstallRootsSchema = z.object({
  skill: z.array(z.string()).default([]),
  agent: z.array(z.string()).default([]),
});

export const ToolConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  installRoots: ToolInstallRootsSchema,
});

export const LibraryItemToolMappingSchema = z.object({
  itemId: z.string().min(1),
  toolIds: z.array(z.string().min(1)),
});

export const AppConfigSchema = z.object({
  scanRoots: z.array(z.string()),
  tools: z.array(ToolConfigSchema).default([]),
  toolMappings: z.array(LibraryItemToolMappingSchema).default([]),
  suppressSuccessNotifications: z.boolean().default(false),
  language: APP_LANGUAGE.default("system"),
  defaultEditorMode: EDITOR_VIEW_MODE.default("preview"),
  onboardingTourCompleted: z.boolean().default(false),
});

export const CollectionArchiveManifestSchema = z.object({
  format: z.literal("skillful.collection"),
  version: z.literal(1),
  collection: z.object({
    id: z.string().min(1),
    title: z.string().min(1),
  }),
  exportedAt: z.string(),
  counts: z.object({
    skills: z.number().int().nonnegative(),
    agents: z.number().int().nonnegative(),
    files: z.number().int().nonnegative(),
  }),
});

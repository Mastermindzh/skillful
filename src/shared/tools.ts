import { AppError } from "./errors";
import type { ToolConfig } from "./types";

export function findToolOrThrow(tools: ToolConfig[], toolId: string) {
  const tool = tools.find((entry) => entry.id === toolId);
  if (!tool) throw new AppError("tool-not-found", `Tool not found: ${toolId}`);
  return tool;
}

import { Bot, Braces, MousePointer2, Sparkles, SquareTerminal, Wrench } from "lucide-react";
import type { ToolIconKey } from "../../../shared/toolPresets";

export function toolIcon(icon: ToolIconKey, size = 14) {
  switch (icon) {
    case "claude":
      return <Bot size={size} />;
    case "codex":
      return <Braces size={size} />;
    case "cursor":
      return <MousePointer2 size={size} />;
    case "gemini":
      return <Sparkles size={size} />;
    case "github":
      return <GithubIcon size={size} />;
    case "junie":
      return <Bot size={size} />;
    case "opencode":
      return <SquareTerminal size={size} />;
    default:
      return <Wrench size={size} />;
  }
}

function GithubIcon({ size }: { size: number }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} fill="currentColor">
      <path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.38 6.84 9.74.5.1.68-.22.68-.49 0-.24-.01-1.04-.01-1.89-2.78.62-3.37-1.22-3.37-1.22-.45-1.19-1.11-1.5-1.11-1.5-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.37-2.22-.26-4.55-1.14-4.55-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05A9.3 9.3 0 0 1 12 6.99c.85 0 1.7.12 2.5.34 1.9-1.33 2.74-1.05 2.74-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.81-4.57 5.06.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.8 0 .27.18.59.69.49A10.25 10.25 0 0 0 22 12.25C22 6.58 17.52 2 12 2Z" />
    </svg>
  );
}

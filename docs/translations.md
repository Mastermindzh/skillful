# Contributing Translations

Skillful uses `react-i18next` for in-app translations. Translations should stay easy to review so they are always in their own files:

```text
src/mainview/i18n/locales/en.ts
```

## Add A Translation

1. Add a new locale file in `src/mainview/i18n/locales/`.
2. Add the locale key to `dictionaries` in `src/mainview/i18n/messages.ts`.
3. Add the human-readable selector label to the `settings.language.*` messages.
4. Keep every key from `enMessages`.
5. Run the checks before opening a pull request.

Example:

```ts
// src/mainview/i18n/locales/nl.ts
import { enMessages } from "./en";

export const nlMessages: typeof enMessages = {
  ...enMessages,
  "sidebar.collections": "Collecties",
  // Replace the remaining English strings before opening the PR.
};

// src/mainview/i18n/messages.ts
export const dictionaries = {
  en: enMessages,
  nl: nlMessages,
} as const;
```

Using `typeof enMessages` is intentional. It makes TypeScript fail when a translation is missing a key.

The i18next setup lives in:

```text
src/mainview/i18n/i18n.ts
```

It detects the browser/Electron locale, falls back to English, and uses `{placeholder}` interpolation so translation strings stay readable.

## Style Guide

- Prefer clear product language over literal word-for-word translation.
- Keep labels short where they appear on buttons, tabs, or narrow panes.
- Preserve placeholders such as `{title}`, `{file}`, `{nameKey}`, and `{descriptionKey}` exactly.
- Preserve product names such as Skillful, Claude Code, Codex, Copilot, Gemini, Cursor, Junie, and opencode.
- If a term is common in English for your language community, keep it in English.

## Testing

Run:

```bash
bun run check
bun run test:unit
```

For UI-heavy changes, also run:

```bash
bun run test:e2e
```

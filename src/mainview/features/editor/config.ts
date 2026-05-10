import { markdown } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import type { Compartment, Extension } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { tags } from "@lezer/highlight";

const darkTheme = EditorView.theme(
  {
    "&": {
      color: "#d7d1ca",
      backgroundColor: "#2b2b2b",
    },
    ".cm-content": {
      caretColor: "#f0a35b",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "#f0a35b",
    },
    ".cm-selectionBackground, ::selection": {
      backgroundColor: "rgba(217, 142, 79, 0.24)",
    },
    ".cm-activeLine": {
      backgroundColor: "rgba(255, 255, 255, 0.03)",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "rgba(255, 255, 255, 0.03)",
    },
    ".cm-gutters": {
      color: "#8f8b86",
      backgroundColor: "#262626",
      borderRight: "1px solid #3a3d41",
    },
    ".cm-foldPlaceholder": {
      backgroundColor: "#3a3330",
      border: "1px solid #4a403a",
      color: "#b9b2aa",
    },
    ".cm-tooltip": {
      backgroundColor: "#313335",
      border: "1px solid #45494d",
      color: "#d7d1ca",
    },
    ".cm-panels": {
      backgroundColor: "#262626",
      color: "#d7d1ca",
    },
  },
  { dark: true }
);

const lightTheme = EditorView.theme(
  {
    "&": {
      color: "#1e1e2e",
      backgroundColor: "#fafaff",
    },
    ".cm-content": {
      caretColor: "#6c3cb4",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "#6c3cb4",
    },
    ".cm-selectionBackground, ::selection": {
      backgroundColor: "rgba(108, 60, 180, 0.12)",
    },
    ".cm-activeLine": {
      backgroundColor: "rgba(108, 60, 180, 0.03)",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "rgba(108, 60, 180, 0.03)",
    },
    ".cm-gutters": {
      color: "#a0a0b8",
      backgroundColor: "#f4f3fa",
      borderRight: "1px solid rgba(108, 60, 180, 0.08)",
    },
    ".cm-foldPlaceholder": {
      backgroundColor: "#eeedf8",
      border: "1px solid rgba(108, 60, 180, 0.1)",
      color: "#8080a0",
    },
    ".cm-tooltip": {
      backgroundColor: "#fafaff",
      border: "1px solid rgba(108, 60, 180, 0.12)",
      color: "#1e1e2e",
    },
    ".cm-panels": {
      backgroundColor: "#f4f3fa",
      color: "#1e1e2e",
    },
  },
  { dark: false }
);

const warmDarkModeHighlight = HighlightStyle.define([
  { tag: [tags.heading, tags.keyword], color: "#cc7832" },
  { tag: [tags.atom, tags.bool, tags.special(tags.variableName)], color: "#cc7832" },
  { tag: [tags.string, tags.special(tags.string)], color: "#6a8759" },
  { tag: [tags.comment, tags.quote], color: "#808080", fontStyle: "italic" },
  { tag: [tags.number, tags.integer, tags.float], color: "#6897bb" },
  { tag: [tags.url, tags.link], color: "#6a9fb5", textDecoration: "underline" },
  { tag: [tags.emphasis], fontStyle: "italic" },
  { tag: [tags.strong], fontWeight: "700" },
  { tag: [tags.monospace, tags.processingInstruction], color: "#a9b7c6" },
  { tag: [tags.list], color: "#d7d1ca" },
]);

const warmLightHighlight = HighlightStyle.define([
  { tag: [tags.heading, tags.keyword], color: "#7c3aed" },
  { tag: [tags.atom, tags.bool, tags.special(tags.variableName)], color: "#7c3aed" },
  { tag: [tags.string, tags.special(tags.string)], color: "#16a34a" },
  { tag: [tags.comment, tags.quote], color: "#9ca3af", fontStyle: "italic" },
  { tag: [tags.number, tags.integer, tags.float], color: "#2563eb" },
  { tag: [tags.url, tags.link], color: "#0891b2", textDecoration: "underline" },
  { tag: [tags.emphasis], fontStyle: "italic" },
  { tag: [tags.strong], fontWeight: "700" },
  { tag: [tags.monospace, tags.processingInstruction], color: "#6b4fa0" },
  { tag: [tags.list], color: "#1e1e2e" },
]);

export type EditorColorScheme = "light" | "dark";

/**
 * Returns the theme extension for a given color scheme. Kept as a standalone helper so the
 * editor can reconfigure a `Compartment` on theme flips without tearing down the EditorState.
 */
export function editorThemeExtension(colorScheme: EditorColorScheme): Extension {
  return colorScheme === "dark"
    ? [darkTheme, syntaxHighlighting(warmDarkModeHighlight)]
    : [lightTheme, syntaxHighlighting(warmLightHighlight)];
}

export function buildEditorExtensions(
  filePath: string,
  colorScheme: EditorColorScheme,
  onSave: () => void,
  themeCompartment: Compartment
) {
  const extensions: Extension[] = [
    EditorView.lineWrapping,
    keymap.of([
      {
        key: "Mod-s",
        run: () => {
          onSave();
          return true;
        },
      },
    ]),
    themeCompartment.of(editorThemeExtension(colorScheme)),
  ];

  if (isMarkdownFile(filePath)) {
    extensions.unshift(markdown());
  }

  return extensions;
}

function isMarkdownFile(filePath: string) {
  const lowerPath = filePath.toLowerCase();
  return lowerPath.endsWith(".md") || lowerPath.endsWith(".mdx") || lowerPath.endsWith(".mdc");
}

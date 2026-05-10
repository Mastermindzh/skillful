import { Compartment } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { useComputedColorScheme } from "@mantine/core";
import CodeMirror from "@uiw/react-codemirror";
import { type RefObject, useEffect, useMemo, useRef } from "react";
import { buildEditorExtensions, editorThemeExtension } from "./config";
import type { EditorHandle } from "./types";

type LibraryItemCodeEditorProps = {
  documentId: string;
  filePath: string;
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  editorRef: RefObject<EditorHandle | null>;
};

export function LibraryItemCodeEditor({
  documentId,
  filePath,
  value,
  onChange,
  onSave,
  editorRef,
}: LibraryItemCodeEditorProps) {
  const computedColorScheme = useComputedColorScheme("dark");
  // A fresh compartment per mount (document/file combo) keeps theme swaps tied to the current
  // EditorView instance dispatching a reconfigure against a disposed view would throw.
  // biome-ignore lint/correctness/useExhaustiveDependencies: recreate compartment when the editor remounts (document/file change), not on theme flips.
  const themeCompartment = useMemo(() => new Compartment(), [documentId, filePath]);
  const viewRef = useRef<EditorView | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: excludes computedColorScheme on purpose, theme is reconfigured through the compartment so EditorState (cursor/selection) stays intact across light/dark flips.
  const extensions = useMemo(
    () => buildEditorExtensions(filePath, computedColorScheme, onSave, themeCompartment),
    [filePath, onSave, themeCompartment]
  );

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: themeCompartment.reconfigure(editorThemeExtension(computedColorScheme)),
    });
  }, [computedColorScheme, themeCompartment]);

  useEffect(() => {
    return () => {
      editorRef.current = null;
      viewRef.current = null;
    };
  }, [editorRef]);

  return (
    <CodeMirror
      key={`${documentId}:${filePath}`}
      value={value}
      onChange={onChange}
      className="editor-field"
      theme="none"
      extensions={extensions}
      basicSetup={{
        foldGutter: false,
      }}
      onCreateEditor={(view) => {
        viewRef.current = view;
        editorRef.current = {
          focus: () => view.focus(),
        };
      }}
    />
  );
}

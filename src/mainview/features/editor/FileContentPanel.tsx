import { Tabs, Text } from "@mantine/core";
import { lazy, type RefObject, Suspense } from "react";
import type { EditorViewMode } from "../../../shared/types";
import { useAppTranslation } from "../../i18n/i18n";
import { MarkdownPreview } from "./MarkdownPreview";
import type { EditorHandle } from "./types";

const LibraryItemCodeEditor = lazy(async () => {
  const module = await import("./LibraryItemCodeEditor");
  return { default: module.LibraryItemCodeEditor };
});

type FileContentPanelProps = {
  documentId: string;
  filePath: string;
  value: string;
  viewMode: EditorViewMode;
  onChange: (value: string) => void;
  onSave: () => void;
  editorRef: RefObject<EditorHandle | null>;
  /** Shown in preview instead of a blank page when the file is empty. */
  emptyPreviewMessage?: string;
};

/** Tab panel showing one file as a markdown preview or in the (lazy-loaded) code editor. */
export function FileContentPanel({
  documentId,
  filePath,
  value,
  viewMode,
  onChange,
  onSave,
  editorRef,
  emptyPreviewMessage,
}: FileContentPanelProps) {
  const { t } = useAppTranslation();
  return (
    <Tabs.Panel value={filePath} pt="sm" className="editor-panel">
      <div className="editor-panel-body">
        {viewMode === "edit" ? (
          <Suspense
            fallback={
              <div className="editor-field editor-loading" aria-live="polite">
                {t("details.loadingEditor")}
              </div>
            }
          >
            <LibraryItemCodeEditor
              documentId={documentId}
              filePath={filePath}
              value={value}
              onChange={onChange}
              onSave={onSave}
              editorRef={editorRef}
            />
          </Suspense>
        ) : emptyPreviewMessage && !value.trim() ? (
          <Text size="sm" c="dimmed" p="md">
            {emptyPreviewMessage}
          </Text>
        ) : (
          <MarkdownPreview value={value} />
        )}
      </div>
    </Tabs.Panel>
  );
}

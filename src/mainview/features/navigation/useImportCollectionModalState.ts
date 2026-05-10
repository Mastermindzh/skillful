import type { ComponentPropsWithoutRef } from "react";
import { useEffect, useState } from "react";
import {
  type GitHubImportDraft,
  suggestedGitHubCollectionName,
} from "../../../shared/githubImport";
import { useAppTranslation } from "../../i18n/i18n";
import type { ImportCollectionFieldErrors, ImportMode } from "./importCollectionModels";
import { classifyImportCollectionError, importedCollectionName } from "./importCollections";

type UseImportCollectionModalStateArgs = {
  opened: boolean;
  draft: GitHubImportDraft | null;
  errorMessage: string | null;
  onClearError: () => void;
  onPickFolder: () => Promise<string | null>;
  onPickArchive: () => Promise<string | null>;
  onImportFolder: (input: { name: string; sourcePath: string }) => Promise<boolean>;
  onImportArchive: (input: { name: string; archivePath: string }) => Promise<boolean>;
  onImportGitHub: (input: {
    name: string;
    repo: string;
    ref?: string;
    path?: string;
  }) => Promise<boolean>;
};

export function useImportCollectionModalState({
  opened,
  draft,
  errorMessage,
  onClearError,
  onPickFolder,
  onPickArchive,
  onImportFolder,
  onImportArchive,
  onImportGitHub,
}: UseImportCollectionModalStateArgs) {
  const { t } = useAppTranslation();
  const [mode, setMode] = useState<ImportMode>("archive");
  const [name, setName] = useState("");
  const [sourcePath, setSourcePath] = useState("");
  const [repo, setRepo] = useState("");
  const [ref, setRef] = useState("");
  const [gitPath, setGitPath] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [localErrors, setLocalErrors] = useState<ImportCollectionFieldErrors>({});
  const [nameTouched, setNameTouched] = useState(false);

  useEffect(() => {
    if (!opened) {
      setMode("archive");
      setName("");
      setSourcePath("");
      setRepo("");
      setRef("");
      setGitPath("");
      setAdvancedOpen(false);
      setLocalErrors({});
      setNameTouched(false);
    }
  }, [opened]);

  useEffect(() => {
    if (!opened || !draft) return;

    setMode("github");
    setSourcePath("");
    setRepo(draft.repo);
    setRef(draft.ref ?? "");
    setGitPath(draft.path ?? "");
    setAdvancedOpen(Boolean(draft.ref || draft.path));
    setLocalErrors({});
    setNameTouched(Boolean(draft.name));
    setName(
      draft.name ??
        suggestedGitHubCollectionName({
          repo: draft.repo,
          path: draft.path,
        })
    );
    onClearError();
  }, [draft, onClearError, opened]);

  const isGitHubMode = mode === "github";
  const canImport =
    name.trim().length > 0 &&
    (isGitHubMode ? repo.trim().length > 0 : sourcePath.trim().length > 0);
  const sourceName = importedCollectionName(sourcePath);
  const remoteErrors = classifyImportCollectionError(errorMessage);

  const clearFieldError = (field: keyof ImportCollectionFieldErrors) => {
    onClearError();
    setLocalErrors((currentErrors) => ({
      ...currentErrors,
      [field]: undefined,
      form: undefined,
    }));
  };

  const updateSuggestedName = (nextRepo: string, nextPath: string) => {
    if (nameTouched) return;
    setName(
      suggestedGitHubCollectionName({
        repo: nextRepo,
        path: nextPath,
      })
    );
  };

  const handleModeChange = (value: string) => {
    setMode(value as ImportMode);
    setName("");
    setSourcePath("");
    setRepo("");
    setRef("");
    setGitPath("");
    setAdvancedOpen(false);
    setLocalErrors({});
    setNameTouched(false);
    onClearError();
  };

  const handleNameChange = (value: string) => {
    setNameTouched(true);
    setName(value);
    clearFieldError("name");
  };

  const handleRepoChange = (value: string) => {
    setRepo(value);
    clearFieldError("repo");
    updateSuggestedName(value, gitPath);
  };

  const handleRefChange = (value: string) => {
    setRef(value);
    clearFieldError("ref");
  };

  const handlePathChange = (value: string) => {
    setGitPath(value);
    clearFieldError("path");
    updateSuggestedName(repo, value);
  };

  const handlePickSource = async () => {
    try {
      const nextSourcePath = mode === "archive" ? await onPickArchive() : await onPickFolder();
      if (!nextSourcePath) {
        setLocalErrors({
          sourcePath:
            mode === "archive" ? t("import.localError.noArchive") : t("import.localError.noFolder"),
        });
        return;
      }

      setSourcePath(nextSourcePath);
      clearFieldError("sourcePath");
      if (!nameTouched) {
        setName(importedCollectionName(nextSourcePath));
      }
    } catch (error) {
      setLocalErrors({
        sourcePath:
          error instanceof Error
            ? error.message
            : mode === "archive"
              ? t("import.localError.pickArchive")
              : t("import.localError.pickFolder"),
      });
    }
  };

  const handleSubmit: ComponentPropsWithoutRef<"form">["onSubmit"] = async (event) => {
    event.preventDefault();

    if (isGitHubMode) {
      if (!repo.trim()) {
        setLocalErrors({ repo: t("import.localError.githubRepoRequired") });
        return;
      }
    } else if (!sourcePath.trim()) {
      setLocalErrors({
        sourcePath:
          mode === "archive"
            ? t("import.localError.chooseArchive")
            : t("import.localError.chooseFolder"),
      });
      return;
    }

    const imported =
      mode === "archive"
        ? await onImportArchive({ name, archivePath: sourcePath })
        : mode === "folder"
          ? await onImportFolder({ name, sourcePath })
          : await onImportGitHub({
              name,
              repo,
              ref: ref.trim() || undefined,
              path: gitPath.trim() || undefined,
            });

    if (imported) {
      setName("");
      setSourcePath("");
      setRepo("");
      setRef("");
      setGitPath("");
      setAdvancedOpen(false);
      setNameTouched(false);
      setLocalErrors({});
    }
  };

  return {
    mode,
    name,
    sourcePath,
    repo,
    ref,
    gitPath,
    advancedOpen,
    canImport,
    sourceName,
    isGitHubMode,
    errors: {
      sourcePath: localErrors.sourcePath ?? remoteErrors.sourcePath,
      repo: localErrors.repo ?? remoteErrors.repo,
      ref: localErrors.ref ?? remoteErrors.ref,
      path: localErrors.path ?? remoteErrors.path,
      name: localErrors.name ?? remoteErrors.name,
      form: localErrors.form ?? remoteErrors.form,
    },
    setAdvancedOpen,
    handleModeChange,
    handleNameChange,
    handleRepoChange,
    handleRefChange,
    handlePathChange,
    handlePickSource,
    handleSubmit,
  };
}

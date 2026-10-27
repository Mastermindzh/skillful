import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Collapse,
  Group,
  NumberInput,
  SegmentedControl,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
  Tooltip,
} from "@mantine/core";
import {
  ChevronDown,
  ChevronRight,
  GitBranch,
  Lock,
  Minus,
  Plus,
  RefreshCw,
  ShieldQuestion,
  Trash2,
  Undo2,
} from "lucide-react";
import { formatGitRemoteLabel } from "../../../../shared/gitRemote";
import type { GitLibrarySyncResult, GitLibrarySyncState } from "../../../../shared/types";
import { DialogErrorMessage } from "../../../components/dialogs/DialogErrorMessage";
import { useAppTranslation } from "../../../i18n/i18n";
import type { TranslationKey } from "../../../i18n/messages";
import {
  type GitLibraryIssue,
  type GitLibraryRow,
  gitLibraryHasLocalWork,
} from "../model/gitLibraries";
import type { GitLibraryHostPrompt } from "../state/useGitLibrarySettingsState";
import { preventFileUriDrop } from "../utils/dnd";
import { PendingRemovalBadge } from "./PendingRemovalBadge";

export type GitLibrarySettingsPanelProps = {
  rows: GitLibraryRow[];
  issueById: Record<string, GitLibraryIssue>;
  statusById: Record<string, GitLibrarySyncResult>;
  libraryPaths: Record<string, string>;
  defaultRoot: string;
  busyIds: string[];
  errorMessage: string | null;
  hostPrompt: GitLibraryHostPrompt | null;
  expandedById: Record<string, boolean>;
  onToggleExpanded: (id: string, expanded: boolean) => void;
  onAddRow: () => void;
  onUpdateRow: <K extends keyof GitLibraryRow>(id: string, key: K, value: GitLibraryRow[K]) => void;
  onRemoveRow: (id: string) => void;
  onRestoreRow: (id: string) => void;
  onSync: (id: string) => void;
  onPush: (id: string) => void;
  onDiscard: (id: string) => void;
  onTrustHost: () => void;
  onDismissHostPrompt: () => void;
};

const STATE_LABELS: Record<GitLibrarySyncState, TranslationKey> = {
  "not-cloned": "settings.gitLibrary.state.notCloned",
  "up-to-date": "settings.gitLibrary.state.upToDate",
  updated: "settings.gitLibrary.state.updated",
  "local-changes": "settings.gitLibrary.state.localChanges",
  diverged: "settings.gitLibrary.state.diverged",
  "missing-git": "settings.gitLibrary.state.missingGit",
  "not-configured": "settings.gitLibrary.state.notConfigured",
  "auth-failed": "settings.gitLibrary.state.authFailed",
  "host-key-unverified": "settings.gitLibrary.state.hostKeyUnverified",
  "remote-unreachable": "settings.gitLibrary.state.remoteUnreachable",
  error: "settings.gitLibrary.state.error",
};

const STATE_COLORS: Record<GitLibrarySyncState, string> = {
  "not-cloned": "gray",
  "up-to-date": "green",
  updated: "green",
  "local-changes": "yellow",
  diverged: "orange",
  "missing-git": "red",
  "not-configured": "gray",
  "auth-failed": "red",
  "host-key-unverified": "orange",
  "remote-unreachable": "red",
  error: "red",
};

export function GitLibrarySettingsPanel({
  rows,
  issueById,
  statusById,
  libraryPaths,
  defaultRoot,
  busyIds,
  errorMessage,
  hostPrompt,
  expandedById,
  onToggleExpanded,
  onAddRow,
  onUpdateRow,
  onRemoveRow,
  onRestoreRow,
  onSync,
  onPush,
  onDiscard,
  onTrustHost,
  onDismissHostPrompt,
}: GitLibrarySettingsPanelProps) {
  const { t } = useAppTranslation();

  return (
    <Stack gap="lg">
      <Stack gap={6}>
        <Title order={4}>{t("settings.gitLibrary.title")}</Title>
        <Text size="sm" c="dimmed">
          {t("settings.gitLibrary.description", { path: defaultRoot })}
        </Text>
      </Stack>

      <DialogErrorMessage message={errorMessage} />

      {hostPrompt ? (
        <Alert
          color="orange"
          icon={<ShieldQuestion size={16} />}
          title={t("settings.gitLibrary.hostKey.title", { host: hostPrompt.hostKey.host })}
        >
          <Stack gap="xs">
            <Text size="sm">{t("settings.gitLibrary.hostKey.description")}</Text>
            <Text size="sm" ff="monospace">
              {hostPrompt.hostKey.keyType} {hostPrompt.hostKey.fingerprint}
            </Text>
            <Group gap="sm">
              <Button size="xs" color="orange" onClick={onTrustHost}>
                {t("settings.gitLibrary.hostKey.trust")}
              </Button>
              <Button size="xs" variant="default" color="gray" onClick={onDismissHostPrompt}>
                {t("common.cancel")}
              </Button>
            </Group>
          </Stack>
        </Alert>
      ) : null}

      <Stack gap="md">
        {rows.map((row, index) => {
          const pending = Boolean(row.pendingRemoval);
          const issue = issueById[row.id] ?? {};
          const status = statusById[row.id];
          const busy = busyIds.includes(row.id);
          const saved = Boolean(libraryPaths[row.id]);
          // Saved, valid libraries collapse to a one-line summary; anything unfinished or
          // broken stays open so its errors are never hidden behind a chevron.
          const expanded = expandedById[row.id] ?? (!saved || Object.keys(issue).length > 0);

          return (
            <Card
              key={row.id}
              withBorder
              padding="md"
              className={pending ? "settings-row-pending-removal" : undefined}
            >
              <Stack gap="sm">
                <Group justify="space-between" align="center" wrap="nowrap">
                  <Group gap="xs" align="center" wrap="nowrap" style={{ minWidth: 0 }}>
                    {pending ? null : (
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        size="sm"
                        onClick={() => onToggleExpanded(row.id, !expanded)}
                        aria-expanded={expanded}
                        aria-label={t(
                          expanded ? "settings.gitLibrary.collapse" : "settings.gitLibrary.expand",
                          { index: index + 1 }
                        )}
                      >
                        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </ActionIcon>
                    )}
                    <Text fw={600} truncate>
                      {row.name.trim() || t("settings.gitLibrary.untitled", { index: index + 1 })}
                    </Text>
                    {row.readOnly ? (
                      <Badge color="gray" variant="light" leftSection={<Lock size={10} />}>
                        {t("settings.gitLibrary.readOnlyBadge")}
                      </Badge>
                    ) : null}
                    {status ? (
                      <Badge color={STATE_COLORS[status.state]} variant="light">
                        {t(STATE_LABELS[status.state])}
                      </Badge>
                    ) : null}
                  </Group>
                  {pending ? (
                    <ActionIcon
                      variant="default"
                      color="gray"
                      size={36}
                      onClick={() => onRestoreRow(row.id)}
                      aria-label={t("settings.gitLibrary.restore", { index: index + 1 })}
                    >
                      <Undo2 size={16} />
                    </ActionIcon>
                  ) : (
                    <ActionIcon
                      variant="default"
                      color="gray"
                      size={36}
                      onClick={() => onRemoveRow(row.id)}
                      aria-label={t("settings.gitLibrary.remove", { index: index + 1 })}
                    >
                      <Minus size={16} />
                    </ActionIcon>
                  )}
                </Group>

                {!pending && !expanded && row.remoteUrl.trim() ? (
                  <Text size="xs" c="dimmed" ff="monospace" truncate>
                    {formatGitRemoteLabel(row.remoteUrl, row.branch)}
                  </Text>
                ) : null}

                {pending ? (
                  <PendingRemovalBadge labelKey="settings.gitLibrary.markedForRemoval" />
                ) : (
                  <Collapse expanded={expanded}>
                    <Stack gap="sm">
                      <TextInput
                        label={t("settings.gitLibrary.name")}
                        placeholder={t("settings.gitLibrary.namePlaceholder")}
                        value={row.name}
                        error={issue.name ? t(issue.name) : null}
                        onChange={(event) => onUpdateRow(row.id, "name", event.currentTarget.value)}
                      />
                      <TextInput
                        label={t("settings.gitLibrary.remoteUrl")}
                        placeholder={t("settings.gitLibrary.remoteUrlPlaceholder")}
                        value={row.remoteUrl}
                        error={issue.remoteUrl ? t(issue.remoteUrl) : null}
                        onChange={(event) =>
                          onUpdateRow(row.id, "remoteUrl", event.currentTarget.value)
                        }
                      />
                      <Group grow align="flex-start">
                        <TextInput
                          label={t("settings.gitLibrary.branch")}
                          placeholder={t("settings.gitLibrary.branchPlaceholder")}
                          value={row.branch}
                          error={issue.branch ? t(issue.branch) : null}
                          leftSection={<GitBranch size={16} />}
                          onChange={(event) =>
                            onUpdateRow(row.id, "branch", event.currentTarget.value)
                          }
                        />
                        <TextInput
                          label={t("settings.gitLibrary.path")}
                          placeholder={libraryPaths[row.id] ?? t("settings.gitLibrary.pathManaged")}
                          value={row.path}
                          error={issue.path ? t(issue.path) : null}
                          onDragOver={preventFileUriDrop}
                          onDrop={preventFileUriDrop}
                          onChange={(event) =>
                            onUpdateRow(row.id, "path", event.currentTarget.value)
                          }
                        />
                      </Group>

                      <Stack gap={4}>
                        <Text size="sm" fw={500}>
                          {t("settings.gitLibrary.syncMode")}
                        </Text>
                        <SegmentedControl
                          value={row.syncMode}
                          onChange={(value) =>
                            onUpdateRow(row.id, "syncMode", value as GitLibraryRow["syncMode"])
                          }
                          data={[
                            { value: "pull", label: t("settings.gitLibrary.syncMode.pull") },
                            { value: "two-way", label: t("settings.gitLibrary.syncMode.twoWay") },
                          ]}
                        />
                        <Text size="xs" c="dimmed">
                          {row.syncMode === "pull"
                            ? t("settings.gitLibrary.syncMode.pullDescription")
                            : t("settings.gitLibrary.syncMode.twoWayDescription")}
                        </Text>
                      </Stack>

                      <Stack gap={6}>
                        <Switch
                          checked={row.autoSync}
                          onChange={(event) =>
                            onUpdateRow(row.id, "autoSync", event.currentTarget.checked)
                          }
                          label={t("settings.gitLibrary.autoSync")}
                          description={t("settings.gitLibrary.autoSyncDescription")}
                        />
                        <NumberInput
                          label={t("settings.gitLibrary.syncInterval")}
                          min={1}
                          step={5}
                          allowDecimal={false}
                          disabled={!row.autoSync}
                          value={row.syncIntervalMinutes}
                          error={issue.syncIntervalMinutes ? t(issue.syncIntervalMinutes) : null}
                          onChange={(value) =>
                            onUpdateRow(
                              row.id,
                              "syncIntervalMinutes",
                              typeof value === "number" ? value : Number(value)
                            )
                          }
                        />
                        <Switch
                          checked={row.readOnly}
                          onChange={(event) =>
                            onUpdateRow(row.id, "readOnly", event.currentTarget.checked)
                          }
                          label={t("settings.gitLibrary.readOnly")}
                          description={t("settings.gitLibrary.readOnlyDescription")}
                        />
                      </Stack>

                      {status?.message ? (
                        <Text size="xs" c="dimmed">
                          {status.message}
                        </Text>
                      ) : null}
                      {status && status.localChanges.length > 0 ? (
                        <Text size="xs" c="yellow.7">
                          {t("settings.gitLibrary.localChangeCount", {
                            count: status.localChanges.length,
                          })}
                        </Text>
                      ) : null}

                      <Group gap="sm">
                        <Tooltip
                          label={t("settings.gitLibrary.saveFirst")}
                          disabled={saved}
                          withArrow
                        >
                          <Button
                            size="xs"
                            variant="default"
                            color="gray"
                            loading={busy}
                            disabled={!saved}
                            leftSection={<RefreshCw size={14} />}
                            onClick={() => onSync(row.id)}
                          >
                            {t("settings.gitLibrary.syncNow")}
                          </Button>
                        </Tooltip>
                        {status && gitLibraryHasLocalWork(status.state) ? (
                          <>
                            <Button
                              size="xs"
                              loading={busy}
                              disabled={!saved}
                              onClick={() => onPush(row.id)}
                            >
                              {t("settings.gitLibrary.pushChanges")}
                            </Button>
                            <Button
                              size="xs"
                              variant="light"
                              color="red"
                              loading={busy}
                              disabled={!saved}
                              leftSection={<Trash2 size={14} />}
                              onClick={() => onDiscard(row.id)}
                            >
                              {t("settings.gitLibrary.discardChanges")}
                            </Button>
                          </>
                        ) : null}
                      </Group>
                    </Stack>
                  </Collapse>
                )}
              </Stack>
            </Card>
          );
        })}
      </Stack>

      <Group>
        <Button variant="default" color="gray" leftSection={<Plus size={16} />} onClick={onAddRow}>
          {t("settings.gitLibrary.addLibrary")}
        </Button>
      </Group>
    </Stack>
  );
}

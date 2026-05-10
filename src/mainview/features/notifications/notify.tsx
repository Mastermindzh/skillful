import { notifications as mantineNotifications } from "@mantine/notifications";
import { AlertTriangle, Check, Info, Loader } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Thin wrapper around `@mantine/notifications` so the rest of the app has a single,
 * stable place to fire toasts. Keeps our visual defaults (lucide icons, branded
 * colors, `app-notification` class for e2e selectors) in one spot and lets us swap
 * the renderer later without touching every caller.
 */

export type NotifyVariant = "success" | "error" | "warning" | "info" | "loading";

type VariantPreset = {
  color: string;
  icon: ReactNode;
  autoClose: number | false;
};

const ICON_SIZE = 16;

const VARIANT_PRESETS: Record<NotifyVariant, VariantPreset> = {
  success: { color: "green", icon: <Check size={ICON_SIZE} />, autoClose: 4500 },
  error: { color: "red", icon: <AlertTriangle size={ICON_SIZE} />, autoClose: 6000 },
  warning: { color: "yellow", icon: <AlertTriangle size={ICON_SIZE} />, autoClose: 4500 },
  info: { color: "blue", icon: <Info size={ICON_SIZE} />, autoClose: 4500 },
  loading: { color: "gray", icon: <Loader size={ICON_SIZE} />, autoClose: false },
};

export type NotifyOptions = {
  /** Short bold heading above the message. */
  title?: string;
  /** Override the default auto-close delay. Use `false` to keep the toast open until dismissed. */
  autoClose?: number | false;
  /** Stable id to let callers update an existing toast (e.g. loading -> success). */
  id?: string;
};

/**
 * User-controlled toggle that suppresses `success` toasts. Errors, warnings, info, and loading
 * variants always render regardless. The renderer reads this synchronously so callers don't have
 * to conditionally skip firing.
 */
let suppressSuccess = false;

export function setSuppressSuccessNotifications(next: boolean) {
  suppressSuccess = next;
}

function isSuppressed(variant: NotifyVariant) {
  return suppressSuccess && (variant === "success" || variant === "info");
}

function show(variant: NotifyVariant, message: string, options: NotifyOptions = {}) {
  if (isSuppressed(variant)) return undefined;
  const preset = VARIANT_PRESETS[variant];
  return mantineNotifications.show({
    id: options.id,
    title: options.title,
    message,
    color: preset.color,
    icon: preset.icon,
    autoClose: options.autoClose ?? preset.autoClose,
    withBorder: true,
    classNames: { root: "app-notification" },
  });
}

function update(id: string, variant: NotifyVariant, message: string, options: NotifyOptions = {}) {
  const preset = VARIANT_PRESETS[variant];
  if (isSuppressed(variant)) {
    mantineNotifications.hide(id);
    return;
  }
  mantineNotifications.update({
    id,
    title: options.title,
    message,
    color: preset.color,
    icon: preset.icon,
    autoClose: options.autoClose ?? preset.autoClose,
    withBorder: true,
    classNames: { root: "app-notification" },
    loading: variant === "loading",
  });
}

export const notify = {
  success: (message: string, options?: NotifyOptions) => show("success", message, options),
  error: (message: string, options?: NotifyOptions) => show("error", message, options),
  warning: (message: string, options?: NotifyOptions) => show("warning", message, options),
  info: (message: string, options?: NotifyOptions) => show("info", message, options),
  loading: (message: string, options?: NotifyOptions) => show("loading", message, options),
  update,
  dismiss: (id: string) => mantineNotifications.hide(id),
  clear: () => mantineNotifications.clean(),
};

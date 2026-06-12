import { Indicator, VisuallyHidden } from "@mantine/core";

type DirtyTabLabelProps = {
  label: string;
  dirty: boolean;
  /** Screen-reader-only hint announced when the tab is dirty. */
  hint: string;
};

/**
 * Tab label with a small primary-coloured dot when the tab has unsaved
 * changes. The dot uses Mantine's themed `primary` virtual color so light/dark
 * mode both look right without hard-coding hex values. When dirty, the hint
 * is appended via Mantine's `VisuallyHidden` so screen readers announce it.
 */
export function DirtyTabLabel({ label, dirty, hint }: DirtyTabLabelProps) {
  return (
    <Indicator inline size={6} offset={-6} position="top-end" color="primary" disabled={!dirty}>
      <span>
        {label}
        {dirty ? <VisuallyHidden>{hint}</VisuallyHidden> : null}
      </span>
    </Indicator>
  );
}

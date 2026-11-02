import { Tabs } from "@mantine/core";

type FileTabProps = {
  value: string;
  label: string;
  dirty: boolean;
};

/** One editable file in an editor tab bar, with an unsaved-changes dot. */
export function FileTab({ value, label, dirty }: FileTabProps) {
  return (
    <Tabs.Tab
      value={value}
      className="file-tab"
      classNames={{ tabLabel: "file-tab-label-slot", tabSection: "file-tab-section" }}
      title={label}
      rightSection={dirty ? <span className="dirty-dot" /> : null}
    >
      <span className="file-tab-label">{label}</span>
    </Tabs.Tab>
  );
}

import { appRpc } from "@mainview-bridge";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type EventData, Joyride, STATUS, type Step } from "react-joyride";
import type { AppSettings } from "../../../shared/types";
import { useAppTranslation } from "../../i18n/i18n";

type OnboardingTourProps = {
  appSettings: AppSettings | null;
  blocked: boolean;
  setAppSettings: (settings: AppSettings) => void;
};

export function OnboardingTour({ appSettings, blocked, setAppSettings }: OnboardingTourProps) {
  const { t } = useAppTranslation();
  const [dismissedThisSession, setDismissedThisSession] = useState(false);
  const [run, setRun] = useState(false);
  const savingRef = useRef(false);

  const shouldRun = Boolean(
    appSettings && !appSettings.onboardingTourCompleted && !blocked && !dismissedThisSession
  );

  useEffect(() => {
    setRun(shouldRun);
  }, [shouldRun]);

  const steps = useMemo<Step[]>(
    () => [
      {
        target: '[data-tour="collections"]',
        title: t("onboarding.collections.title"),
        content: t("onboarding.collections.body"),
        placement: "right",
      },
      {
        target: '[data-tour="library-list"]',
        title: t("onboarding.create.title"),
        content: t("onboarding.create.body"),
        placement: "right",
      },
      {
        target: '[data-tour="tools"]',
        title: t("onboarding.tools.title"),
        content: t("onboarding.tools.body"),
        placement: "right",
      },
      {
        target: '[data-tour="library-list"]',
        title: t("onboarding.library.title"),
        content: t("onboarding.library.body"),
        placement: "right",
      },
      {
        target: '[data-tour="library-filters"]',
        title: t("onboarding.filters.title"),
        content: t("onboarding.filters.body"),
        placement: "bottom",
      },
      {
        target: '[data-tour="details-pane"]',
        title: t("onboarding.details.title"),
        content: t("onboarding.details.body"),
        placement: "left",
      },
      {
        target: '[data-tour="file-tabs"]',
        title: t("onboarding.files.title"),
        content: t("onboarding.files.body"),
        placement: "top",
      },
    ],
    [t]
  );

  const completeTour = useCallback(async () => {
    if (!appSettings || savingRef.current) return;
    savingRef.current = true;
    setRun(false);
    setDismissedThisSession(true);
    try {
      const nextSettings = await appRpc.request.setOnboardingTourCompleted({ completed: true });
      setAppSettings(nextSettings);
    } finally {
      savingRef.current = false;
    }
  }, [appSettings, setAppSettings]);

  const handleCallback = useCallback(
    (data: EventData) => {
      if (data.status === STATUS.FINISHED || data.status === STATUS.SKIPPED) {
        void completeTour();
      }
    },
    [completeTour]
  );

  return (
    <Joyride
      continuous
      onEvent={handleCallback}
      options={{
        arrowColor: "var(--app-panel-bg)",
        backgroundColor: "var(--app-panel-bg)",
        buttons: ["back", "skip", "primary"],
        overlayClickAction: false,
        overlayColor: "rgba(15, 12, 22, 0.62)",
        primaryColor: "var(--mantine-primary-color-filled)",
        scrollOffset: 96,
        showProgress: true,
        skipBeacon: true,
        spotlightPadding: 8,
        textColor: "var(--app-panel-fg)",
        width: 420,
        zIndex: 10000,
      }}
      run={run}
      steps={steps}
      locale={{
        back: t("onboarding.back"),
        close: t("onboarding.close"),
        last: t("onboarding.done"),
        next: t("onboarding.next"),
        skip: t("onboarding.skip"),
      }}
      styles={{
        tooltip: {
          borderRadius: 16,
          boxShadow: "0 24px 80px rgba(0, 0, 0, 0.24)",
          fontFamily: "var(--mantine-font-family)",
          maxWidth: "calc(100vw - 48px)",
        },
        tooltipTitle: {
          fontSize: 20,
          fontWeight: 800,
        },
      }}
    />
  );
}

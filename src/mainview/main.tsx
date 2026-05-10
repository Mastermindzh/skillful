import { createTheme, MantineProvider, virtualColor } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "./index.css";
import App from "./App";
import "./i18n/i18n";

const theme = createTheme({
  fontFamily: '"Ubuntu Sans Variable", "Segoe UI", sans-serif',
  headings: {
    fontFamily: '"Ubuntu Sans Variable", "Segoe UI", sans-serif',
  },
  colors: {
    ember: [
      "#fff1e4",
      "#f9dcc1",
      "#f2c49a",
      "#ebab71",
      "#e59753",
      "#e0883f",
      "#de8033",
      "#c66d24",
      "#b15f1b",
      "#9a5010",
    ],
    amethyst: [
      "#f3edfa",
      "#e2d5f2",
      "#cbadea",
      "#b386e1",
      "#9c64d8",
      "#8549cc",
      "#6c3cb4",
      "#582ca0",
      "#481f8a",
      "#381574",
    ],
    primary: virtualColor({
      name: "primary",
      dark: "ember",
      light: "amethyst",
    }),
  },
  primaryColor: "primary",
  primaryShade: { light: 6, dark: 5 },
  defaultRadius: "md",
});

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element #root was not found.");
}

createRoot(rootElement).render(
  <StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <Notifications position="bottom-right" zIndex={1000} />
      <App />
    </MantineProvider>
  </StrictMode>
);

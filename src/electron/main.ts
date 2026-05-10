import path from "node:path";
import { app, BrowserWindow, dialog, ipcMain, type OpenDialogOptions, shell } from "electron";
import { createDesktopRuntime, type DesktopRequestHandlers } from "../desktop/runtime";
import { logger } from "../main/logger";
import { measureAsync, perfEnabled } from "../main/performance";
import { settingsDirectory } from "../main/settings";
import { findSkillfulDeepLink, parseSkillfulImportDeepLink } from "../shared/deepLinks";
import { AppError } from "../shared/errors";
import type { GitHubImportDraft } from "../shared/githubImport";
import type { AppRPC } from "../shared/rpc";
import { wrapRequestHandlersWithAppErrorEncoding } from "../shared/rpcAdapter";
import type { LibraryItemSummary } from "../shared/types";
import type { UpdateStatusEntry } from "../shared/updates";
import { electronUpdater } from "./updater";
import {
  createWindowStateSaver,
  loadWindowState,
  MIN_WINDOW_HEIGHT,
  MIN_WINDOW_WIDTH,
} from "./windowState";

type RequestName = keyof AppRPC["bun"]["requests"];

let mainWindow: BrowserWindow | null = null;
let pendingGitHubImport: GitHubImportDraft | null = null;
let rendererReady = false;

const gotSingleInstanceLock = app.requestSingleInstanceLock();

function iconPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "assets", "icons", "app-icon.png")
    : path.join(process.cwd(), "assets", "icons", "app-icon.png");
}

function rendererIndexPath() {
  return path.join(app.getAppPath(), "dist", "index.html");
}

function preloadPath() {
  return path.join(__dirname, "preload.cjs");
}

function sendRendererMessage<K extends keyof AppRPC["bun"]["messages"]>(
  name: K,
  payload: AppRPC["bun"]["messages"][K]
) {
  mainWindow?.webContents.send("skillful:message", name, payload);
}

function sendLibraryItemsUpdated(libraryItems: LibraryItemSummary[], reason: string) {
  sendRendererMessage("libraryItemsUpdated", { libraryItems, reason });
}

function sendUpdateStatusChanged(entry: UpdateStatusEntry) {
  sendRendererMessage("updateStatusChanged", entry);
}

function sendGitHubImportRequested(payload: GitHubImportDraft) {
  sendRendererMessage("githubImportRequested", payload);
}

function focusMainWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.focus();
}

function flushPendingGitHubImport() {
  if (!rendererReady || !pendingGitHubImport) return;
  sendGitHubImportRequested(pendingGitHubImport);
  pendingGitHubImport = null;
}

function queueGitHubImportDraft(draft: GitHubImportDraft) {
  pendingGitHubImport = draft;
  focusMainWindow();
  flushPendingGitHubImport();
}

function handleDeepLinkUrl(urlString: string) {
  const draft = parseSkillfulImportDeepLink(urlString);
  queueGitHubImportDraft(draft);
}

function registerDeepLinkProtocol() {
  if (app.isPackaged) {
    app.setAsDefaultProtocolClient("skillful");
    return;
  }

  if (process.defaultApp && process.argv[1]) {
    app.setAsDefaultProtocolClient("skillful", process.execPath, [path.resolve(process.argv[1])]);
  }
}

async function createWindow() {
  const state = await loadWindowState();
  const window = new BrowserWindow({
    title: "Skillful",
    width: state.width,
    height: state.height,
    ...(typeof state.x === "number" ? { x: state.x } : {}),
    ...(typeof state.y === "number" ? { y: state.y } : {}),
    minWidth: MIN_WINDOW_WIDTH,
    minHeight: MIN_WINDOW_HEIGHT,
    icon: iconPath(),
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: preloadPath(),
    },
  });

  window.setMenuBarVisibility(false);
  const windowStateSaver = createWindowStateSaver(window);
  windowStateSaver.flush();

  mainWindow = window;
  rendererReady = false;

  const shouldUseDevServer = !app.isPackaged && process.env.SKILLFUL_ELECTRON_LOAD_FILE !== "1";
  const devServerUrl =
    process.env.VITE_DEV_SERVER_URL ?? (shouldUseDevServer ? "http://127.0.0.1:5173" : null);
  if (devServerUrl) {
    void window.loadURL(devServerUrl);
    if (process.env.SKILLFUL_ELECTRON_DEVTOOLS === "1") {
      window.webContents.openDevTools({ mode: "detach" });
    }
  } else {
    void window.loadFile(rendererIndexPath());
  }

  window.webContents.once("did-finish-load", () => {
    if (mainWindow !== window) return;
    rendererReady = true;
    flushPendingGitHubImport();
  });

  window.on("closed", () => {
    if (mainWindow === window) {
      mainWindow = null;
      rendererReady = false;
    }
  });

  window.on("close", () => {
    windowStateSaver.flush();
  });

  window.on("resize", () => {
    windowStateSaver.schedule();
  });

  window.on("move", () => {
    windowStateSaver.schedule();
  });
}

async function pickDirectory() {
  const options: OpenDialogOptions = { properties: ["openDirectory"] };
  const result = mainWindow
    ? await dialog.showOpenDialog(mainWindow, options)
    : await dialog.showOpenDialog(options);
  return result.canceled ? null : (result.filePaths[0] ?? null);
}

async function pickFile(allowedFileTypes = "*") {
  const filters =
    allowedFileTypes === "zip"
      ? [{ name: "Skillful collection archives", extensions: ["zip"] }]
      : undefined;
  const options: OpenDialogOptions = { filters, properties: ["openFile"] };
  const result = mainWindow
    ? await dialog.showOpenDialog(mainWindow, options)
    : await dialog.showOpenDialog(options);
  return result.canceled ? null : (result.filePaths[0] ?? null);
}

function registerIpcHandlers(handlers: DesktopRequestHandlers) {
  const encodedHandlers = wrapRequestHandlersWithAppErrorEncoding(handlers);

  ipcMain.handle("skillful:request", async (_event, name: RequestName, params: unknown) => {
    const handler = encodedHandlers[name];
    if (!handler) {
      throw new Error(`Unknown Skillful request: ${String(name)}`);
    }
    const runHandler = () => (handler as (params?: unknown) => Promise<unknown>)(params);
    return perfEnabled()
      ? await measureAsync(`rpc.${String(name)}`, runHandler)
      : await runHandler();
  });
}

function registerAppLifecycleHandlers() {
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
      return;
    }
    focusMainWindow();
  });

  app.on("second-instance", (_event, argv) => {
    focusMainWindow();
    const deepLink = findSkillfulDeepLink(argv);
    if (!deepLink) return;
    try {
      handleDeepLinkUrl(deepLink);
    } catch (error) {
      logger.error("Failed to handle Skillful deep link", error);
    }
  });

  app.on("open-url", (event, url) => {
    event.preventDefault();
    try {
      handleDeepLinkUrl(url);
    } catch (error) {
      logger.error("Failed to handle Skillful deep link", error);
    }
  });
}

async function start() {
  if (!gotSingleInstanceLock) {
    app.quit();
    return;
  }

  app.setPath("userData", path.join(settingsDirectory(), "electron"));
  registerDeepLinkProtocol();
  registerAppLifecycleHandlers();
  logger.watch(ipcMain);
  await app.whenReady();

  const runtime = await createDesktopRuntime({
    pickDirectory,
    pickFile,
    sendLibraryItemsUpdated,
    sendUpdateStatusChanged,
    shell: {
      openPath: async (target) => {
        // `shell.openPath` resolves with an empty string on success and an error string on
        // failure: normalise that into a thrown Error so the renderer surfaces it.
        const errorMessage = await shell.openPath(path.resolve(target));
        if (errorMessage) {
          throw new Error(errorMessage);
        }
      },
      revealPath: async (target) => {
        shell.showItemInFolder(path.resolve(target));
      },
    },
    updater: electronUpdater,
  });

  registerIpcHandlers(runtime.handlers);
  await createWindow();
  await runtime.startWatching();

  const initialDeepLink = findSkillfulDeepLink(process.argv);
  if (initialDeepLink) {
    handleDeepLinkUrl(initialDeepLink);
  }
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

void start().catch((error) => {
  if (error instanceof AppError) {
    logger.error("Failed to start Skillful", {
      message: error.message,
      details: error.details ?? {},
    });
  } else {
    logger.error("Failed to start Skillful", error);
  }
  app.quit();
});

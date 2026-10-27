import path from "node:path";
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  type OpenDialogOptions,
  session,
  shell,
  Tray,
} from "electron";
import { createDesktopRuntime, type DesktopRequestHandlers } from "../desktop/runtime";
import { logger } from "../main/logger";
import { measureAsync, perfEnabled } from "../main/performance";
import { settingsDirectory } from "../main/settings";
import { findSkillfulDeepLink, parseSkillfulImportDeepLink } from "../shared/deepLinks";
import { AppError } from "../shared/errors";
import type { GitHubImportDraft } from "../shared/githubImport";
import type { AppRPC } from "../shared/rpc";
import { wrapRequestHandlersWithAppErrorEncoding } from "../shared/rpcAdapter";
import type { GitBackupResult, GitLibrarySyncResult, LibraryItemSummary } from "../shared/types";
import type { UpdateStatusEntry } from "../shared/updates";
import { checkForUpdatesAfterStartup, electronUpdater } from "./updater";
import {
  createWindowStateSaver,
  loadWindowState,
  MIN_WINDOW_HEIGHT,
  MIN_WINDOW_WIDTH,
} from "./windowState";

type RequestName = keyof AppRPC["bun"]["requests"];

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let pendingGitHubImport: GitHubImportDraft | null = null;
let rendererReady = false;
let isQuitting = false;
let minimizeToTrayOnClose = false;

const gotSingleInstanceLock = app.requestSingleInstanceLock();

function applyLinuxPackageCompatibilitySwitches() {
  if (process.env.APPIMAGE) {
    // AppImage mounts cannot guarantee a root-owned 4755 chrome-sandbox helper.
    // Without this, Electron aborts on systems without user namespace sandbox support.
    app.commandLine.appendSwitch("no-sandbox");
  }
}

/**
 * return the path of an icon in the assets/icon folder given a file
 * @param fileName name of icon in assets/icon
 * @returns path with ${path}/assets/icons/{fileName}
 */
function iconAssetPath(fileName: string) {
  return app.isPackaged
    ? path.join(process.resourcesPath, "assets", "icons", fileName)
    : path.join(process.cwd(), "assets", "icons", fileName);
}

function iconPath() {
  return iconAssetPath("app-icon.png");
}

function trayIcon() {
  if (process.platform !== "darwin") return iconPath();
  return iconAssetPath("icon-18.png");
}

function rendererIndexPath() {
  return path.join(app.getAppPath(), "dist", "index.html");
}

function resolveDevServerUrl() {
  const shouldUseDevServer = !app.isPackaged && process.env.SKILLFUL_ELECTRON_LOAD_FILE !== "1";
  return process.env.VITE_DEV_SERVER_URL ?? (shouldUseDevServer ? "http://127.0.0.1:5173" : null);
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

function sendAutoGitBackupCompleted(result: GitBackupResult) {
  sendRendererMessage("autoGitBackupCompleted", result);
}

function sendGitLibrarySynced(result: GitLibrarySyncResult) {
  sendRendererMessage("gitLibrarySynced", result);
}

function sendGitHubImportRequested(payload: GitHubImportDraft) {
  sendRendererMessage("githubImportRequested", payload);
}

function focusMainWindow() {
  if (!mainWindow) return;
  if (!mainWindow.isVisible()) {
    mainWindow.show();
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.focus();
}

function setMinimizeToTrayOnClose(enabled: boolean) {
  minimizeToTrayOnClose = enabled;
}

function hideMainWindowToTray() {
  mainWindow?.hide();
}

function toggleMainWindowVisibility() {
  if (!mainWindow) {
    void createWindow();
    return;
  }
  if (mainWindow.isVisible()) {
    hideMainWindowToTray();
    return;
  }
  focusMainWindow();
}

function quitApp() {
  isQuitting = true;
  app.quit();
}

function createTray() {
  if (tray) return tray;
  const nextTray = new Tray(trayIcon());
  const contextMenu = Menu.buildFromTemplate([
    { label: "Show Skillful", click: focusMainWindow },
    { label: "Hide to tray", click: hideMainWindowToTray },
    { type: "separator" },
    { label: "Quit Skillful", click: quitApp },
  ]);
  nextTray.setToolTip("Skillful");
  if (process.platform === "darwin") {
    nextTray.on("right-click", () => nextTray.popUpContextMenu(contextMenu));
  } else {
    nextTray.setContextMenu(contextMenu);
  }
  nextTray.on("click", toggleMainWindowVisibility);
  tray = nextTray;
  return tray;
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

/**
 * Installs a Content-Security-Policy on every response so a sanitizer bypass or supply-chain
 * script injection cannot reach a remote origin. The renderer never talks to the network
 * directly (all I/O is brokered through the typed RPC), so `connect-src` stays `'self'` in
 * production and only opens up to the Vite dev server / HMR socket during development.
 */
function applyContentSecurityPolicy(devServerUrl: string | null) {
  const isDev = Boolean(devServerUrl);
  const scriptSrc = isDev ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'" : "script-src 'self'";
  const connectSrc = isDev
    ? "connect-src 'self' ws: http://127.0.0.1:5173 http://localhost:5173"
    : "connect-src 'self'";
  const policy = [
    "default-src 'self'",
    scriptSrc,
    // Mantine and CodeMirror inject inline styles, so 'unsafe-inline' is required for styles.
    "style-src 'self' 'unsafe-inline'",
    // Allow data:/https: images so skill markdown can render embedded and remote images.
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    connectSrc,
    "object-src 'none'",
    "base-uri 'none'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
  ].join("; ");

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [policy],
      },
    });
  });
}

/**
 * Locks navigation down to the app's own renderer. Any attempt to navigate the main frame
 * elsewhere, or to open a new window, is blocked; vetted external https links are handed to
 * the OS browser instead of loading inside the Electron context.
 */
function applyWebContentsSecurity(window: BrowserWindow, devServerUrl: string | null) {
  const allowedOrigin = devServerUrl ? new URL(devServerUrl).origin : null;

  const isInternalNavigation = (target: string) => {
    let url: URL;
    try {
      url = new URL(target);
    } catch {
      return false;
    }
    if (url.protocol === "file:") return true;
    return allowedOrigin !== null && url.origin === allowedOrigin;
  };

  const openExternalIfHttps = (target: string) => {
    if (/^https:\/\//i.test(target)) {
      void shell.openExternal(target);
    }
  };

  window.webContents.on("will-navigate", (event, target) => {
    if (isInternalNavigation(target)) return;
    event.preventDefault();
    openExternalIfHttps(target);
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    openExternalIfHttps(url);
    return { action: "deny" };
  });
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
    ...(process.platform === "darwin" ? { titleBarStyle: "hiddenInset" as const } : {}),
    icon: iconPath(),
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: preloadPath(),
    },
  });

  window.setMenuBarVisibility(false);
  const windowStateSaver = createWindowStateSaver(window);
  windowStateSaver.flush();

  mainWindow = window;
  rendererReady = false;

  const devServerUrl = resolveDevServerUrl();
  applyWebContentsSecurity(window, devServerUrl);
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

  window.on("close", (event) => {
    windowStateSaver.flush();
    if (!isQuitting && minimizeToTrayOnClose) {
      event.preventDefault();
      hideMainWindowToTray();
    }
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

  app.on("before-quit", () => {
    isQuitting = true;
  });
}

async function start() {
  if (!gotSingleInstanceLock) {
    app.quit();
    return;
  }

  applyLinuxPackageCompatibilitySwitches();
  app.setPath("userData", path.join(settingsDirectory(), "electron"));
  registerDeepLinkProtocol();
  registerAppLifecycleHandlers();
  logger.watch(ipcMain);
  await app.whenReady();
  applyContentSecurityPolicy(resolveDevServerUrl());
  createTray();

  const runtime = await createDesktopRuntime({
    pickDirectory,
    pickFile,
    sendLibraryItemsUpdated,
    sendUpdateStatusChanged,
    sendAutoGitBackupCompleted,
    sendGitLibrarySynced,
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
      setMinimizeToTrayOnClose,
    },
    updater: electronUpdater,
  });

  registerIpcHandlers(runtime.handlers);
  app.once("before-quit", () => runtime.dispose());
  await createWindow();
  checkForUpdatesAfterStartup();
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

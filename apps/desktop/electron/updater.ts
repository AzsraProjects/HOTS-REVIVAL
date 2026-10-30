/**
 * Mises à jour : vérifie les versions publiées dans les Releases GitHub, télécharge
 * et installe sur demande (bouton « Mettre à jour ») sans réinstallation manuelle.
 */
import { app, BrowserWindow } from "electron";
import { autoUpdater } from "electron-updater";
import { t } from "./i18n";

export interface UpdateStatus {
  state: "idle" | "checking" | "available" | "none" | "downloading" | "ready" | "error";
  current: string;
  version?: string;
  percent?: number;
  message?: string;
}

let status: UpdateStatus = { state: "idle", current: app.getVersion() };
let target: BrowserWindow | null = null;

function emit(next: Partial<UpdateStatus>): void {
  status = { ...status, ...next, current: app.getVersion() };
  target?.webContents.send("updater:status", status);
}

export function initUpdater(win: BrowserWindow): void {
  target = win;
  if (!app.isPackaged) return; // pas de mise à jour en développement
  autoUpdater.autoDownload = false;
  // Versions publiques (1.x) : jamais de pré-version, sinon un build de test plus récent (0.2.x)
  // masque la dernière version publique.
  autoUpdater.allowPrerelease = app.getVersion().startsWith("0.");
  autoUpdater.on("checking-for-update", () => emit({ state: "checking" }));
  autoUpdater.on("update-available", (info) => emit({ state: "available", version: info.version }));
  autoUpdater.on("update-not-available", () => emit({ state: "none" }));
  autoUpdater.on("download-progress", (p) => emit({ state: "downloading", percent: Math.round(p.percent) }));
  autoUpdater.on("update-downloaded", (info) => emit({ state: "ready", version: info.version }));
  autoUpdater.on("error", (err) => emit({ state: "error", message: String(err?.message ?? err) }));
  setTimeout(() => void checkForUpdates(), 5_000);
  setInterval(() => void checkForUpdates(), 30 * 60 * 1000);
}

export async function checkForUpdates(): Promise<UpdateStatus> {
  if (!app.isPackaged) return { ...status, state: "none", message: t("Mode développement") };
  try {
    await autoUpdater.checkForUpdates();
  } catch (err) {
    emit({ state: "error", message: String((err as Error)?.message ?? err) });
  }
  return status;
}

export async function downloadUpdate(): Promise<void> {
  emit({ state: "downloading", percent: 0 });
  await autoUpdater.downloadUpdate();
}

export function installUpdate(): void {
  // Redémarre l'application sur la nouvelle version (installation silencieuse).
  autoUpdater.quitAndInstall(true, true);
}

export function getUpdateStatus(): UpdateStatus {
  return status;
}

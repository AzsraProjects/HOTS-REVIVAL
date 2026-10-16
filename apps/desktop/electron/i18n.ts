/**
 * Langue de l'application (FR / EN), partagée par Electron, les fenêtres et le backend.
 *
 * Source unique : `language` dans settings.json (dossier de données commun avec le backend).
 * Premier lancement : langue choisie dans l'installeur (registre, voir build/installer.nsh),
 * sinon langue du système. Le français est la langue source : t("Texte français").
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { app, BrowserWindow } from "electron";
import { EN } from "./en";

export type Lang = "fr" | "en";
let current: Lang = "fr";

/** Dossier de données partagé avec le backend (HOTS_DATA_DIR, sinon %APPDATA%\HOTS REVIVAL). */
export function dataDir(): string {
  if (process.env.HOTS_DATA_DIR) return process.env.HOTS_DATA_DIR;
  if (app.isPackaged) return app.getPath("userData");
  return path.join(process.env.APPDATA ?? app.getPath("appData"), "HOTS REVIVAL");
}

const settingsFile = () => path.join(dataDir(), "settings.json");

function readSettings(): Record<string, unknown> {
  try {
    return JSON.parse(fs.readFileSync(settingsFile(), "utf-8"));
  } catch {
    return {};
  }
}

function writeLanguage(lang: Lang): void {
  const file = settingsFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ ...readSettings(), language: lang }, null, 2));
  fs.renameSync(tmp, file);
}

/** Langue choisie dans l'installeur NSIS (LCID : 1036 = français). */
function installerLanguage(): Lang | null {
  if (process.platform !== "win32") return null;
  try {
    const out = execFileSync("reg", ["query", "HKCU\\Software\\HOTS REVIVAL", "/v", "InstallerLanguage"], {
      encoding: "utf-8", windowsHide: true, stdio: ["ignore", "pipe", "ignore"],
    });
    const lcid = /InstallerLanguage\s+REG_\w+\s+(\d+)/.exec(out)?.[1];
    return lcid ? (lcid === "1036" ? "fr" : "en") : null;
  } catch {
    return null;
  }
}

/** À appeler au démarrage, avant de lancer le backend et d'ouvrir les fenêtres. */
export function initLanguage(): Lang {
  const saved = readSettings().language;
  if (saved === "fr" || saved === "en") {
    current = saved;
  } else {
    current = installerLanguage() ?? (app.getLocale().toLowerCase().startsWith("fr") ? "fr" : "en");
    try {
      writeLanguage(current);
    } catch (err) {
      console.error("[i18n] impossible d'enregistrer la langue :", err);
    }
  }
  return current;
}

export const getLanguage = (): Lang => current;

/** Changement depuis les Paramètres : persiste et prévient toutes les fenêtres (overlay compris). */
export function setLanguage(lang: Lang): Lang {
  current = lang === "en" ? "en" : "fr";
  try {
    writeLanguage(current);
  } catch (err) {
    console.error("[i18n] impossible d'enregistrer la langue :", err);
  }
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send("app:language", current);
  return current;
}

/** t("Texte français", { n: 3 }) : traduction des textes du processus principal. */
export function t(fr: string, vars?: Record<string, string | number>): string {
  let text = current === "en" ? EN[fr] ?? fr : fr;
  if (vars) for (const [k, v] of Object.entries(vars)) text = text.split(`{${k}}`).join(String(v));
  return text;
}

/**
 * Raccourcis globaux. Ils ne pilotent QUE l'overlay HOTS REVIVAL :
 * aucune touche n'est envoyée au jeu (pas de macro, pas d'automatisation).
 */
import { globalShortcut } from "electron";
import { BACKEND_URL } from "./backend";
import { t } from "./i18n";
import { say, toggleInteractive, toggleOverlay } from "./overlay";
import { rememberCapture } from "./screenReader";

async function post(path: string, body: unknown = {}): Promise<void> {
  try {
    await fetch(`${BACKEND_URL}/api/live/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.warn("[shortcut] backend indisponible", err);
  }
}

export const SHORTCUTS: Record<string, { label: string; run: () => void }> = {
  "CommandOrControl+Shift+O": { get label() { return t("Afficher / masquer l'overlay"); }, run: () => toggleOverlay() },
  "CommandOrControl+Shift+I": { get label() { return t("Overlay interactif (clics)"); }, run: () => toggleInteractive() },
  "CommandOrControl+Shift+S": { get label() { return t("Synchroniser l'horloge sur 0:00"); }, run: () => post("sync", { clock_s: 0 }) },
  "CommandOrControl+Shift+PageUp": { get label() { return t("Niveau allié +1"); }, run: () => post("levels", { ally_delta: 1 }) },
  "CommandOrControl+Shift+PageDown": { get label() { return t("Niveau adverse +1"); }, run: () => post("levels", { enemy_delta: 1 }) },
  "CommandOrControl+Shift+J": { get label() { return t("Objectif terminé"); }, run: () => post("objective-done") },
  "CommandOrControl+Shift+K": { get label() { return t("Capturer l'écran pour calibrer la lecture"); }, run: () => {
      void rememberCapture().then((r) =>
        say(r === "ok" ? t("Capture enregistrée. Ouvrez les paramètres pour placer les zones.")
          : r === "black" ? t("La capture est noire : le plein écran exclusif bloque la lecture de l'écran.")
          : t("Capture impossible.")));
    },
  },
};

export function registerShortcuts(): void {
  for (const [accelerator, { run }] of Object.entries(SHORTCUTS)) {
    if (!globalShortcut.register(accelerator, run)) console.warn("[shortcut] indisponible :", accelerator);
  }
}

export function unregisterShortcuts(): void {
  globalShortcut.unregisterAll();
}

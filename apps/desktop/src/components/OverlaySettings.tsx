import { useEffect, useState } from "react";
import { bridge, type OverlayPrefs } from "../lib/bridge";
import { t } from "../lib/i18n";

/** Mode partie : écran où s'affiche l'application au chargement d'une partie, et overlay optionnel. */
export function OverlaySettings() {
  const b = bridge();
  const [prefs, setPrefs] = useState<OverlayPrefs | null>(null);
  const [displays, setDisplays] = useState<{ id: number; label: string }[]>([]);

  useEffect(() => {
    void b?.prefs.get().then(setPrefs);
    void b?.prefs.displays().then(setDisplays);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!b || !prefs) return null;
  const update = async (next: Partial<OverlayPrefs>) => setPrefs(await b.prefs.set(next));

  return (
    <div className="space-y-4 text-sm">
      <div className="space-y-1">
        <label className="flex items-center gap-3">
          <span>{t("Écran du mode partie")}</span>
          <select value={prefs.gameDisplayId ?? ""} onChange={(e) => void update({ gameDisplayId: e.target.value ? Number(e.target.value) : null })}>
            <option value="">{t("Ne pas déplacer la fenêtre")}</option>
            {displays.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
        </label>
        <p className="text-xs text-slate-400">
          {t("Au chargement d'une partie, l'application s'affiche sur cet écran (idéal : votre second écran), sans prendre le focus du jeu.")}
        </p>
      </div>
      <div className="space-y-1 border-t border-void-700 pt-3">
        <label className="flex items-center gap-3">
          <input type="checkbox" checked={prefs.overlay} onChange={(e) => void update({ overlay: e.target.checked })} />
          <span>{t("Afficher aussi l'overlay par-dessus le jeu (nécessite le mode « Plein écran fenêtré »)")}</span>
        </label>
        {prefs.overlay && (
          <label className="flex items-center gap-3">
            <span>{t("Écran de l'overlay")}</span>
            <select value={prefs.displayId ?? ""} onChange={(e) => void update({ displayId: e.target.value ? Number(e.target.value) : null })}>
              <option value="">{t("Écran principal")}</option>
              {displays.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </label>
        )}
        <p className="text-xs text-slate-400">
          {t("Sans overlay, l'écran « Partie en cours » s'ouvre tout seul dans l'application au chargement d'une partie (consultable sur un second écran ou d'un Alt+Tab), et la voix vous guide en jeu.")}
        </p>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { OverlayPanel } from "../components/OverlayPanel";
import { Card, List } from "../components/ui";
import { useAsync } from "../hooks/useAsync";
import { useLive } from "../hooks/useLive";
import { api } from "../lib/api";
import { bridge } from "../lib/bridge";
import { t } from "../lib/i18n";

/** Page de contrôle / aperçu de l'overlay dans la fenêtre principale. */
export function LiveControl() {
  const { state, setState } = useLive();
  const heroes = useAsync(api.heroes);
  const maps = useAsync(api.maps);
  const [shortcuts, setShortcuts] = useState<Record<string, string>>({});

  useEffect(() => {
    void bridge()?.shortcuts().then(setShortcuts);
  }, []);

  return (
    <div className="grid grid-cols-[360px_1fr] gap-6">
      <div>
        <h1 className="title-display mb-4 text-3xl">Overlay</h1>
        <div className="rounded-xl bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22><rect width=%2240%22 height=%2240%22 fill=%22%23151935%22/><path d=%22M0 40L40 0%22 stroke=%22%231e2347%22/></svg>')] p-3">
          <OverlayPanel state={state} interactive preview heroes={heroes.data ?? []} maps={maps.data ?? []} onState={setState} />
        </div>
      </div>
      <div className="space-y-4 pt-14">
        <Card title={t("Fonctionnement")}>
          <List items={[
            t("Automatique : lancement et fermeture du jeu, chargement d'une partie, carte, fin de partie (l'overlay se vide tout seul)."),
            t("Les timers d'objectifs sont mesurés sur vos propres replays (ou sur des replays de référence)."),
            t("Horloge et niveaux d'équipe : lecture de l'écran (à activer dans Paramètres) ou raccourcis clavier."),
            t("Le build affiché vient d'Icy Veins pour votre héros, à défaut de vos replays."),
            t("Lancez le jeu en mode « Plein écran fenêtré » pour que l'overlay soit visible."),
          ]} />
        </Card>
        <Card title={t("Raccourcis (n'envoient aucune touche au jeu)")}>
          {Object.keys(shortcuts).length ? (
            <table className="w-full text-sm">
              <tbody>
                {Object.entries(shortcuts).map(([k, v]) => (
                  <tr key={k} className="border-t border-void-700"><td className="py-1.5 font-mono text-gold-300">{k.replace("CommandOrControl", "Ctrl")}</td><td>{v}</td></tr>
                ))}
              </tbody>
            </table>
          ) : <p className="text-sm text-slate-500">{t("Disponibles dans l'application desktop.")}</p>}
        </Card>
        <Card title={t("Conformité")}>
          <p className="text-sm text-slate-300">
            {t("L'overlay est une fenêtre indépendante : il ne lit pas la mémoire du jeu, n'injecte rien, ne révèle pas le brouillard de guerre et n'automatise aucune action. Les informations affichées sont publiques ou saisies par vous.")}
          </p>
        </Card>
      </div>
    </div>
  );
}

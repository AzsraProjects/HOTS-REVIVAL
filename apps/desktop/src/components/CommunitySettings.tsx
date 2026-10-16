import { useState } from "react";
import { useAsync } from "../hooks/useAsync";
import { api } from "../lib/api";
import type { CommunityStatus } from "../lib/types";
import { Card } from "./ui";

/** Plateforme communautaire : partage volontaire des parties et profil public. */
export function CommunitySettings() {
  const status = useAsync(api.community.status);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<CommunityStatus>, done?: string) => {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const r = await action();
      status.setData(r);
      setMessage(r.notice ?? done ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const s = status.data;
  if (!s) return null;

  return (
    <Card title="Communauté HOTS REVIVAL">
      {!s.available ? (
        <p className="text-sm text-slate-400">
          La plateforme communautaire arrive bientôt : statistiques de tous les joueurs HOTS REVIVAL et profils publics.
        </p>
      ) : (
        <div className="space-y-3 text-sm">
          <label className="flex items-start gap-3">
            <input type="checkbox" className="mt-1" checked={s.share_matches} disabled={busy}
              onChange={(e) => void run(() => api.community.update({ share_matches: e.target.checked }))} />
            <span>
              Partager mes parties pour alimenter les statistiques communautaires
              <span className="block text-xs text-slate-500">
                Seul un résumé est envoyé (héros, carte, résultat, talents, statistiques de fin de partie). Ni replay, ni chat,
                ni pseudo : les comptes des 10 joueurs sont rendus anonymes par le serveur.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3">
            <input type="checkbox" className="mt-1" checked={s.public_profile} disabled={busy || !s.share_matches}
              onChange={(e) => void run(() => api.community.update({ public_profile: e.target.checked }))} />
            <span>
              Rendre mon profil public sur le site
              <span className="block text-xs text-slate-500">
                Votre BattleTag, vos héros et vos dernières parties deviennent visibles par tous. Les autres joueurs de vos
                parties n'apparaissent jamais par leur nom.
              </span>
            </span>
          </label>

          {s.share_matches && (
            <div className="text-xs text-slate-400">
              {s.sent} partie(s) partagée(s){s.pending ? ` · ${s.pending} en attente d'envoi` : ""}
              {s.rejected ? ` · ${s.rejected} refusée(s) par le serveur` : ""}
              {s.last_error && <span className="text-amber-300"> · {s.last_error}</span>}
            </div>
          )}
          {s.profile_slug && <div className="text-xs text-gold-300">Profil public : {s.profile_slug}</div>}
          {message && <div className="text-emerald-300">{message}</div>}
          {error && <div className="text-rose-300">{error}</div>}

          {s.registered && (
            <button className="btn-ghost" disabled={busy}
              onClick={() => {
                if (confirm("Supprimer votre profil et tout lien entre vous et vos parties sur la plateforme ?")) {
                  void run(api.community.deleteMe, "Vos données communautaires ont été supprimées.");
                }
              }}>
              Supprimer mes données communautaires
            </button>
          )}
        </div>
      )}
    </Card>
  );
}

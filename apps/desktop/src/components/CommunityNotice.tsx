import { useEffect, useState } from "react";
import { useAsync } from "../hooks/useAsync";
import { api } from "../lib/api";
import { t } from "../lib/i18n";

/**
 * Premier lancement : informe que le partage communautaire est actif par défaut.
 * L'affichage vaut information (le backend n'envoie rien avant) ; le joueur peut couper aussitôt.
 */
export function CommunityNotice() {
  const status = useAsync(api.community.status);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const s = status.data;

  useEffect(() => {
    if (s && s.available && s.share_matches && !s.notice_seen) {
      setOpen(true);
      void api.community.update({ community_notice_seen: true });
    }
  }, [s]);

  if (message) {
    return (
      <div className="mb-6 flex items-center gap-4 rounded-xl border border-void-700 bg-void-850 px-5 py-3 text-sm text-slate-300">
        <span className="flex-1">{message}</span>
        <button className="text-slate-400 hover:text-white" onClick={() => setMessage(null)} aria-label={t("Fermer")}>✕</button>
      </div>
    );
  }
  if (!open) return null;

  return (
    <div className="mb-6 flex items-center gap-4 rounded-xl border border-storm-500/50 bg-gradient-to-r from-storm-700/30 to-void-850 px-5 py-4">
      <span className="text-2xl text-storm-300">◈</span>
      <div className="flex-1">
        <div className="font-semibold text-white">{t("Vos parties alimentent les statistiques communautaires")}</div>
        <div className="text-xs text-slate-400">
          {t("Pour faire vivre les tier lists du site, un résumé de chaque partie est partagé : héros, carte, résultat, talents, statistiques. Jamais le replay, le chat ni les pseudos. Le profil public reste désactivé.")}
        </div>
      </div>
      <button className="btn-ghost" onClick={async () => {
        await api.community.update({ share_matches: false });
        setOpen(false);
        setMessage(t("Partage désactivé. Vous pouvez le réactiver dans les Paramètres."));
      }}>
        {t("Désactiver le partage")}
      </button>
      <button className="btn-gold" onClick={() => setOpen(false)}>{t("C'est noté")}</button>
    </div>
  );
}

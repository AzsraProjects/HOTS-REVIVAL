import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { bridge } from "../lib/bridge";
import { CHANGELOG, compareVersions, type ChangelogEntry } from "../lib/changelog";
import { lang, locale, t } from "../lib/i18n";

const SEEN_KEY = "hots.lastSeenVersion";
// Dernière version sans notes de mise à jour : référence pour les joueurs qui viennent d'avant.
const BASELINE = "1.0.1";

function readSeen(): string | null {
  try { return localStorage.getItem(SEEN_KEY); } catch { return null; }
}
function writeSeen(version: string): void {
  try { localStorage.setItem(SEEN_KEY, version); } catch { /* stockage indisponible : notes réaffichées */ }
}

/** Nouveautés : fenêtre au premier lancement après une mise à jour, lien permanent en bas du menu. */
export function WhatsNew() {
  const [version, setVersion] = useState<string | null>(null);
  const [entries, setEntries] = useState<ChangelogEntry[] | null>(null);

  useEffect(() => {
    const b = bridge();
    if (!b) return;
    void (async () => {
      const current = await b.version();
      setVersion(current);
      const seen = readSeen();
      if (seen === current) return;
      let since = seen;
      if (!since) {
        // Pas de trace : nouvelle installation (rien à annoncer) ou mise à jour depuis une version sans notes.
        const counts = await api.replayStatus().then((s) => s.counts).catch(() => ({}));
        since = Object.values(counts).some((n) => n > 0) ? BASELINE : current;
      }
      const fresh = CHANGELOG.filter((e) => compareVersions(e.version, since!) > 0 && compareVersions(e.version, current) <= 0);
      if (fresh.length) setEntries(fresh);
      writeSeen(current);
    })();
  }, []);

  return (
    <>
      {version && (
        <button className="block text-left text-slate-500 hover:text-white" onClick={() => setEntries(CHANGELOG)}>
          v{version} · {t("Nouveautés")}
        </button>
      )}
      {entries && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-void-950/80 p-6" onClick={() => setEntries(null)}>
          <div className="card max-h-[80vh] w-full max-w-xl overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="title-display text-2xl">{t("Nouveautés")}</div>
            <div className="mt-4 space-y-5">
              {entries.map((e) => (
                <section key={e.version}>
                  <div className="card-title mb-2">
                    {t("Version {v}", { v: e.version })} · {new Date(e.date).toLocaleDateString(locale())}
                  </div>
                  <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-300">
                    {e[lang()].map((line) => <li key={line}>{line}</li>)}
                  </ul>
                </section>
              ))}
            </div>
            <div className="mt-6 text-right">
              <button className="btn-gold" onClick={() => setEntries(null)}>{t("C'est parti")}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

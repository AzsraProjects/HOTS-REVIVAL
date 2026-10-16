import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { get, type PlayerSummary } from "../lib/api";

/** Recherche de profils publics par BattleTag (au fil de la frappe). */
export function PlayerSearch({ autoFocus = false }: { autoFocus?: boolean }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PlayerSummary[] | "error" | null>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults(null);
      return;
    }
    let alive = true; // une réponse lente ne doit pas écraser une recherche plus récente
    const t = setTimeout(() => {
      get<{ players: PlayerSummary[] }>(`/v1/players?q=${encodeURIComponent(term)}`)
        .then((r) => alive && setResults(r.players), () => alive && setResults("error"));
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q]);

  return (
    <div className="relative">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un joueur (BattleTag)…"
        className="w-full pl-10" autoFocus={autoFocus} aria-label="Rechercher un joueur" />
      <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" width="16" height="16"
        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" />
      </svg>
      {results && (
        <div className="panel absolute inset-x-0 top-full z-20 mt-2 max-h-72 overflow-auto p-1">
          {results === "error" ? <div className="px-3 py-2 text-sm text-rose-300">Recherche indisponible pour le moment.</div>
            : results.length ? results.map((p) => (
            <Link key={p.slug} to={`/joueurs/${p.slug}`} className="block rounded-lg px-3 py-2 text-sm text-white hover:bg-white/5">
              {p.name}
            </Link>
          )) : <div className="px-3 py-2 text-sm text-slate-400">Aucun profil public trouvé.</div>}
        </div>
      )}
    </div>
  );
}

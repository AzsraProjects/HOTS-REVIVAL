import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { Overview } from "../lib/api";
import { hero as heroOf, portraitUrl, role as roleOf, type Hero, type Role } from "../lib/game";
import { t } from "../lib/i18n";
import { num, TIER_STYLE, type Tier } from "../lib/stats";
import { DOWNLOAD_URL } from "./links";

/** Portrait hexagonal entouré d'un liseré à la couleur du rôle. */
export function HeroPortrait({ id, size = 48, className = "" }: { id: string; size?: number; className?: string }) {
  const h: Hero = heroOf(id);
  const color = roleOf(h.role).color;
  const url = portraitUrl(h);
  return (
    <span className={`hex relative inline-block shrink-0 ${className}`}
      style={{ width: size, height: size * 1.1547, background: `linear-gradient(160deg, ${color}, #1e2347 70%)` }}>
      <span className="hex absolute inset-[2px] block overflow-hidden bg-void-800">
        {url ? (
          <img src={url} alt={h.name} loading="lazy" className="h-full w-full scale-[1.18] object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-nexus-700 to-void-900 font-display font-bold text-gold-300"
            style={{ fontSize: size * 0.38 }}>
            {h.name.slice(0, 1)}
          </span>
        )}
      </span>
    </span>
  );
}

export function RoleIcon({ role, size = 14 }: { role: Role; size?: number }) {
  const r = roleOf(role);
  const paths: Record<Role, string> = {
    Tank: "M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z",
    Bruiser: "M6 3l3 3-1.5 1.5L13 13l1.5-1.5L18 15l3 6-6-3-3.5-3.5L13 13 7.5 7.5 6 9 3 6z",
    "Ranged Assassin": "M12 2v4m0 12v4M2 12h4m12 0h4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
    "Melee Assassin": "M14.5 3 21 3l0 6.5-9 9-2 2-3-3 2-2zM5 16l3 3-3 3-3-3z",
    Healer: "M9 3h6v6h6v6h-6v6H9v-6H3V9h6z",
    Support: "M12 3 4 7v5c0 4 3 7.5 8 9 5-1.5 8-5 8-9V7zm0 5 3 3-3 3-3-3z",
  };
  const stroke = role === "Ranged Assassin";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-label={r.label} role="img"
      fill={stroke ? "none" : r.color} stroke={stroke ? r.color : "none"} strokeWidth={2.2} strokeLinecap="round">
      <path d={paths[role]} />
    </svg>
  );
}

export function TierBadge({ tier, size = "md" }: { tier: Tier | undefined; size?: "sm" | "md" | "lg" }) {
  const dim = { sm: "h-6 w-6 text-xs", md: "h-8 w-8 text-sm", lg: "h-12 w-12 text-xl" }[size];
  return (
    <span className={`hex inline-flex shrink-0 items-center justify-center bg-gradient-to-b font-display font-extrabold ${TIER_STYLE[tier ?? "?"]} ${dim}`}
      title={tier ? `Tier ${tier}` : t("Pas encore assez de parties")} aria-label={tier ? `Tier ${tier}` : t("Tier à confirmer : pas encore assez de parties")}>
      {tier ?? "?"}
    </span>
  );
}

/** Barre de winrate centrée sur 50 %. */
export function WinBar({ value }: { value: number }) {
  const w = Math.max(2, Math.min(100, value * 100));
  const good = value >= 0.5;
  return (
    <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-void-700">
      <div className={`h-full rounded-full ${good ? "bg-gradient-to-r from-nexus-500 to-storm-400" : "bg-gradient-to-r from-rose-700 to-rose-400"}`}
        style={{ width: `${w}%` }} />
      <div className="absolute inset-y-0 left-1/2 w-px bg-white/30" />
    </div>
  );
}

export function Segmented<T extends string | null>({ value, options, onChange }: {
  value: T; options: { id: T; label: string }[]; onChange: (v: T) => void;
}) {
  return (
    <div className="no-scrollbar inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-white/10 bg-void-900/80 p-1">
      {options.map((o) => (
        <button key={String(o.id)} onClick={() => onChange(o.id)} aria-pressed={value === o.id}
          className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            value === o.id ? "bg-gradient-to-r from-nexus-600 to-storm-600 text-white shadow-glow" : "text-slate-400 hover:text-white"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="panel px-5 py-4">
      <div className="eyebrow">{label}</div>
      <div className="mt-1 font-display text-3xl font-bold text-white">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-slate-400">{hint}</div>}
    </div>
  );
}

export function Section({ eyebrow, title, action, children, className = "" }: {
  eyebrow?: string; title: string; action?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section className={className}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
          <h2 className="title text-xl sm:text-2xl">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function HeroLink({ id, children, className = "" }: { id: string; children: ReactNode; className?: string }) {
  return <Link to={`/heros/${id}`} className={className}>{children}</Link>;
}

export function Loading({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm text-slate-400">
      <span className="hex h-5 w-5 animate-spin bg-gradient-to-br from-nexus-400 to-storm-400" />
      {label ?? t("Chargement…")}
    </div>
  );
}

export function Notice({ title, children, tone = "info" }: { title: string; children?: ReactNode; tone?: "info" | "error" }) {
  return (
    <div className={`panel flex flex-col items-center gap-2 px-6 py-12 text-center ${tone === "error" ? "border-rose-500/30" : ""}`}>
      <span className={`hex h-10 w-10 bg-gradient-to-br ${tone === "error" ? "from-rose-400 to-rose-700" : "from-nexus-400 to-storm-600"} opacity-80`} />
      <div className="title text-lg">{title}</div>
      {children && <div className="max-w-md text-sm text-slate-400">{children}</div>}
    </div>
  );
}

/** Seuils sous lesquels les statistiques sont signalées comme « encore limitées ». */
export const LIMITED_MATCHES = 1000;
export const LIMITED_CONTRIBUTORS = 20;

/** Origine des statistiques : « line » = mention discrète, « banner » = bandeau tant que l'échantillon est faible. */
export function DataSource({ overview, matches, variant = "line" }: { overview?: Overview; matches?: number; variant?: "line" | "banner" }) {
  if (!overview) return null;
  const limited = overview.matches < LIMITED_MATCHES || overview.contributors < LIMITED_CONTRIBUTORS;
  const vars = { matches: num(Math.round(matches ?? overview.matches)), players: num(overview.contributors) };
  const source = overview.contributors === 1
    ? t("Basée sur {matches} parties partagées par {players} joueur.", vars)
    : t("Basée sur {matches} parties partagées par {players} joueurs.", vars);
  if (variant === "line") return <p className="text-xs text-slate-400">{source}</p>;
  if (!limited) return null;
  return (
    <div className="flex gap-3 rounded-xl border border-gold-500/30 bg-gold-500/[0.06] px-4 py-3 text-sm">
      <span className="hex mt-0.5 h-5 w-[18px] shrink-0 bg-gradient-to-b from-gold-300 to-gold-600" aria-hidden />
      <div>
        <div className="font-semibold text-gold-300">{t("Données encore limitées")}</div>
        <p className="text-slate-300">{source}</p>
        <p className="mt-1 text-xs text-slate-400">
          {t("Avec si peu de contributeurs, les statistiques reflètent surtout leurs parties : un héros souvent dans leur équipe suit leur taux de victoire. Elles se stabiliseront avec plus de joueurs.")}{" "}
          <a href={DOWNLOAD_URL} target="_blank" rel="noreferrer" className="text-storm-300 hover:text-white">{t("Partagez vos parties")} →</a>
        </p>
      </div>
    </div>
  );
}

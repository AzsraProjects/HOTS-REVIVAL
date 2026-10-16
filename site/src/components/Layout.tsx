import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, ScrollRestoration, useLocation } from "react-router-dom";

export const DOWNLOAD_URL = "https://github.com/BigBlackC0de/HOTS-REVIVAL/releases";
export const REPO_URL = "https://github.com/BigBlackC0de/HOTS-REVIVAL";

const NAV = [
  { to: "/heros", label: "Héros" },
  { to: "/joueurs", label: "Joueurs" },
  { to: "/a-propos", label: "À propos" },
];

export function Logo({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id="logo-g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#1f8fff" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <path d="M32 4 58 18v28L32 60 6 46V18Z" fill="url(#logo-g)" />
      <path d="M32 14 46 22v20L32 50 18 42V22Z" fill="#0b0d1a" />
      <path d="M27 22h10l-3 8h6L28 46l3-11h-6Z" fill="#f5c451" />
    </svg>
  );
}

export function Layout() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="flex min-h-screen flex-col">
      <ScrollRestoration />
      <div className="nexus-bg" />
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-void-950/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
          <Link to="/" className="flex items-center gap-2.5">
            <Logo />
            <span className="font-display text-lg font-bold tracking-wider text-white">
              HOTS <span className="text-gradient">REVIVAL</span>
            </span>
          </Link>
          <nav className="ml-4 hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to}
                className={({ isActive }) => `rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive ? "bg-white/5 text-white" : "text-slate-400 hover:text-white"}`}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <a href={DOWNLOAD_URL} target="_blank" rel="noreferrer" className="btn-primary ml-auto hidden py-2 sm:inline-flex">
            Télécharger l'appli
          </a>
          <button className="ml-auto rounded-lg p-2 text-slate-300 md:hidden sm:ml-0" onClick={() => setOpen((o) => !o)}
            aria-label="Menu" aria-expanded={open}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d={open ? "M6 6l12 12M18 6 6 18" : "M4 7h16M4 12h16M4 17h16"} />
            </svg>
          </button>
        </div>
        {open && (
          <nav className="border-t border-white/[0.06] px-4 py-3 md:hidden">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} className="block rounded-lg px-3 py-2.5 text-slate-200 hover:bg-white/5">{n.label}</NavLink>
            ))}
            <a href={DOWNLOAD_URL} target="_blank" rel="noreferrer" className="btn-primary mt-2 w-full">Télécharger l'appli</a>
          </nav>
        )}
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:py-12">
        <Outlet />
      </main>

      <footer className="border-t border-white/[0.06] bg-void-950/60">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Logo size={22} />
            <span>HOTS REVIVAL — conçu par des joueurs, pour des joueurs.</span>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Link to="/a-propos" className="hover:text-slate-300">Comment ça marche</Link>
            <Link to="/a-propos#confidentialite" className="hover:text-slate-300">Confidentialité</Link>
            <a href={REPO_URL} target="_blank" rel="noreferrer" className="hover:text-slate-300">Code source</a>
          </div>
        </div>
        <p className="mx-auto max-w-6xl px-4 pb-8 text-[11px] leading-relaxed text-slate-500">
          Site de fans non officiel. Heroes of the Storm, ses héros, portraits et icônes sont des marques et contenus de
          Blizzard Entertainment, Inc., utilisés conformément à sa politique relative au contenu des fans. Ce site n'est ni
          approuvé ni sponsorisé par Blizzard.
        </p>
      </footer>
    </div>
  );
}

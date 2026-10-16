import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { DOWNLOAD_URL, REPO_URL } from "../components/links";
import { lang } from "../lib/i18n";

// Page rédigée dans chaque langue (texte suivi, plus naturel qu'une traduction phrase à phrase).
const COPY = {
  fr: {
    eyebrow: "À propos",
    title: "Un site fait par la communauté",
    intro: "HOTS REVIVAL est une application gratuite et open source qui accompagne les joueurs de Heroes of the Storm avant, pendant et après leurs parties. Ce site rassemble les parties partagées par ses utilisateurs, pour que tout le monde profite de statistiques à jour, sans dépendre d'un site tiers.",
    download: "Télécharger l'appli",
    source: "Code source",
    howTitle: "Comment sont calculées les statistiques ?",
    how: [
      "Seules les parties contre de vrais joueurs comptent : Partie rapide, Ligue Tempête, Draft non classée, ARAM, et les anciennes Ligue des héros et Ligue par équipe.",
      "Chaque partie compte pour ses 10 héros, pas seulement celui du joueur qui la partage.",
      "Une même partie envoyée par plusieurs joueurs n'est comptée qu'une fois.",
      "Les statistiques sont recalculées une fois par jour.",
      "Le classement tient compte du nombre de parties : un héros peu joué est ramené vers 50 % tant que l'échantillon est faible. Les tiers sont relatifs : S pour les 10 % de héros les plus performants, puis A (20 %), B (40 %), C (20 %) et D (10 %). Les héros joués moins de 10 fois sont signalés « à confirmer ».",
    ],
    privacyTitle: "Confidentialité",
    privacyIntro: "Le partage des parties est activé par défaut dans l'application : c'est ce qui fait vivre ces statistiques. Un bandeau vous en informe au premier lancement, avant tout envoi, et vous pouvez le désactiver d'un clic, à ce moment-là ou plus tard depuis les Paramètres. Une fois actif, vos parties déjà importées sont envoyées elles aussi, puis chaque nouvelle partie dès sa fin. Le profil public, lui, reste désactivé tant que vous ne l'activez pas.",
    sentTitle: "Ce qui est envoyé",
    sent: [
      "Héros, carte, mode, durée et résultat de la partie",
      "Talents choisis et statistiques de fin de partie (dégâts, soins, KDA…)",
      "Le HEROS SCORE calculé par l'application",
      "L'identifiant de compte des 10 joueurs, remplacé dès réception par un pseudonyme",
      "Si vous activez le profil public : votre BattleTag et vos identifiants de compte",
    ],
    neverTitle: "Ce qui ne l'est jamais",
    never: ["Le fichier replay", "Les pseudos des joueurs", "Le chat de la partie", "Les positions, mouvements ou toute donnée en jeu"],
    paragraphs: [
      ["Pseudonymisation.", "Chaque compte est remplacé par un pseudonyme calculé avec une clé secrète conservée par le serveur. Sans cette clé, on ne peut pas remonter au compte. Il s'agit d'une pseudonymisation et non d'un anonymat total : les données restent des données personnelles au sens du RGPD, traitées uniquement pour produire les statistiques. Les autres joueurs de vos parties n'apparaissent jamais par leur nom, seulement par leur héros."],
      ["Profil public.", "Il n'existe que si vous l'activez. Il affiche votre BattleTag, vos héros et vos dernières parties (carte, date, héros de chaque équipe) : les joueurs présents dans ces parties peuvent donc les reconnaître. Le désactiver le retire du site en quelques minutes."],
      ["Suppression.", "Le bouton « Supprimer mes données communautaires » de l'application efface votre profil, votre installation et tout lien entre vous et vos parties. Les parties restent dans les statistiques globales, rattachées uniquement à leurs pseudonymes."],
      ["Anti-abus.", "Pour limiter les inscriptions en masse, le serveur garde une empreinte de l'adresse IP (hachée avec la clé secrète, jamais l'adresse elle-même) au moment où une installation s'enregistre."],
    ],
    contactTitle: "Vous n'utilisez pas l'application ?",
    contact: "Vos parties peuvent apparaître dans les statistiques globales si un autre joueur les partage, uniquement sous pseudonyme et sans votre nom. Pour toute question ou demande (accès, effacement), ouvrez un ticket sur",
    siteTitle: "Ce site.",
    site: "Hébergé par Cloudflare. Aucun cookie, aucun traceur, polices servies par le site lui-même. Les portraits et icônes de talents sont chargés depuis le CDN jsDelivr, qui reçoit donc votre adresse IP comme pour toute image en ligne.",
    creditsTitle: "Crédits",
    credits: [
      "Portraits et icônes de talents : données de jeu de Blizzard Entertainment, via le projet open source heroes-talents (MIT).",
      "Heroes of the Storm est une marque de Blizzard Entertainment, Inc. Ce site de fans n'est ni approuvé ni sponsorisé par Blizzard.",
    ],
  },
  en: {
    eyebrow: "About",
    title: "A site built by the community",
    intro: "HOTS REVIVAL is a free, open-source app that helps Heroes of the Storm players before, during and after their games. This site gathers the games shared by its users, so everyone gets up-to-date stats without relying on a third-party site.",
    download: "Download the app",
    source: "Source code",
    howTitle: "How are the stats computed?",
    how: [
      "Only games against real players count: Quick Match, Storm League, Unranked Draft, ARAM, plus the former Hero League and Team League.",
      "Each game counts for all 10 heroes, not only the one played by the person who shares it.",
      "A game sent by several players is only counted once.",
      "Stats are recomputed once a day.",
      "The ranking accounts for the number of games: a rarely played hero is pulled towards 50% while the sample is small. Tiers are relative: S for the top 10% of heroes, then A (20%), B (40%), C (20%) and D (10%). Heroes played fewer than 10 times are flagged as unconfirmed.",
    ],
    privacyTitle: "Privacy",
    privacyIntro: "Game sharing is on by default in the app: that's what keeps these stats alive. A banner tells you about it on first launch, before anything is sent, and you can turn it off in one click, right then or later in Settings. While it's on, your already imported games are sent too, then each new game as soon as it ends. The public profile stays off until you turn it on.",
    sentTitle: "What is sent",
    sent: [
      "Hero, map, mode, duration and result of the game",
      "Chosen talents and end-of-game stats (damage, healing, KDA…)",
      "The HEROS SCORE computed by the app",
      "The account identifier of the 10 players, replaced by a pseudonym on arrival",
      "If you enable the public profile: your BattleTag and account identifiers",
    ],
    neverTitle: "What is never sent",
    never: ["The replay file", "Player names", "In-game chat", "Positions, movements or any in-game data"],
    paragraphs: [
      ["Pseudonymization.", "Each account is replaced by a pseudonym computed with a secret key kept on the server. Without that key, the account cannot be traced back. This is pseudonymization, not full anonymity: under the GDPR the data remain personal data, processed only to produce the stats. Other players in your games never appear by name, only by their hero."],
      ["Public profile.", "It only exists if you turn it on. It shows your BattleTag, your heroes and your recent games (map, date, heroes on each team), so players who were in those games can recognize them. Turning it off removes it from the site within a few minutes."],
      ["Deletion.", "The app's “Delete my community data” button erases your profile, your installation and any link between you and your games. The games stay in the global stats, attached only to their pseudonyms."],
      ["Anti-abuse.", "To limit mass sign-ups, the server keeps a fingerprint of the IP address (hashed with the secret key, never the address itself) when an installation registers."],
    ],
    contactTitle: "Not using the app?",
    contact: "Your games may appear in the global stats if another player shares them, only under a pseudonym and without your name. For any question or request (access, erasure), open an issue on",
    siteTitle: "This site.",
    site: "Hosted by Cloudflare. No cookies, no trackers, fonts served by the site itself. Hero portraits and talent icons are loaded from the jsDelivr CDN, which therefore receives your IP address like any online image.",
    creditsTitle: "Credits",
    credits: [
      "Portraits and talent icons: Blizzard Entertainment game data, via the open-source heroes-talents project (MIT).",
      "Heroes of the Storm is a trademark of Blizzard Entertainment, Inc. This fan site is not endorsed or sponsored by Blizzard.",
    ],
  },
};

export function About() {
  const { hash } = useLocation();
  useEffect(() => {
    if (hash) document.querySelector(hash)?.scrollIntoView({ behavior: "smooth" });
  }, [hash]);
  const c = COPY[lang()];

  return (
    <div className="mx-auto max-w-3xl space-y-12">
      <header>
        <div className="eyebrow mb-1">{c.eyebrow}</div>
        <h1 className="title text-3xl sm:text-4xl">{c.title}</h1>
        <p className="mt-3 text-slate-400">{c.intro}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <a href={DOWNLOAD_URL} target="_blank" rel="noreferrer" className="btn-primary">{c.download}</a>
          <a href={REPO_URL} target="_blank" rel="noreferrer" className="btn-ghost">{c.source}</a>
        </div>
      </header>

      <section className="space-y-3">
        <h2 className="title text-2xl">{c.howTitle}</h2>
        <ul className="list-disc space-y-2 pl-5 text-slate-400">{c.how.map((x) => <li key={x}>{x}</li>)}</ul>
      </section>

      <section id="confidentialite" className="scroll-mt-24 space-y-4">
        <h2 className="title text-2xl">{c.privacyTitle}</h2>
        <p className="text-slate-400">{c.privacyIntro}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="panel p-5">
            <div className="mb-3 font-semibold text-emerald-300">{c.sentTitle}</div>
            <ul className="space-y-2 text-sm text-slate-300">{c.sent.map((s) => <li key={s}>✓ {s}</li>)}</ul>
          </div>
          <div className="panel p-5">
            <div className="mb-3 font-semibold text-rose-300">{c.neverTitle}</div>
            <ul className="space-y-2 text-sm text-slate-300">{c.never.map((s) => <li key={s}>✕ {s}</li>)}</ul>
          </div>
        </div>
        <div className="space-y-3 text-sm leading-relaxed text-slate-400">
          {c.paragraphs.map(([title, text]) => (
            <p key={title}><strong className="text-slate-200">{title}</strong> {text}</p>
          ))}
          <p>
            <strong className="text-slate-200">{c.contactTitle}</strong> {c.contact}{" "}
            <a href={`${REPO_URL}/issues`} target="_blank" rel="noreferrer" className="text-storm-300 hover:text-white">GitHub</a>.
          </p>
          <p><strong className="text-slate-200">{c.siteTitle}</strong> {c.site}</p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="title text-2xl">{c.creditsTitle}</h2>
        <ul className="space-y-2 text-sm text-slate-400">{c.credits.map((x) => <li key={x}>{x}</li>)}</ul>
      </section>
    </div>
  );
}

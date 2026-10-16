import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { DOWNLOAD_URL, REPO_URL } from "../components/Layout";

const SENT = [
  "Héros, carte, mode, durée et résultat de la partie",
  "Talents choisis et statistiques de fin de partie (dégâts, soins, KDA…)",
  "Le HEROS SCORE calculé par l'application",
  "L'identifiant de compte des 10 joueurs, remplacé dès réception par un pseudonyme",
  "Si vous activez le profil public : votre BattleTag et vos identifiants de compte",
];
const NEVER = [
  "Le fichier replay",
  "Les pseudos des joueurs",
  "Le chat de la partie",
  "Les positions, mouvements ou toute donnée en jeu",
];

export function About() {
  const { hash } = useLocation();
  useEffect(() => {
    if (hash) document.querySelector(hash)?.scrollIntoView({ behavior: "smooth" });
  }, [hash]);

  return (
    <div className="mx-auto max-w-3xl space-y-12">
      <header>
        <div className="eyebrow mb-1">À propos</div>
        <h1 className="title text-3xl sm:text-4xl">Un site fait par la communauté</h1>
        <p className="mt-3 text-slate-400">
          HOTS REVIVAL est une application gratuite et open source qui accompagne les joueurs de Heroes of the Storm avant,
          pendant et après leurs parties. Ce site rassemble les parties que ses utilisateurs choisissent de partager, pour
          que tout le monde profite de statistiques à jour, sans dépendre d'un site tiers.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <a href={DOWNLOAD_URL} target="_blank" rel="noreferrer" className="btn-primary">Télécharger l'appli</a>
          <a href={REPO_URL} target="_blank" rel="noreferrer" className="btn-ghost">Code source</a>
        </div>
      </header>

      <section className="space-y-3">
        <h2 className="title text-2xl">Comment sont calculées les statistiques ?</h2>
        <ul className="list-disc space-y-2 pl-5 text-slate-400">
          <li>
            Seules les parties contre de vrais joueurs comptent : Partie rapide, Ligue Tempête, Draft non classée, ARAM, et les
            anciennes Ligue des héros et Ligue par équipe.
          </li>
          <li>Une même partie envoyée par plusieurs joueurs n'est comptée qu'une fois.</li>
          <li>Les statistiques sont recalculées toutes les heures.</li>
          <li>
            Le classement tient compte du nombre de parties : un héros peu joué est ramené vers 50 % tant que l'échantillon
            est faible. Les tiers sont relatifs : S pour les 10 % de héros les plus performants, puis A (20 %), B (40 %),
            C (20 %) et D (10 %). Les héros joués moins de 10 fois sont signalés « à confirmer ».
          </li>
        </ul>
      </section>

      <section id="confidentialite" className="scroll-mt-24 space-y-4">
        <h2 className="title text-2xl">Confidentialité</h2>
        <p className="text-slate-400">
          Rien n'est envoyé sans votre accord : le partage est désactivé par défaut dans l'application, et se coupe à tout
          moment depuis les Paramètres. En l'activant, vos parties déjà importées sont envoyées elles aussi, puis chaque
          nouvelle partie dès sa fin.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="panel p-5">
            <div className="mb-3 font-semibold text-emerald-300">Ce qui est envoyé</div>
            <ul className="space-y-2 text-sm text-slate-300">{SENT.map((s) => <li key={s}>✓ {s}</li>)}</ul>
          </div>
          <div className="panel p-5">
            <div className="mb-3 font-semibold text-rose-300">Ce qui ne l'est jamais</div>
            <ul className="space-y-2 text-sm text-slate-300">{NEVER.map((s) => <li key={s}>✕ {s}</li>)}</ul>
          </div>
        </div>
        <div className="space-y-3 text-sm leading-relaxed text-slate-400">
          <p>
            <strong className="text-slate-200">Pseudonymisation.</strong> Chaque compte est remplacé par un pseudonyme
            calculé avec une clé secrète conservée par le serveur. Sans cette clé, on ne peut pas remonter au compte. Il
            s'agit d'une pseudonymisation et non d'un anonymat total : les données restent des données personnelles au sens
            du RGPD, traitées uniquement pour produire les statistiques. Les autres joueurs de vos parties n'apparaissent
            jamais par leur nom, seulement par leur héros.
          </p>
          <p>
            <strong className="text-slate-200">Profil public.</strong> Il n'existe que si vous l'activez. Il affiche votre
            BattleTag, vos héros et vos dernières parties (carte, date, héros de chaque équipe) : les joueurs présents dans
            ces parties peuvent donc les reconnaître. Le désactiver le retire du site en quelques minutes.
          </p>
          <p>
            <strong className="text-slate-200">Suppression.</strong> Le bouton « Supprimer mes données communautaires » de
            l'application efface votre profil, votre installation et tout lien entre vous et vos parties. Les parties restent
            dans les statistiques globales, rattachées uniquement à leurs pseudonymes.
          </p>
          <p>
            <strong className="text-slate-200">Anti-abus.</strong> Pour limiter les inscriptions en masse, le serveur garde
            une empreinte de l'adresse IP (hachée avec la clé secrète, jamais l'adresse elle-même) au moment où une
            installation s'enregistre.
          </p>
          <p>
            <strong className="text-slate-200">Vous n'utilisez pas l'application ?</strong> Vos parties peuvent apparaître
            dans les statistiques globales si un autre joueur les partage, uniquement sous pseudonyme et sans votre nom. Pour
            toute question ou demande (accès, effacement), ouvrez un ticket sur{" "}
            <a href={`${REPO_URL}/issues`} target="_blank" rel="noreferrer" className="text-storm-300 hover:text-white">GitHub</a>.
          </p>
          <p>
            <strong className="text-slate-200">Ce site.</strong> Hébergé par Cloudflare. Aucun cookie, aucun traceur, polices
            servies par le site lui-même. Les portraits et icônes de talents sont chargés depuis le CDN jsDelivr, qui reçoit
            donc votre adresse IP comme pour toute image en ligne.
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="title text-2xl">Crédits</h2>
        <ul className="space-y-2 text-sm text-slate-400">
          <li>Portraits et icônes de talents : données de jeu de Blizzard Entertainment, via le projet open source heroes-talents (MIT).</li>
          <li>Heroes of the Storm est une marque de Blizzard Entertainment, Inc. Ce site de fans n'est ni approuvé ni sponsorisé par Blizzard.</li>
        </ul>
      </section>
    </div>
  );
}

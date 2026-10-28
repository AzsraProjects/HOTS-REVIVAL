/**
 * Guide audible quel que soit le mode d'affichage du jeu : clips du profil de voix enregistré par le joueur
 * quand la phrase existe, sinon synthèse vocale (voix installées sur Windows).
 */
import { bridge } from "./bridge";
import { lang, locale } from "./i18n";

export interface VoiceOptions { voiceName?: string | null; rate?: number; volume?: number; voiceProfile?: string | null }

export function listVoices(): SpeechSynthesisVoice[] {
  const voices = window.speechSynthesis?.getVoices() ?? [];
  // voix de la langue de l'interface d'abord (français ou anglais)
  const mine = (v: SpeechSynthesisVoice) => Number(v.lang.toLowerCase().startsWith(lang()));
  return [...voices].sort((a, b) => mine(b) - mine(a));
}

function pickVoice(name?: string | null): SpeechSynthesisVoice | null {
  const voices = listVoices();
  // voix choisie par le joueur, sinon la première voix de la langue de l'interface
  return voices.find((v) => v.name === name) ?? voices.find((v) => v.lang.toLowerCase().startsWith(lang())) ?? null;
}

function utterance(text: string, opts: VoiceOptions): SpeechSynthesisUtterance {
  // « 30 s » -> « 30 secondes » : seulement après un nombre (\b ignore les accents : « groupés » cassait)
  const fr = lang() === "fr";
  const spoken = text.replace(/≈/g, fr ? "environ" : "about")
    .replace(/(\d+)\s?s(?![\p{L}\d])/gu, (_, n: string) =>
      fr ? `${n} seconde${n === "1" || n === "0" ? "" : "s"}` : `${n} second${n === "1" ? "" : "s"}`);
  const u = new SpeechSynthesisUtterance(spoken);
  const voice = pickVoice(opts.voiceName);
  if (voice) u.voice = voice;
  u.lang = voice?.lang ?? locale();
  u.rate = opts.rate ?? 1.05;
  u.volume = opts.volume ?? 1;
  return u;
}

/** Lecture immédiate par la synthèse Windows (bouton « Tester la voix »). */
export function speak(text: string, opts: VoiceOptions = {}): void {
  window.speechSynthesis?.speak(utterance(text, opts));
}

function speakAsync(text: string, opts: VoiceOptions): Promise<void> {
  const synth = window.speechSynthesis;
  if (!synth) return Promise.resolve();
  return new Promise((resolve) => {
    const u = utterance(text, opts);
    // garde-fou : onend n'est pas toujours émis par Chromium
    const timer = window.setTimeout(resolve, 2000 + text.length * 120);
    u.onend = u.onerror = () => { window.clearTimeout(timer); resolve(); };
    synth.speak(u);
  });
}

// ---- clips des profils de voix --------------------------------------------------------------
const clipUrls = new Map<string, Promise<string | null>>(); // « profil/clé » -> URL blob (null = pas enregistré)

/** Vide le cache (clip enregistré, supprimé ou profil renommé). */
export function forgetClips(profile?: string): void {
  for (const [id, url] of clipUrls) {
    if (profile && !id.startsWith(`${profile}/`)) continue;
    void url.then((u) => u && URL.revokeObjectURL(u));
    clipUrls.delete(id);
  }
}

export function clipUrl(profile: string, key: string): Promise<string | null> {
  const id = `${profile}/${key}`;
  let url = clipUrls.get(id);
  if (!url) {
    url = (bridge()?.voices.read(profile, key) ?? Promise.resolve(null))
      .then((clip) => (clip ? URL.createObjectURL(new Blob([clip.data], { type: clip.mime })) : null))
      .catch(() => null);
    clipUrls.set(id, url);
  }
  return url;
}

/** Lit un clip jusqu'au bout ; renvoie l'erreur de lecture, null si tout s'est bien passé. */
let stopClip: (() => void) | null = null; // clip en cours de lecture (coupure immédiate)

export function playUrl(url: string, volume = 1): Promise<string | null> {
  return new Promise((resolve) => {
    const audio = new Audio(url);
    audio.volume = Math.max(0, Math.min(1, volume));
    const timer = window.setTimeout(() => resolve(null), 15_000);
    const done = (err: string | null) => { window.clearTimeout(timer); stopClip = null; resolve(err); };
    stopClip = () => { audio.pause(); done(null); };
    audio.onended = () => done(null);
    audio.onerror = () => done(audio.error?.message || `MediaError ${audio.error?.code ?? "?"}`);
    audio.play().catch((e: unknown) => done(e instanceof Error ? `${e.name}: ${e.message}` : String(e)));
  });
}

// ---- file d'attente : une annonce à la fois, clips et synthèse confondus ----------------------
/**
 * priority : 0 = la plus urgente (comme les alertes du moteur). expiresAt : une annonce qui n'a pas pu
 * être dite à temps (« Objectif dans 40 s ») est abandonnée plutôt que dite en retard, donc fausse.
 */
export interface Announcement { text: string; key?: string | null; priority?: number; expiresAt?: number }
const MAX_PENDING = 4;
const queue: { item: Announcement; opts: VoiceOptions; resolve: (err: string | null) => void }[] = [];
let playing = false;

/** Coupe la phrase en cours et vide la file (raccourci « silence »). */
export function silence(): void {
  for (const pending of queue.splice(0)) pending.resolve(null);
  stopClip?.();
  window.speechSynthesis?.cancel();
}

async function drain(): Promise<void> {
  if (playing) return;
  playing = true;
  try {
    for (let next = queue.shift(); next; next = queue.shift()) {
      const { item, opts, resolve } = next;
      if (item.expiresAt && Date.now() > item.expiresAt) {
        resolve(null);
        continue;
      }
      const url = opts.voiceProfile && item.key ? await clipUrl(opts.voiceProfile, item.key) : null;
      // clip illisible sur ce PC : la voix Windows prend le relais plutôt que le silence
      const err = url ? await playUrl(url, opts.volume ?? 1) : null;
      if (err) console.warn(`Clip ${opts.voiceProfile}/${item.key} illisible : ${err}`);
      if (!url || err) await speakAsync(item.text, opts);
      resolve(err);
    }
  } finally {
    playing = false;
  }
}

/**
 * Annonce une phrase : le clip enregistré de la clé s'il existe dans le profil choisi, sinon la voix Windows.
 * La promesse se résout une fois la phrase dite : erreur de lecture du clip, ou null.
 */
export function announce(item: Announcement, opts: VoiceOptions = {}): Promise<string | null> {
  if (queue.length >= MAX_PENDING) {
    // file pleine : on abandonne la moins urgente (la plus ancienne à urgence égale)
    const rank = (a: Announcement) => a.priority ?? 9;
    let drop = 0;
    queue.forEach((q, i) => { if (rank(q.item) > rank(queue[drop].item)) drop = i; });
    if (rank(queue[drop].item) < rank(item)) return Promise.resolve(null); // la nouvelle est la moins urgente
    queue.splice(drop, 1)[0].resolve(null);
  }
  return new Promise((resolve) => {
    // à urgence plus forte, passe devant les annonces en attente
    const at = queue.findIndex((q) => (q.item.priority ?? 9) > (item.priority ?? 9));
    queue.splice(at === -1 ? queue.length : at, 0, { item, opts, resolve });
    void drain();
  });
}

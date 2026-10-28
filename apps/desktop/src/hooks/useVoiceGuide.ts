import { useEffect, useRef, useState } from "react";
import { bridge, type OverlayPrefs } from "../lib/bridge";
import { t } from "../lib/i18n";
import type { OverlayState } from "../lib/types";
import { announce, forgetClips, silence } from "../lib/voice";

const TIP_COOLDOWN_MS = 90_000; // même conseil
const TIP_GAP_MS = 60_000; // un conseil au plus par minute
const QUIET_MS = 15_000; // pas de conseil juste après une autre annonce
const REPEAT_MS = 30_000; // une alerte qui réapparaît n'est pas répétée avant 30 s
const MAX_PER_MINUTE = 6; // au-delà, seules les alertes urgentes passent
const URGENT = 1; // priorité du moteur : 0 = évènement (niveau atteint…), 1 = danger
const STALE_MS = 6_000; // annonce pas encore dite après 6 s : abandonnée (« Objectif dans 40 s » serait faux)
const DEFAULT: OverlayPrefs = { voice: true, tips: true, voiceName: null, rate: 1.05, volume: 1, overlay: false, displayId: null, gameDisplayId: null, voiceProfile: null, micDeviceId: null };

/** Guide vocal coupé par le raccourci « silence » (Ctrl+Maj+M), pour l'afficher. */
export function useVoiceMuted(): boolean {
  const [muted, setMuted] = useState(false);
  useEffect(() => {
    const b = bridge();
    void b?.voiceMuted?.().then(setMuted);
    return b?.onVoiceMute?.(setMuted);
  }, []);
  return muted;
}

/**
 * Guide vocal sobre : moins de phrases, au bon moment.
 * - chaque alerte est lue quand elle apparaît, une seule fois par 30 s, les plus urgentes d'abord ;
 * - au-delà de 6 annonces par minute, seules les alertes urgentes passent ;
 * - un conseil (« Restez groupés »…) au plus par minute, jamais juste après une autre annonce,
 *   et jamais le même deux fois en 90 s ;
 * - une annonce qui n'a pas pu être dite à temps est abandonnée plutôt que dite en retard ;
 * - le raccourci « silence » coupe la phrase en cours et tout le guide jusqu'au prochain appui.
 * Les phrases enregistrées du profil de voix choisi remplacent la voix Windows.
 * Monté une seule fois, dans la fenêtre principale (Layout) : l'overlay ne parle pas.
 */
export function useVoiceGuide(state: OverlayState | null) {
  const prefs = useRef<OverlayPrefs>(DEFAULT);
  const muted = useRef(false);
  const activeAlerts = useRef<Set<string>>(new Set());
  const alertSaidAt = useRef<Map<string, number>>(new Map());
  const tipSaidAt = useRef<Map<string, number>>(new Map());
  const said = useRef<number[]>([]); // heures des annonces de la dernière minute
  const lastTipAt = useRef(0);
  const gameId = useRef<number | null>(null);

  useEffect(() => {
    const b = bridge();
    void b?.prefs.get().then((p) => (prefs.current = p));
    void b?.voiceMuted?.().then((m) => (muted.current = m));
    const offs = [
      b?.onPrefs((p) => (prefs.current = p)),
      b?.onSay((text) => !muted.current && announce({ text, priority: 0 }, prefs.current)),
      b?.voices.onChanged((profile) => forgetClips(profile)),
      b?.onVoiceMute?.((m) => {
        muted.current = m;
        if (m) silence();
        else if (prefs.current.voice) void announce({ text: t("Guide vocal réactivé."), priority: 0 }, prefs.current);
      }),
    ];
    return () => offs.forEach((off) => off?.());
  }, []);

  useEffect(() => {
    if (!state) return;
    const p = prefs.current;
    if (state.game_id !== gameId.current) {
      gameId.current = state.game_id;
      activeAlerts.current.clear();
      alertSaidAt.current.clear();
      tipSaidAt.current.clear();
      lastTipAt.current = 0;
    }
    const now = Date.now();
    said.current = said.current.filter((at) => now - at < 60_000);
    const say = (text: string, key: string | undefined, priority: number) => {
      said.current.push(now);
      void announce({ text, key, priority, expiresAt: now + STALE_MS }, p);
    };

    const current = new Set(state.alerts.filter((a) => a.voice !== false).map((a) => a.id));
    if (p.voice && !muted.current) {
      // seules les infos observées sont annoncées (jamais une estimation)
      const fresh = state.alerts
        .filter((a) => a.voice !== false && !activeAlerts.current.has(a.id))
        .sort((a, b) => (a.priority ?? 2) - (b.priority ?? 2));
      for (const a of fresh) {
        const key = a.voice_key ?? a.text;
        const priority = a.priority ?? 2;
        if (now - (alertSaidAt.current.get(key) ?? 0) < REPEAT_MS) continue;
        if (priority > URGENT && said.current.length >= MAX_PER_MINUTE) continue;
        alertSaidAt.current.set(key, now);
        say(a.text, a.voice_key, priority);
      }
      const quiet = said.current.every((at) => now - at > QUIET_MS);
      if (p.tips && state.status === "in_game" && quiet && now - lastTipAt.current > TIP_GAP_MS
          && said.current.length < MAX_PER_MINUTE) {
        const tips = state.tip_items ?? state.tips.map((text) => ({ text, voice_key: undefined }));
        const tip = tips.find((x) => now - (tipSaidAt.current.get(x.text) ?? 0) > TIP_COOLDOWN_MS);
        if (tip) {
          tipSaidAt.current.set(tip.text, now);
          lastTipAt.current = now;
          say(tip.text, tip.voice_key, 5);
        }
      }
    }
    activeAlerts.current = current;
  }, [state]);
}

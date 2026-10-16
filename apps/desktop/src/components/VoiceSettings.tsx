import { useCallback, useEffect, useState } from "react";
import { bridge, type OverlayPrefs } from "../lib/bridge";
import { announce, listVoices } from "../lib/voice";
import { VOICE_PHRASES } from "../lib/voicePhrases";
import { t } from "../lib/i18n";

const TEST_KEY = "objective-soon";

/**
 * Guide vocal : activation, et un seul choix de voix pour tout (voix officielles livrées avec l'application,
 * voix enregistrées par le joueur, voix Windows). Un profil de voix se rabat sur la voix Windows pour
 * les phrases qu'il ne contient pas.
 */
export function VoiceSettings() {
  const b = bridge();
  const [prefs, setPrefs] = useState<OverlayPrefs | null>(null);
  const [tts, setTts] = useState<SpeechSynthesisVoice[]>([]);
  const [profiles, setProfiles] = useState<string[]>([]);
  const [builtin, setBuiltin] = useState<string[]>([]);
  const [testError, setTestError] = useState<string | null>(null);

  const loadProfiles = useCallback(async () => {
    if (!b) return;
    const [list, official] = await Promise.all([b.voices.profiles(), b.voices.builtin()]);
    setProfiles(list);
    setBuiltin(official);
  }, [b]);

  useEffect(() => {
    if (!b) return;
    void b.prefs.get().then(setPrefs);
    void loadProfiles();
    const load = () => setTts(listVoices());
    load();
    window.speechSynthesis?.addEventListener("voiceschanged", load);
    const offPrefs = b.onPrefs((p) => { setPrefs(p); void loadProfiles(); }); // profil créé ou renommé
    const offVoices = b.voices.onChanged(() => void loadProfiles());
    return () => {
      window.speechSynthesis?.removeEventListener("voiceschanged", load);
      offPrefs();
      offVoices();
    };
  }, [b, loadProfiles]);

  if (!b || !prefs) return null;
  const update = async (next: Partial<OverlayPrefs>) => setPrefs(await b.prefs.set(next));
  const own = profiles.filter((p) => !builtin.includes(p));
  const value = prefs.voiceProfile ? `profile:${prefs.voiceProfile}` : `tts:${prefs.voiceName ?? ""}`;
  const choose = (v: string) => void (v.startsWith("profile:")
    ? update({ voiceProfile: v.slice("profile:".length) })
    : update({ voiceProfile: null, voiceName: v.slice("tts:".length) || null }));
  const phrase = VOICE_PHRASES.find((p) => p.key === TEST_KEY);
  const test = async () => {
    if (!phrase) return;
    setTestError(null);
    setTestError(await announce({ text: phrase.text, key: phrase.key }, prefs));
  };

  return (
    <div className="space-y-4 text-sm">
      <div className="space-y-2">
        <label className="flex items-center gap-3">
          <input type="checkbox" checked={prefs.voice} onChange={(e) => void update({ voice: e.target.checked })} />
          <span>{t("Guide vocal pendant les parties (fonctionne en plein écran, sans overlay)")}</span>
        </label>
        <label className="flex items-center gap-3">
          <input type="checkbox" checked={prefs.tips} disabled={!prefs.voice} onChange={(e) => void update({ tips: e.target.checked })} />
          <span>{t("Lire aussi les conseils (« Restez groupés », avantage de talent…), au plus une fois toutes les 90 s")}</span>
        </label>
      </div>

      <div className="grid grid-cols-[160px_1fr] items-center gap-3">
        <span>{t("Voix")}</span>
        <select value={value} onChange={(e) => choose(e.target.value)}>
          {builtin.length > 0 && (
            <optgroup label={t("Voix HOTS REVIVAL")}>
              {builtin.map((p) => <option key={p} value={`profile:${p}`}>{p}</option>)}
            </optgroup>
          )}
          {own.length > 0 && (
            <optgroup label={t("Mes voix enregistrées")}>
              {own.map((p) => <option key={p} value={`profile:${p}`}>{p}</option>)}
            </optgroup>
          )}
          {prefs.voiceProfile && !profiles.includes(prefs.voiceProfile) && (
            <option value={value}>{t("{p} (introuvable)", { p: prefs.voiceProfile })}</option>
          )}
          <optgroup label={t("Voix Windows (synthèse)")}>
            <option value="tts:">{t("Automatique (première voix française)")}</option>
            {tts.map((v) => <option key={v.name} value={`tts:${v.name}`}>{v.name} ({v.lang})</option>)}
          </optgroup>
        </select>

        {prefs.voiceProfile && (
          <>
            <span className="text-slate-400">{t("Phrases manquantes")}</span>
            <select value={prefs.voiceName ?? ""} onChange={(e) => void update({ voiceName: e.target.value || null })}>
              <option value="">{t("Automatique (première voix française)")}</option>
              {tts.map((v) => <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>)}
            </select>
          </>
        )}

        <span>{t("Volume")}</span>
        <input type="range" min={0.1} max={1} step={0.05} value={prefs.volume} onChange={(e) => void update({ volume: Number(e.target.value) })} />
        <span>{t("Vitesse (voix Windows)")}</span>
        <input type="range" min={0.7} max={1.6} step={0.05} value={prefs.rate} onChange={(e) => void update({ rate: Number(e.target.value) })} />
      </div>

      <div className="flex items-center gap-3">
        <button className="btn-primary" onClick={() => void test()}>{t("Tester la voix")}</button>
        <span className="text-xs text-slate-400">
          {prefs.voiceProfile
            ? t("Une phrase absente de cette voix est lue par la voix Windows choisie ci-dessus.")
            : t("D'autres voix françaises s'ajoutent dans Windows : Paramètres → Heure et langue → Voix.")}
        </span>
      </div>
      {testError && (
        <p className="text-xs text-amber-300">
          {t("Lecture du clip impossible sur ce PC, la voix Windows a pris le relais : {err}", { err: testError })}
        </p>
      )}
    </div>
  );
}

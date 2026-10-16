import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, ErrorBox, List, Loading } from "../components/ui";
import { useAsync } from "../hooks/useAsync";
import { api } from "../lib/api";
import { bridge } from "../lib/bridge";
import { AiSettings } from "../components/AiSettings";
import { CommunitySettings } from "../components/CommunitySettings";
import { LangSwitch, t } from "../lib/i18n";
import { OverlaySettings } from "../components/OverlaySettings";
import { RankCard } from "../components/RankCard";
import { ScreenCalibration } from "../components/ScreenCalibration";
import { UpdateButton } from "../components/UpdateButton";
import { VoiceProfiles } from "../components/VoiceProfiles";
import { VoiceSettings } from "../components/VoiceSettings";

type Tab = "general" | "voice" | "game" | "coach" | "community" | "app";

// Onglets (lien direct : /settings?tab=voice). Guide vocal et mode partie n'existent que dans l'application.
const tabs = (desktop: boolean): { id: Tab; label: string; icon: string }[] => [
  { id: "general", label: t("Compte & replays"), icon: "◆" },
  ...(desktop ? [
    { id: "voice" as Tab, label: t("Guide vocal"), icon: "♪" },
    { id: "game" as Tab, label: t("Mode partie & overlay"), icon: "◎" },
  ] : []),
  { id: "coach", label: t("Coach IA"), icon: "✦" },
  { id: "community", label: t("Communauté"), icon: "◈" },
  { id: "app", label: t("Application"), icon: "⚙" },
];

export function Settings() {
  const settings = useAsync(api.settings);
  const status = useAsync(api.replayStatus);
  const compliance = useAsync(api.compliance);
  const [params, setParams] = useSearchParams();
  const [replayDir, setReplayDir] = useState("");
  const [battletag, setBattletag] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

  useEffect(() => {
    if (settings.data) {
      setReplayDir(settings.data.replay_dir || settings.data.replay_dir_detected || "");
      setBattletag(settings.data.player_battletag);
    }
  }, [settings.data]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaved(null);
    setSaveError(null);
    try {
      const body: Record<string, string> = { player_battletag: battletag };
      if (replayDir && replayDir !== settings.data?.replay_dir_detected) body.replay_dir = replayDir;
      settings.setData(await api.saveSettings(body));
      setSaved(t("Paramètres enregistrés."));
      status.reload();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    }
  };

  const runImport = async () => {
    setImporting(true);
    setImportResult(null);
    try {
      const r = await api.importReplays();
      setImportResult(t("{imported} partie(s) importée(s), {duplicates} déjà connue(s), {failed} en échec.", { imported: r.imported, duplicates: r.duplicates, failed: r.failed }));
      status.reload();
    } catch (err) {
      setImportResult(err instanceof Error ? err.message : String(err));
    } finally {
      setImporting(false);
    }
  };

  if (settings.loading) return <Loading />;
  if (settings.error) return <ErrorBox message={settings.error} />;
  const s = settings.data!;
  const counts = status.data?.counts ?? {};
  const desktop = Boolean(bridge());
  const list = tabs(desktop);
  const tab = list.find((x) => x.id === params.get("tab"))?.id ?? "general";

  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="title-display text-3xl">{t("Paramètres")}</h1>

      <nav className="flex flex-wrap gap-2 border-b border-void-700 pb-3">
        {list.map((x) => (
          <button key={x.id} onClick={() => setParams({ tab: x.id }, { replace: true })}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition ${
              tab === x.id ? "bg-gradient-to-r from-nexus-700/70 to-storm-700/40 text-white shadow-glow" : "text-slate-400 hover:bg-void-800 hover:text-white"}`}>
            <span className="text-gold-400">{x.icon}</span>
            {x.label}
          </button>
        ))}
      </nav>

      {tab === "general" && (
        <>
          <form onSubmit={save}>
            <Card title={t("Mon compte")} action={<button className="btn-primary">{t("Enregistrer")}</button>}>
              <div className="grid gap-4">
                <label className="grid gap-1 text-sm">
                  <span className="text-slate-300">{t("Dossier des replays")}</span>
                  <input value={replayDir} onChange={(e) => setReplayDir(e.target.value)}
                    placeholder="C:\Users\…\Documents\Heroes of the Storm\Accounts\…\Replays\Multiplayer" />
                  <span className="text-xs text-slate-500">
                    {s.replay_dir_exists ? t("✔ Dossier trouvé") : t("✖ Dossier introuvable : collez le chemin de votre dossier Replays\\Multiplayer")}
                    {s.player_toon_handle && <> · {t("compte détecté")} <code>{s.player_toon_handle}</code></>}
                  </span>
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1 text-sm">
                    <span className="text-slate-300">BattleTag</span>
                    <input value={battletag} onChange={(e) => setBattletag(e.target.value)} placeholder={t("Pseudo#1234")} />
                  </label>
                  <div className="grid gap-1 text-sm">
                    <span className="text-slate-300">Langue / Language</span>
                    <div><LangSwitch /></div>
                  </div>
                </div>
                {saved && <div className="text-sm text-emerald-300">{saved}</div>}
                {saveError && <div className="text-sm text-rose-300">{saveError}</div>}
              </div>
            </Card>
          </form>

          <Card title="Replays">
            <div className="space-y-2 text-sm">
              <div>{t("Import automatique : {status}", { status: status.data?.watching ? t("✔ actif — chaque partie terminée est analysée") : t("inactif (dossier introuvable)") })}</div>
              {(status.data?.folders?.length ?? 0) > 1 && (
                <div className="text-xs text-slate-400">
                  {t("{n} dossiers surveillés (toutes vos régions) : {accounts}", { n: status.data!.folders!.length, accounts: status.data!.toon_handles?.join(", ") ?? "" })}
                </div>
              )}
              <div>{t("Parties analysées : {n}", { n: counts.parsed ?? 0 })}{counts.failed ? ` · ${t("{n} replay(s) illisible(s)", { n: counts.failed })}` : ""}</div>
              <div className="pt-1">
                <button className="btn-gold" onClick={runImport} disabled={importing}>{importing ? t("Import en cours…") : t("Importer mes anciens replays")}</button>
              </div>
              {importResult && <div className="text-gold-300">{importResult}</div>}
            </div>
          </Card>

          <RankCard />
        </>
      )}

      {tab === "voice" && desktop && (
        <>
          <Card title={t("Guide vocal")}>
            <VoiceSettings />
          </Card>
          <Card title={t("Enregistrer ma propre voix")}>
            <VoiceProfiles />
          </Card>
        </>
      )}

      {tab === "game" && desktop && (
        <>
          <Card title={t("Mode partie")}>
            <OverlaySettings />
          </Card>
          <Card title={t("Overlay : lecture de l'écran (horloge et niveaux)")}>
            <ScreenCalibration />
          </Card>
        </>
      )}

      {tab === "coach" && <AiSettings settings={s} onSaved={settings.setData} />}

      {tab === "community" && <CommunitySettings />}

      {tab === "app" && (
        <>
          {desktop && (
            <Card title="Application">
              <div className="space-y-3">
                <UpdateButton full />
                <div className="flex flex-wrap items-center gap-3 border-t border-void-700 pt-3 text-xs text-slate-500">
                  <span>{t("Données stockées dans {path}", { path: s.data_dir })}</span>
                  <button className="btn-ghost py-1" onClick={() => void bridge()?.openPath("logs")}>{t("Ouvrir le journal")}</button>
                </div>
              </div>
            </Card>
          )}
          {compliance.data && (
            <Card title={t("Conformité Blizzard")}>
              <p className="mb-3 text-sm text-white">{compliance.data.statement}</p>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="card-title">{t("Sources utilisées")}</h3>
                  <List items={Object.values(compliance.data.allowed_sources)} icon="✔" tone="text-emerald-300" />
                </div>
                <div>
                  <h3 className="card-title">{t("Jamais")}</h3>
                  <List items={compliance.data.forbidden} icon="✖" tone="text-rose-300" />
                </div>
              </div>
            </Card>
          )}
          {!desktop && <p className="text-xs text-slate-500">{t("Données stockées dans {path}", { path: s.data_dir })}</p>}
        </>
      )}
    </div>
  );
}

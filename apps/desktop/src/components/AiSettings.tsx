import { FormEvent, useState } from "react";
import { Card } from "./ui";
import { api } from "../lib/api";
import { t } from "../lib/i18n";
import type { AppSettings } from "../lib/types";

/** Choix de l'IA du coach : Claude, Gemini, ChatGPT, Mistral, OpenRouter, Ollama (local) ou toute API compatible OpenAI. */
export function AiSettings({ settings, onSaved }: { settings: AppSettings; onSaved: (s: AppSettings) => void }) {
  const [providerId, setProviderId] = useState(settings.ai_provider);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(settings.ai_model);
  const [baseUrl, setBaseUrl] = useState(settings.ai_base_url);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const provider = settings.providers.find((p) => p.id === providerId) ?? settings.providers[0];
  const isCurrent = providerId === settings.ai_provider;
  const hasKey = settings.ai_keys_set.includes(provider.id);

  const choose = (id: string) => {
    setProviderId(id);
    setApiKey("");
    setModel(settings.ai_models[id] ?? "");  // modèle mémorisé par fournisseur
    setMessage(null);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    try {
      const body: Parameters<typeof api.saveSettings>[0] = { ai_provider: provider.id, ai_model: model };
      if (apiKey) body.ai_api_key = apiKey;
      if (provider.id === "custom") body.ai_base_url = baseUrl;
      const saved = await api.saveSettings(body);
      onSaved(saved);
      setApiKey("");
      setMessage(saved.ai_ready
        ? { ok: true, text: t("Coach IA actif avec {provider}.", { provider: provider.label }) }
        : { ok: false, text: provider.needs_key ? t("Ajoutez une clé pour activer le coach.") : t("Renseignez l'adresse et le modèle.") });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : String(err) });
    }
  };

  return (
    <form onSubmit={save}>
      <Card title={t("Coach IA")} action={<button className="btn-primary">{t("Enregistrer")}</button>}>
        <div className="grid gap-4">
          <p className="text-xs text-slate-400">
            {t("Utilisez l'IA de votre choix. Sans IA, les rapports restent disponibles (version sans IA).")}{" "}
            {settings.ai_ready
              ? <span className="text-emerald-300">✔ {t("Actif : {provider}", { provider: settings.providers.find((p) => p.id === settings.ai_provider)?.label ?? "" })}</span>
              : <span className="text-slate-500">{t("Inactif pour l'instant.")}</span>}
          </p>

          <label className="grid gap-1 text-sm">
            <span className="text-slate-300">{t("Fournisseur")}</span>
            <select value={provider.id} onChange={(e) => choose(e.target.value)}>
              {settings.providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}{settings.ai_keys_set.includes(p.id) ? ` · ${t("clé enregistrée")}` : ""}
                </option>
              ))}
            </select>
          </label>

          {provider.needs_key && (
            <label className="grid gap-1 text-sm">
              <span className="text-slate-300">{t("Clé API")}</span>
              <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} autoComplete="off"
                placeholder={hasKey ? t("•••••••• (clé enregistrée — laisser vide pour la conserver)") : t("Collez votre clé")} />
              <span className="text-xs text-slate-500">
                {t("Clé à créer sur")} <code>{provider.key_url}</code>. {t("Elle reste sur votre PC.")}
              </span>
            </label>
          )}

          {provider.id === "ollama" && (
            <p className="text-xs text-slate-400">
              {t("Gratuit et 100 % local : installez Ollama")} (<code>{provider.key_url}</code>) {t("puis lancez")}{" "}
              <code>ollama pull {model || provider.default_model}</code>. {t("Aucune clé, aucune donnée envoyée sur Internet.")}
            </p>
          )}

          {provider.id === "custom" && (
            <label className="grid gap-1 text-sm">
              <span className="text-slate-300">{t("Adresse de l'API (compatible OpenAI)")}</span>
              <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="http://localhost:1234/v1" />
              <span className="text-xs text-slate-500">
                {t("LM Studio, Groq, DeepSeek, un serveur d'équipe… Clé facultative : ajoutez-la si le service en demande une.")}
              </span>
            </label>
          )}
          {provider.id === "custom" && (
            <label className="grid gap-1 text-sm">
              <span className="text-slate-300">{t("Clé API (facultative)")}</span>
              <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} autoComplete="off"
                placeholder={hasKey ? t("•••••••• (clé enregistrée)") : ""} />
            </label>
          )}

          <label className="grid gap-1 text-sm">
            <span className="text-slate-300">{t("Modèle")}</span>
            <input value={model} onChange={(e) => setModel(e.target.value)}
              placeholder={provider.default_model ? t("{model} (par défaut)", { model: provider.default_model }) : t("nom du modèle")} />
            <span className="text-xs text-slate-500">
              {provider.default_model ? t("Laissez vide pour le modèle par défaut.") : t("Obligatoire pour ce fournisseur.")}
            </span>
          </label>

          {provider.id !== "ollama" && (
            <p className="text-xs text-slate-500">
              {t("Les faits de vos parties (statistiques, HEROS SCORE) sont envoyés à {provider} pour rédiger l'analyse.", { provider: provider.label })}
            </p>
          )}
          {!isCurrent && <p className="text-xs text-gold-300">{t("Enregistrez pour passer à {provider}.", { provider: provider.label })}</p>}
          {message && <div className={`text-sm ${message.ok ? "text-emerald-300" : "text-rose-300"}`}>{message.text}</div>}
        </div>
      </Card>
    </form>
  );
}

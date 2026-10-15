import { FormEvent, useState } from "react";
import { Card } from "./ui";
import { api } from "../lib/api";
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
        ? { ok: true, text: `Coach IA actif avec ${provider.label}.` }
        : { ok: false, text: provider.needs_key ? "Ajoutez une clé pour activer le coach." : "Renseignez l'adresse et le modèle." });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : String(err) });
    }
  };

  return (
    <form onSubmit={save}>
      <Card title="Coach IA" action={<button className="btn-primary">Enregistrer</button>}>
        <div className="grid gap-4">
          <p className="text-xs text-slate-400">
            Utilisez l'IA de votre choix. Sans IA, les rapports restent disponibles (version sans IA).{" "}
            {settings.ai_ready
              ? <span className="text-emerald-300">✔ Actif : {settings.providers.find((p) => p.id === settings.ai_provider)?.label}</span>
              : <span className="text-slate-500">Inactif pour l'instant.</span>}
          </p>

          <label className="grid gap-1 text-sm">
            <span className="text-slate-300">Fournisseur</span>
            <select value={provider.id} onChange={(e) => choose(e.target.value)}>
              {settings.providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}{settings.ai_keys_set.includes(p.id) ? " · clé enregistrée" : ""}
                </option>
              ))}
            </select>
          </label>

          {provider.needs_key && (
            <label className="grid gap-1 text-sm">
              <span className="text-slate-300">Clé API</span>
              <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} autoComplete="off"
                placeholder={hasKey ? "•••••••• (clé enregistrée — laisser vide pour la conserver)" : "Collez votre clé"} />
              <span className="text-xs text-slate-500">
                Clé à créer sur <code>{provider.key_url}</code>. Elle reste sur votre PC.
              </span>
            </label>
          )}

          {provider.id === "ollama" && (
            <p className="text-xs text-slate-400">
              Gratuit et 100 % local : installez Ollama (<code>{provider.key_url}</code>) puis lancez{" "}
              <code>ollama pull {model || provider.default_model}</code>. Aucune clé, aucune donnée envoyée sur Internet.
            </p>
          )}

          {provider.id === "custom" && (
            <label className="grid gap-1 text-sm">
              <span className="text-slate-300">Adresse de l'API (compatible OpenAI)</span>
              <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="http://localhost:1234/v1" />
              <span className="text-xs text-slate-500">
                LM Studio, Groq, DeepSeek, un serveur d'équipe… Clé facultative : ajoutez-la si le service en demande une.
              </span>
            </label>
          )}
          {provider.id === "custom" && (
            <label className="grid gap-1 text-sm">
              <span className="text-slate-300">Clé API (facultative)</span>
              <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} autoComplete="off"
                placeholder={hasKey ? "•••••••• (clé enregistrée)" : ""} />
            </label>
          )}

          <label className="grid gap-1 text-sm">
            <span className="text-slate-300">Modèle</span>
            <input value={model} onChange={(e) => setModel(e.target.value)}
              placeholder={provider.default_model ? `${provider.default_model} (par défaut)` : "nom du modèle"} />
            <span className="text-xs text-slate-500">
              {provider.default_model ? "Laissez vide pour le modèle par défaut." : "Obligatoire pour ce fournisseur."}
            </span>
          </label>

          {provider.id !== "ollama" && (
            <p className="text-xs text-slate-500">
              Les faits de vos parties (statistiques, HEROS SCORE) sont envoyés à {provider.label} pour rédiger l'analyse.
            </p>
          )}
          {!isCurrent && <p className="text-xs text-gold-300">Enregistrez pour passer à {provider.label}.</p>}
          {message && <div className={`text-sm ${message.ok ? "text-emerald-300" : "text-rose-300"}`}>{message.text}</div>}
        </div>
      </Card>
    </form>
  );
}

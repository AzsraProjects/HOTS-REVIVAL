/**
 * Profils de voix : clips audio enregistrés par le joueur, rangés dans
 * <userData>/voices/<profil>/<clé>.<webm|ogg|wav|mp3>. Noms et clés sont assainis (aucun chemin hors du dossier).
 * Profils officiels : livrés avec l'application (resources/voices, voir scripts/export-voice-profile.mjs),
 * en lecture seule. Un profil du joueur portant le même nom a la priorité.
 */
import { app, BrowserWindow, dialog, shell } from "electron";
import fs from "node:fs";
import path from "node:path";
import { t } from "./i18n";

const EXT_MIME: Record<string, string> = { webm: "audio/webm", ogg: "audio/ogg", wav: "audio/wav", mp3: "audio/mpeg" };
const MAX_CLIP_BYTES = 10 * 1024 * 1024;
const KEY_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const RESERVED = /^(con|prn|aux|nul|com\d|lpt\d)$/i;

export interface VoiceClip { key: string; ext: string; size: number; mtime: number }
export interface ImportResult { imported: string[]; unmatched: { path: string; name: string }[] }

const root = () => path.join(app.getPath("userData"), "voices");
const builtinRoot = () => app.isPackaged ? path.join(process.resourcesPath, "voices") : path.join(app.getAppPath(), "resources", "voices");

const dirNames = (dir: string): string[] => {
  try {
    return fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  } catch {
    return [];
  }
};

/** Profils officiels non remplacés par un profil du joueur du même nom. */
export function listBuiltinProfiles(): string[] {
  const own = new Set(dirNames(root()).map((n) => n.toLowerCase()));
  return dirNames(builtinRoot()).filter((n) => !own.has(n.toLowerCase())).sort();
}

/** Nom de profil lisible mais sûr comme nom de dossier Windows. */
export function cleanProfileName(name: unknown): string {
  const clean = String(name ?? "")
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 40)
    .trim();
  if (!clean || RESERVED.test(clean)) throw new Error(t("Nom de profil invalide."));
  return clean;
}

function cleanKey(key: unknown): string {
  const k = String(key ?? "");
  if (!KEY_RE.test(k)) throw new Error(t("Clé de phrase invalide : {key}", { key: k }));
  return k;
}

/** Dossier modifiable d'un profil du joueur (jamais un profil officiel). */
function profileDir(name: unknown, mustExist = true): string {
  const dir = path.join(root(), cleanProfileName(name));
  if (path.dirname(dir) !== root()) throw new Error(t("Chemin invalide."));
  if (mustExist && !fs.existsSync(dir)) {
    if (isBuiltin(name)) throw new Error(t("Profil officiel : il ne peut pas être modifié."));
    throw new Error(t("Profil introuvable."));
  }
  return dir;
}

function isBuiltin(name: unknown): boolean {
  const clean = cleanProfileName(name).toLowerCase();
  return listBuiltinProfiles().some((n) => n.toLowerCase() === clean);
}

/** Dossier à lire : profil du joueur, sinon profil officiel. */
function readableDir(name: unknown): string {
  const own = path.join(root(), cleanProfileName(name));
  if (path.dirname(own) !== root()) throw new Error(t("Chemin invalide."));
  if (fs.existsSync(own)) return own;
  const builtin = path.join(builtinRoot(), cleanProfileName(name));
  if (fs.existsSync(builtin)) return builtin;
  throw new Error(t("Profil introuvable."));
}

/** Tous les profils : ceux du joueur puis les officiels. */
export function listProfiles(): string[] {
  return [...dirNames(root()).sort(), ...listBuiltinProfiles()];
}

export function createProfile(name: unknown): string {
  const dir = profileDir(name, false);
  if (fs.existsSync(dir) || isBuiltin(name)) throw new Error(t("Un profil porte déjà ce nom."));
  fs.mkdirSync(dir, { recursive: true });
  return path.basename(dir);
}

export function renameProfile(from: unknown, to: unknown): string {
  const src = profileDir(from);
  const dst = profileDir(to, false);
  if (src === dst) return path.basename(dst);
  // Windows : un simple changement de casse renvoie « existe déjà »
  if ((fs.existsSync(dst) || isBuiltin(to)) && src.toLowerCase() !== dst.toLowerCase()) throw new Error(t("Un profil porte déjà ce nom."));
  fs.renameSync(src, dst);
  return path.basename(dst);
}

export function deleteProfile(name: unknown): void {
  fs.rmSync(profileDir(name), { recursive: true, force: true });
}

export function listClips(profile: unknown): VoiceClip[] {
  const dir = readableDir(profile);
  const clips: VoiceClip[] = [];
  for (const file of fs.readdirSync(dir)) {
    const ext = path.extname(file).slice(1).toLowerCase();
    const key = path.basename(file, path.extname(file));
    if (!EXT_MIME[ext] || !KEY_RE.test(key)) continue;
    const st = fs.statSync(path.join(dir, file));
    clips.push({ key, ext, size: st.size, mtime: st.mtimeMs });
  }
  return clips;
}

function clipFile(dir: string, key: string): string | null {
  for (const ext of Object.keys(EXT_MIME)) {
    const file = path.join(dir, `${key}.${ext}`);
    if (fs.existsSync(file)) return file;
  }
  return null;
}

export function deleteClip(profile: unknown, key: unknown): void {
  const dir = profileDir(profile);
  const k = cleanKey(key);
  for (const ext of Object.keys(EXT_MIME)) fs.rmSync(path.join(dir, `${k}.${ext}`), { force: true });
}

export function saveClip(profile: unknown, key: unknown, data: Uint8Array, ext: unknown = "webm"): VoiceClip {
  const e = String(ext).toLowerCase();
  if (!EXT_MIME[e]) throw new Error(t("Format audio non pris en charge."));
  const bytes = Buffer.from(data);
  if (!bytes.length || bytes.length > MAX_CLIP_BYTES) throw new Error(t("Enregistrement vide ou trop long."));
  const dir = profileDir(profile);
  const k = cleanKey(key);
  deleteClip(profile, k); // un seul fichier par phrase, quel que soit le format
  fs.writeFileSync(path.join(dir, `${k}.${e}`), bytes);
  return { key: k, ext: e, size: bytes.length, mtime: Date.now() };
}

/** Octets d'un clip (lus dans le rendu via un Blob : pas d'accès file:// depuis la page). */
export function readClip(profile: unknown, key: unknown): { data: Uint8Array; mime: string } | null {
  const file = clipFile(readableDir(profile), cleanKey(key));
  if (!file) return null;
  return { data: new Uint8Array(fs.readFileSync(file)), mime: EXT_MIME[path.extname(file).slice(1).toLowerCase()] };
}

// Fichiers choisis dans la dernière boîte de dialogue : seuls ceux-là peuvent être attribués ensuite.
let picked = new Set<string>();

/** Importe des fichiers audio : un fichier nommé comme une clé (ex. « ally-level-10.mp3 ») est rangé directement. */
export async function importClips(win: BrowserWindow | null, profile: unknown, keys: unknown): Promise<ImportResult> {
  const dir = profileDir(profile);
  const known = new Set(Array.isArray(keys) ? keys.map(String) : []);
  const opts: Electron.OpenDialogOptions = {
    title: t("Importer des enregistrements"),
    properties: ["openFile", "multiSelections"],
    filters: [{ name: "Audio", extensions: Object.keys(EXT_MIME) }],
  };
  const res = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts);
  const result: ImportResult = { imported: [], unmatched: [] };
  picked = new Set(res.canceled ? [] : res.filePaths);
  for (const file of picked) {
    const ext = path.extname(file).slice(1).toLowerCase();
    const key = path.basename(file, path.extname(file)).trim().toLowerCase().replace(/[\s_]+/g, "-");
    if (EXT_MIME[ext] && known.has(key) && KEY_RE.test(key)) {
      copyClip(dir, profile, key, file);
      result.imported.push(key);
    } else {
      result.unmatched.push({ path: file, name: path.basename(file) });
    }
  }
  return result;
}

function copyClip(dir: string, profile: unknown, key: string, file: string): void {
  const ext = path.extname(file).slice(1).toLowerCase();
  if (!EXT_MIME[ext]) throw new Error(t("Format audio non pris en charge."));
  if (fs.statSync(file).size > MAX_CLIP_BYTES) throw new Error(t("Fichier trop volumineux."));
  deleteClip(profile, key);
  fs.copyFileSync(file, path.join(dir, `${key}.${ext}`));
}

/** Attribue à une phrase un fichier choisi lors du dernier import (nom non reconnu). */
export function assignImported(profile: unknown, key: unknown, file: unknown): void {
  const f = String(file);
  if (!picked.has(f)) throw new Error(t("Fichier non sélectionné."));
  copyClip(profileDir(profile), profile, cleanKey(key), f);
}

export function openProfileFolder(profile: unknown): Promise<string> {
  return shell.openPath(readableDir(profile));
}

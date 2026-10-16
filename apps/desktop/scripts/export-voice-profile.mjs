// Publie un profil de voix enregistré dans l'application comme profil officiel (livré à tous les joueurs).
// Convertit chaque clip en Opus (≈10 fois plus léger que le WAV) dans resources/voices/<profil>/.
// Usage : node scripts/export-voice-profile.mjs "Mega Chad"   (ffmpeg requis : PATH ou variable FFMPEG)
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const name = process.argv[2];
if (!name) {
  console.error('Usage : node scripts/export-voice-profile.mjs "<profil>"');
  process.exit(1);
}
const ffmpeg = process.env.FFMPEG || "ffmpeg";
const src = join(process.env.HOTS_DATA_DIR || join(process.env.APPDATA ?? "", "HOTS REVIVAL"), "voices", name);
const dst = join(dirname(fileURLToPath(import.meta.url)), "..", "resources", "voices", name);

rmSync(dst, { recursive: true, force: true });
mkdirSync(dst, { recursive: true });
let before = 0;
let after = 0;
for (const file of readdirSync(src)) {
  if (![".wav", ".webm", ".ogg", ".mp3"].includes(extname(file).toLowerCase())) continue;
  const out = join(dst, `${basename(file, extname(file))}.ogg`);
  // mono 48 kb/s : largement suffisant pour de la voix, métadonnées retirées
  execFileSync(ffmpeg, ["-v", "error", "-y", "-i", join(src, file), "-map_metadata", "-1", "-ac", "1", "-c:a", "libopus", "-b:a", "48k", out]);
  before += statSync(join(src, file)).size;
  after += statSync(out).size;
}
console.log(`${name} : ${(before / 1e6).toFixed(1)} Mo → ${(after / 1e6).toFixed(2)} Mo (${dst})`);

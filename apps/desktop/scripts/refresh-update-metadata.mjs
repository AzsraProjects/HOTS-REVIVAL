// Après la signature de l'installeur, son empreinte change : on régénère le .blockmap
// et on remet sha512 + taille à jour dans latest.yml, sinon electron-updater refuse la mise à jour.
// Usage : node scripts/refresh-update-metadata.mjs (dans apps/desktop, après electron-builder)
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const RELEASE = join(dirname(fileURLToPath(import.meta.url)), "..", "release");
const { appBuilderPath } = createRequire(import.meta.url)("app-builder-bin");

const latestPath = join(RELEASE, "latest.yml");
let latest = readFileSync(latestPath, "utf8");
const exe = readdirSync(RELEASE).find((f) => f.endsWith(".exe"));
if (!exe) throw new Error(`Aucun installeur dans ${RELEASE}`);

const out = execFileSync(appBuilderPath, ["blockmap", "--input", join(RELEASE, exe), "--output", join(RELEASE, `${exe}.blockmap`)]);
const { sha512, size } = JSON.parse(out.toString());

const oldSha = latest.match(/^sha512: (.+)$/m)?.[1];
if (!oldSha) throw new Error("sha512 introuvable dans latest.yml");
latest = latest.split(oldSha).join(sha512).replace(/^(\s+size: )\d+$/m, `$1${size}`);
writeFileSync(latestPath, latest);
console.log(`latest.yml : ${exe} → ${size} octets, sha512 ${sha512.slice(0, 16)}…`);

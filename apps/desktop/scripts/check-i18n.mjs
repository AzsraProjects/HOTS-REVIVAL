// Vérifie que chaque texte passé à t("…") a sa traduction anglaise :
//  - interface (src/) : dictionnaires src/lib/en/*.ts
//  - processus principal (electron/) : electron/en.ts
// Usage : npm run i18n:check (inclus dans npm run typecheck)
import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const STRING = String.raw`"((?:[^"\\]|\\.)*)"`;
const KEY = new RegExp(String.raw`^\s*${STRING}:`, "gm");
const CALL = new RegExp(String.raw`\bt\(\s*${STRING}`, "g");

const list = (dir, keep) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? list(p, keep) : keep(p) ? [p] : [];
});
const keysOf = (files) => new Set(files.flatMap((f) => [...readFileSync(f, "utf8").matchAll(KEY)].map((m) => m[1])));

const areas = [
  { name: "interface", dir: join(ROOT, "src"), dict: list(join(ROOT, "src", "lib", "en"), (p) => p.endsWith(".ts")) },
  { name: "electron", dir: join(ROOT, "electron"), dict: [join(ROOT, "electron", "en.ts")] },
];

let missing = 0;
for (const area of areas) {
  const keys = keysOf(area.dict);
  const skip = new Set([...area.dict, join(area.dir, "lib", "i18n.tsx"), join(area.dir, "i18n.ts")]);
  for (const file of list(area.dir, (p) => /\.tsx?$/.test(p) && !skip.has(p))) {
    for (const m of readFileSync(file, "utf8").matchAll(CALL)) {
      if (!keys.has(m[1])) {
        missing++;
        console.error(`[${area.name}] ${basename(file)} : ${m[1]}`);
      }
    }
  }
  console.log(`[${area.name}] ${keys.size} traductions`);
}
if (missing) {
  console.error(`${missing} traduction(s) anglaise(s) manquante(s).`);
  process.exit(1);
}

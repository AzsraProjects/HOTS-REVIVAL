// Vérifie que chaque texte passé à t("…") (et chaque libellé `fr: "…"`) a sa traduction
// dans src/lib/en.ts. Usage : npm run i18n:check
import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const STRING = String.raw`"((?:[^"\\]|\\.)*)"`;

const en = readFileSync(join(SRC, "lib", "en.ts"), "utf8");
const keys = new Set([...en.matchAll(new RegExp(String.raw`^\s*${STRING}:`, "gm"))].map((m) => m[1]));

const files = [];
(function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.tsx?$/.test(f) && !["en.ts", "i18n.tsx"].includes(f)) files.push(p);
  }
})(SRC);

const missing = new Set();
for (const file of files) {
  const src = readFileSync(file, "utf8");
  for (const re of [new RegExp(String.raw`\bt\(\s*${STRING}`, "g"), new RegExp(String.raw`\bfr: ${STRING}`, "g")]) {
    for (const m of src.matchAll(re)) if (!keys.has(m[1])) missing.add(`${basename(file)} : ${m[1]}`);
  }
}
if (missing.size) {
  console.error(`${missing.size} traduction(s) manquante(s) :\n${[...missing].join("\n")}`);
  process.exit(1);
}
console.log(`${keys.size} traductions, aucune manquante.`);

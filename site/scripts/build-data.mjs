// Prépare les données statiques du site à partir du référentiel de l'application
// (backend/app/data) et des fichiers héros de heroes-talents (MIT) pour les icônes.
// Usage : npm run data   (à relancer quand un héros ou une carte est ajouté)
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "..", "backend", "app", "data");
// Version figée de heroes-talents (doit correspondre à src/lib/assets.ts).
const HT_SHA = "2dcbbf65f81bc3ce85926a5f90b6d8b44d1e4027";
const HT = `https://cdn.jsdelivr.net/gh/heroespatchnotes/heroes-talents@${HT_SHA}`;

const normalize = (s) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const read = (f) => JSON.parse(readFileSync(join(DATA, f), "utf8"));

const heroes = read("heroes.json").heroes;
const maps = read("maps.json");
const talents = read("talents.json").heroes;

// Fichiers héros de heroes-talents : nom -> icône du portrait et icônes des talents.
const list = await (await fetch(`https://data.jsdelivr.com/v1/packages/gh/heroespatchnotes/heroes-talents@${HT_SHA}?structure=flat`)).json();
const files = list.files.map((f) => f.name).filter((n) => /^\/hero\/[^/]+\.json$/.test(n));
const sources = {};
await Promise.all(files.map(async (f) => {
  const h = await (await fetch(`${HT}${f}`)).json();
  sources[normalize(h.name)] = h;
}));

const outHeroes = [];
const talentDir = join(ROOT, "public", "data", "talents");
rmSync(talentDir, { recursive: true, force: true });
mkdirSync(talentDir, { recursive: true });

for (const h of heroes) {
  const src = sources[normalize(h.name)] ?? sources[normalize(h.id)];
  outHeroes.push({ id: h.id, name: h.name, role: h.role, portrait: src?.icon ?? null });

  // Talents par identifiant de replay (talentTreeId) : nom, niveau, description, icône.
  const icons = {};
  for (const items of Object.values(src?.talents ?? {})) for (const t of items) icons[t.talentTreeId] = t.icon;
  const byId = {};
  for (const [level, items] of Object.entries(talents[h.id]?.talents ?? {})) {
    for (const t of items) {
      byId[t.id] = { name: t.name, level: Number(level), sort: t.sort, description: t.description,
        icon: icons[t.id] ?? null };
    }
  }
  writeFileSync(join(talentDir, `${h.id}.json`), JSON.stringify(byId));
}

// Nom de carte affiché : premier alias français (sans article), sinon le nom anglais.
const frName = (m) => (m.aliases ?? []).find((a) => /[a-zà-ÿ]/i.test(a) && !/^[A-Z][a-z]+[A-Z]/.test(a)) ?? m.name;
const outMaps = [
  ...maps.maps.map((m) => ({ id: m.id, name: frName(m), en: m.name, aram: false })),
  ...maps.aram_maps.map((m) => ({ id: m.id, name: frName(m), en: m.name, aram: true })),
];

mkdirSync(join(ROOT, "src", "data"), { recursive: true });
writeFileSync(join(ROOT, "src", "data", "heroes.json"), JSON.stringify(outHeroes, null, 1));
writeFileSync(join(ROOT, "src", "data", "maps.json"), JSON.stringify(outMaps, null, 1));
const missing = outHeroes.filter((h) => !h.portrait).map((h) => h.name);
console.log(`${outHeroes.length} héros, ${outMaps.length} cartes${missing.length ? ` ; sans portrait : ${missing.join(", ")}` : ""}`);

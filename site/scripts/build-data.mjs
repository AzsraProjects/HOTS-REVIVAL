// Prépare les données statiques du site à partir du référentiel de l'application
// (backend/app/data : héros, cartes et catalogue de talents au dernier patch, issu de heroes-data2).
// Images : celles de heroes-talents (MIT, figé en 2023) sont servies par jsDelivr ; celles qui y
// manquent (héros et talents plus récents) sont copiées depuis heroes-images (MIT) dans public/img,
// jsDelivr refusant ce dépôt (plus de 50 Mo).
// Usage : npm run data   (à relancer après backend/scripts/build_talent_catalog.py)
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "..", "backend", "app", "data");
// Versions figées (heroes-talents : doit correspondre à src/lib/game.ts).
const HT_SHA = "2dcbbf65f81bc3ce85926a5f90b6d8b44d1e4027";
const HT = `https://cdn.jsdelivr.net/gh/heroespatchnotes/heroes-talents@${HT_SHA}`;
const HI = "https://raw.githubusercontent.com/HeroesToolChest/heroes-images/ea99cc6327291e6354770f458ab06c52812b9a61/heroesimages";

const normalize = (s) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const read = (f) => JSON.parse(readFileSync(join(DATA, f), "utf8"));

const heroes = read("heroes.json").heroes;
const maps = read("maps.json");
const talents = read("talents.json").heroes;

// heroes-talents : portraits par héros, et liste des icônes de talents disponibles.
const list = await (await fetch(`https://data.jsdelivr.com/v1/packages/gh/heroespatchnotes/heroes-talents@${HT_SHA}?structure=flat`)).json();
const names = list.files.map((f) => f.name);
const htIcons = new Set(names.filter((n) => n.startsWith("/images/talents/")).map((n) => n.slice("/images/talents/".length)));
const portraits = {};
const oldIcons = {}; // icônes des talents retirés depuis, par identifiant de replay
await Promise.all(names.filter((n) => /^\/hero\/[^/]+\.json$/.test(n)).map(async (f) => {
  const h = await (await fetch(`${HT}${f}`)).json();
  portraits[normalize(h.name)] = h.icon;
  for (const items of Object.values(h.talents ?? {})) for (const t of items) oldIcons[t.talentTreeId] = t.icon;
}));

// Copie locale (une fois) d'une image de heroes-images ; renvoie son chemin sur le site.
const IMG = join(ROOT, "public", "img");
const copied = [];
async function local(folder, file) {
  const dest = join(IMG, folder, file);
  if (!existsSync(dest)) {
    const r = await fetch(`${HI}/${folder}/${file}`);
    if (!r.ok) throw new Error(`image introuvable : ${folder}/${file} (${r.status})`);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
    copied.push(file);
  }
  return `/img/${folder}/${file}`;
}
const iconUrl = async (icon) => (!icon ? null : htIcons.has(icon) ? `${HT}/images/talents/${icon}` : local("abilitytalents", icon));

const outHeroes = [];
const talentDir = join(ROOT, "public", "data", "talents");
rmSync(talentDir, { recursive: true, force: true });
mkdirSync(talentDir, { recursive: true });

for (const h of heroes) {
  const src = talents[h.id];
  const ht = portraits[normalize(h.name)] ?? portraits[normalize(h.id)];
  // Portrait carré du jeu (même cadrage que ceux de heroes-talents) pour les héros récents.
  const portrait = ht ? `${HT}/images/heroes/${ht}`
    : src?.portrait ? await local("heroportraits", `ui_targetportrait_hero_${src.portrait.replace(/^storm_ui_ingame_heroselect_btn_/, "")}`)
    : null;
  outHeroes.push({ id: h.id, name: h.name, role: h.role, portrait });

  // Talents par identifiant de replay : nom, niveau, description, icône. Les talents retirés du
  // jeu (anciens replays) sont marqués pour ne pas être proposés dans les paliers actuels.
  const byId = {};
  for (const t of src?.retired ?? []) {
    byId[t.id] = { name: t.name, level: t.level, sort: t.sort, description: t.description, icon: await iconUrl(t.icon ?? oldIcons[t.id]), retired: true };
  }
  for (const [level, items] of Object.entries(src?.talents ?? {})) {
    for (const t of items) {
      byId[t.id] = { name: t.name, level: Number(level), sort: t.sort, description: t.description, icon: await iconUrl(t.icon) };
    }
  }
  writeFileSync(join(talentDir, `${h.id}.json`), JSON.stringify(byId));
}
if (copied.length) console.log(`${copied.length} images copiées depuis heroes-images`);

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

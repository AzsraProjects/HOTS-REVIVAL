// Génère dist/sitemap.xml (pages fixes + une page par héros) pour Google Search Console.
// Lancé par npm run build, après vite build. Les profils joueurs n'y figurent pas : ils
// changent (opt-in, réversible) et Google les trouve depuis la page Joueurs.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE_URL = "https://hots-revival.pages.dev";
const heroes = JSON.parse(readFileSync(join(ROOT, "src", "data", "heroes.json"), "utf8"));

const paths = ["/", "/heros", "/joueurs", "/a-propos", ...heroes.map((h) => `/heros/${h.id}`)];
const today = new Date().toISOString().slice(0, 10);
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths.map((p) => `  <url><loc>${SITE_URL}${p}</loc><lastmod>${today}</lastmod></url>`).join("\n")}
</urlset>
`;
writeFileSync(join(ROOT, "dist", "sitemap.xml"), xml);
console.log(`sitemap.xml : ${paths.length} pages`);

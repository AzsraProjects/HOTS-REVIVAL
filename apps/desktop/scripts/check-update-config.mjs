// Garde-fou des mises à jour : la configuration embarquée dans electron/updater.ts doit viser
// le dépôt où la construction publie les versions (package.json, build.publish).
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const updater = readFileSync("electron/updater.ts", "utf8");
const publish = pkg.build.publish.find((p) => p.provider === "github");
const expected = [`owner: ${publish.owner}`, `repo: ${publish.repo}`, "provider: github", "updaterCacheDirName: hots-revival-desktop-updater"];
const missing = expected.filter((line) => !updater.includes(`"${line}"`));
if (missing.length) {
  console.error(`[mises à jour] configuration embarquée différente de package.json : ${missing.join(", ")}`);
  process.exit(1);
}
console.log(`[mises à jour] ${publish.owner}/${publish.repo}`);

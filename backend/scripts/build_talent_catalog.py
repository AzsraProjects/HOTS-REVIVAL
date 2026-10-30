"""Génère app/data/talents.json depuis heroes-data2 (MIT, github.com/HeroesToolChest/heroes-data2),
les données extraites du jeu à chaque patch par Heroes Data Parser.

heroes-data2 publie une version complète puis, pour chaque patch (PTR compris), les différences
au format JSON Patch : on part de la version complète et on applique les patchs dans l'ordre.

Usage : python scripts/build_talent_catalog.py   (à relancer après un patch ou un nouveau héros)
"""
import json
import re
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.reference import registry  # noqa: E402

# Version figée de heroes-data2 (changer le commit pour passer à un patch plus récent).
SHA = "f299c1aed1f8e4a5ab5af2e07f8a2b4aa9c1106c"
BASE = f"https://raw.githubusercontent.com/HeroesToolChest/heroes-data2/{SHA}/heroesdata"


def fetch(path: str):
    with urllib.request.urlopen(f"{BASE}/{path}", timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def _tokens(path: str) -> list[str]:
    return [t.replace("~1", "/").replace("~0", "~") for t in path.split("/")[1:]]


def apply_patch(doc, ops: list[dict]):
    for op in ops:
        *parents, last = _tokens(op["path"])
        node = doc
        for t in parents:
            node = node[int(t)] if isinstance(node, list) else node[t]
        if op["op"] in ("add", "replace"):
            if isinstance(node, list):
                i = len(node) if last == "-" else int(last)
                if op["op"] == "add":
                    node.insert(i, op["value"])
                else:
                    node[i] = op["value"]
            else:
                node[last] = op["value"]
        elif op["op"] == "remove":
            del node[int(last) if isinstance(node, list) else last]
        else:
            raise ValueError(f"opération JSON Patch non gérée : {op['op']}")
    return doc


def latest(name: str) -> dict:
    """`name` : « herodata » ou « gamestrings_{lang} » ; version complète + patchs successifs."""
    index = fetch(".version.json")
    full = index["latest-full"]
    versions = index["versions"]

    def file(version: str, patch: bool) -> str:
        build = version.split(".")[3].split("_")[0]
        folder = "data" if name == "herodata" else "gamestrings"
        stem = f"herodata_{build}" if name == "herodata" else f"gamestrings_{build}_{name.split('_')[1]}"
        return f"{version}/{folder}/{stem}{'.patch' if patch else ''}.json"

    doc = fetch(file(full, False))
    for version in versions[versions.index(full) + 1:]:
        doc = apply_patch(doc, fetch(file(version, True)))
    return doc


def clean(text: str) -> str:
    """Infobulle du jeu -> texte simple (retours à la ligne, couleurs et icônes retirés)."""
    text = re.sub(r"<n\s*/>", " ", text or "")
    text = re.sub(r"<img[^>]*/>", "", text)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"~~[^~]*~~", "", text)  # gain par niveau (« 90~~0.04~~ » = 90, +4 % par niveau)
    return re.sub(r"\s+", " ", text).strip()[:280]


dest = Path(__file__).resolve().parents[1] / "app" / "data" / "talents.json"
# Talents retirés du jeu depuis : gardés pour nommer ceux des anciens replays.
previous = json.loads(dest.read_text(encoding="utf-8"))["heroes"] if dest.exists() else {}


def retired(old: dict, talents: dict) -> list[dict]:
    current = {t["id"] for items in talents.values() for t in items}
    out = [{**t, "level": int(level)} for level, items in old.get("talents", {}).items() for t in items]
    out += old.get("retired", [])
    seen: set[str] = set()
    return [t for t in out if t["id"] not in current and not (t["id"] in seen or seen.add(t["id"]))]


heroes = latest("herodata")
strings = latest("gamestrings_enus")["items"]
french = latest("gamestrings_frfr")["items"]  # noms des héros dans les replays d'un jeu en français
version = heroes["meta"]["heroesVersion"]
out: dict = {"_meta": {"source": "https://github.com/HeroesToolChest/heroes-data2", "license": "MIT",
                       "game_version": version}, "heroes": {}}
for key, d in heroes["items"].items():
    name = strings["hero"]["name"].get(key, key)
    hero = registry().resolve_hero(name) or registry().resolve_hero(d.get("unitId", "")) or registry().resolve_hero(key)
    if not hero:
        print("héros non reconnu :", key, name)
        continue
    talents = {}
    for level_key, items in d["talents"].items():
        level = level_key.removeprefix("Level")
        talents[level] = [
            {"id": t["talentId"], "name": strings["talent"]["name"].get(t["linkId"], t["talentId"]).strip(), "sort": t["sort"],
             "description": clean(strings["talent"]["fullText"].get(t["linkId"], "")), "icon": t.get("icon")}
            for t in sorted(items, key=lambda t: t["sort"])
        ]
    out["heroes"][hero.id] = {
        "name": name, "name_fr": french["hero"]["name"].get(key), "role": strings["hero"].get("expandedRole", {}).get(key), "attribute_id": d.get("attributeId"),
        "unit_id": d.get("unitId"), "slug": d.get("hyperlinkId"), "portrait": d.get("portraits", {}).get("heroSelect"),
        "talents": talents,
        "retired": retired(previous.get(hero.id, {}), talents),
    }
missing = sorted(set(registry().heroes) - set(out["heroes"]))
if missing:
    print("héros du référentiel absents des données :", ", ".join(missing))
dest.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(f"patch {version} : {len(out['heroes'])} héros -> {dest} ({dest.stat().st_size // 1024} Ko)")

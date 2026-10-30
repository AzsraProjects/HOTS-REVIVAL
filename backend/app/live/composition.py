"""Compositions des deux équipes lues sur l'écran de chargement (information publique
affichée à tous les joueurs). L'application envoie les mots reconnus par OCR avec leur
position ; on y retrouve les noms de héros (français ou anglais) et les pseudos des
joueurs du fichier de chargement, puis on sépare les deux équipes par leur position.
"""
from __future__ import annotations

import unicodedata
from dataclasses import dataclass

from app.reference import registry
from app.talents import catalog

# Variantes lues à l'écran en plus des noms officiels (anglais et français, voir hero_names).
FRENCH_NAMES: dict[str, list[str]] = {
    "butcher": ["Boucher"],
    "sgthammer": ["Sergent Marteau", "Sgt. Marteau"],
    "lostvikings": ["Vikings perdus", "Les Vikings"],
    "deathwing": ["Aile-de-mort"],
}


@dataclass
class Word:
    text: str
    x: float  # centre, fraction de l'écran
    y: float
    h: float = 0.02


@dataclass
class Found:
    key: str  # hero_id ou pseudo
    x: float
    y: float


def norm(text: str) -> str:
    text = unicodedata.normalize("NFKD", text)
    return "".join(c for c in text.lower() if c.isalnum())


def _distance(a: str, b: str) -> int:
    if abs(len(a) - len(b)) > 2:
        return 3
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def _same(read: str, name: str) -> bool:
    if len(name) <= 4:  # Cho, Gall, Ana, Mei, Nova… : exact uniquement
        return read == name
    return _distance(read, name) <= (1 if len(name) <= 7 else 2)


def hero_names() -> dict[str, str]:
    """nom normalisé -> hero_id"""
    out: dict[str, str] = {}
    french = catalog()
    for hero_id, hero in registry().heroes.items():
        out[norm(hero.name)] = hero_id
        if hero.name.lower().startswith("the "):
            out[norm(hero.name[4:])] = hero_id
        for alias in [french.get(hero_id, {}).get("name_fr") or "", *FRENCH_NAMES.get(hero_id, [])]:
            if alias:
                out[norm(alias)] = hero_id
    return out


def _windows(words: list[Word], size: int):
    """Groupes de 1 à `size` mots consécutifs sur une même ligne."""
    for i in range(len(words)):
        group = [words[i]]
        yield group
        for w in words[i + 1:i + size]:
            if abs(w.y - group[0].y) > max(w.h, group[0].h) or w.x < group[-1].x:
                break
            group = [*group, w]
            yield group


def find_heroes(words: list[Word]) -> list[Found]:
    names = hero_names()
    found: list[Found] = []
    for group in _windows(words, 3):
        read = norm("".join(w.text for w in group))
        if len(read) < 3:
            continue
        hero_id = names.get(read) or next((h for n, h in names.items() if _same(read, n)), None)
        if hero_id:
            x = sum(w.x for w in group) / len(group)
            y = sum(w.y for w in group) / len(group)
            if not any(f.key == hero_id and abs(f.x - x) < 0.05 and abs(f.y - y) < 0.05 for f in found):
                found.append(Found(hero_id, x, y))
    return found


def find_players(words: list[Word], players: list[str]) -> list[Found]:
    wanted = {norm(p): p for p in players if norm(p)}
    found: list[Found] = []
    for w in words:
        read = norm(w.text)
        if len(read) < 3:
            continue
        match = wanted.get(read) or next((p for n, p in wanted.items() if _same(read, n)), None)
        if match and not any(f.key == match for f in found):
            found.append(Found(match, w.x, w.y))
    return found


def split_teams(points: list[Found]) -> tuple[list[Found], list[Found]]:
    """Deux équipes = deux groupes séparés par le plus grand écart (en hauteur ou en largeur)."""
    if len(points) < 2:
        return points, []
    best: tuple[float, str, float] = (0.0, "y", 0.0)
    for axis in ("x", "y"):
        values = sorted(getattr(p, axis) for p in points)
        for a, b in zip(values, values[1:]):
            if b - a > best[0]:
                best = (b - a, axis, (a + b) / 2)
    gap, axis, cut = best
    if gap < 0.08:
        return points, []
    first = [p for p in points if getattr(p, axis) < cut]
    second = [p for p in points if getattr(p, axis) >= cut]
    return first, second


PAIR_MAX = 0.15  # distance maximale pseudo -> nom du héros (avant apprentissage du décalage)
PAIR_MAX_ALIGNED = 0.08  # une fois le décalage pseudo -> héros connu


def _distance_2d(p: Found, h: Found, offset: tuple[float, float]) -> float:
    return (((h.x - p.x - offset[0]) * 1.5) ** 2 + (h.y - p.y - offset[1]) ** 2) ** 0.5


def _pair(players: list[Found], heroes: list[Found], offset: tuple[float, float], limit: float) -> dict[int, int]:
    """Appariement global : les couples les plus proches d'abord (un pseudo lu sans son héros
    ne prend plus le héros de son voisin parce qu'il a été traité avant lui)."""
    candidates = sorted((_distance_2d(p, h, offset), i, j)
                        for i, p in enumerate(players) for j, h in enumerate(heroes))
    pairs: dict[int, int] = {}
    for d, i, j in candidates:
        if d >= limit:
            break
        if i not in pairs and j not in pairs.values():
            pairs[i] = j
    return pairs


def _median(values: list[float]) -> float:
    values = sorted(values)
    mid = len(values) // 2
    return values[mid] if len(values) % 2 else (values[mid - 1] + values[mid]) / 2


def read_composition(words: list[Word], lobby_players: list[str], my_names: set[str]) -> dict[str, dict]:
    """Associe chaque héros reconnu à un joueur et à une équipe.
    Retourne {clé: {hero_id, player, x, y, me}} — la clé est le pseudo, ou le héros sans pseudo.
    Un pseudo lu sans héros est gardé (hero_id None) : il situe le joueur et son équipe."""
    names = [p.split("#")[0] for p in lobby_players]
    players = find_players(words, names)
    # un pseudo de la partie n'est jamais pris pour un héros (ex. joueur « silvanas »)
    taken = {(p.x, p.y) for p in players}
    heroes = find_heroes([w for w in words if (w.x, w.y) not in taken])
    pairs = _pair(players, heroes, (0.0, 0.0), PAIR_MAX)
    if len(pairs) >= 3:  # même mise en page pour chaque joueur : le héros est toujours au même endroit
        offset = (_median([heroes[j].x - players[i].x for i, j in pairs.items()]),
                  _median([heroes[j].y - players[i].y for i, j in pairs.items()]))
        pairs = _pair(players, heroes, offset, PAIR_MAX_ALIGNED)
        # nom lu loin de sa place habituelle : on retombe sur le plus proche parmi les restants
        left_p = [i for i in range(len(players)) if i not in pairs]
        left_h = [j for j in range(len(heroes)) if j not in pairs.values()]
        rest = _pair([players[i] for i in left_p], [heroes[j] for j in left_h], (0.0, 0.0), PAIR_MAX)
        pairs.update({left_p[i]: left_h[j] for i, j in rest.items()})
    out: dict[str, dict] = {}
    for i, p in enumerate(players):
        out[p.key] = {"hero_id": heroes[pairs[i]].key if i in pairs else None, "player": p.key,
                      "x": p.x, "y": p.y, "me": norm(p.key) in my_names}
    if not lobby_players:  # pas de fichier de chargement : héros seuls
        for h in heroes:
            out[h.key] = {"hero_id": h.key, "player": None, "x": h.x, "y": h.y, "me": False}
    return out


def add_reading(composition: dict[str, dict], entries: dict[str, dict]) -> None:
    """Cumule une lecture : chaque héros lu pour un joueur compte comme un vote. Une lecture
    ratée (héros du voisin, nom mal lu) est corrigée par les suivantes au lieu de rester figée."""
    for key, entry in entries.items():
        current = composition.setdefault(key, {**entry, "votes": {}})
        current["me"] = current["me"] or entry["me"]
        if entry["hero_id"]:
            current["votes"][entry["hero_id"]] = current["votes"].get(entry["hero_id"], 0) + 1


def _resolve(group: list[Found], entries: dict[str, dict]) -> dict[str, str | None]:
    """Héros de chaque joueur d'une équipe : le plus voté, jamais deux fois le même héros
    dans une équipe (le joueur le plus sûr le garde, l'autre prend son choix suivant)."""
    def ranked(key: str) -> list[tuple[str, int]]:
        e = entries[key]
        votes = e.get("votes", {e["hero_id"]: 1} if e["hero_id"] else {})  # lecture seule, sans cumul
        return sorted(votes.items(), key=lambda kv: -kv[1])

    order = sorted(group, key=lambda p: -(ranked(p.key)[0][1] if ranked(p.key) else 0))
    used: set[str] = set()
    out: dict[str, str | None] = {}
    for p in order:
        hero = next((h for h, _ in ranked(p.key) if h not in used), None)
        out[p.key] = hero
        if hero:
            used.add(hero)
    return out


def teams_from(entries: dict[str, dict], my_hero_id: str | None = None) -> dict | None:
    if not entries:
        return None
    points = [Found(k, e["x"], e["y"]) for k, e in entries.items()]
    first, second = split_teams(points)
    heroes_of = {**_resolve(first, entries), **_resolve(second, entries)}
    mine = next((k for k, e in entries.items() if e["me"]), None)
    if mine is None and my_hero_id:  # pseudo non lu, mais héros connu et présent une seule fois
        holders = [k for k, h in heroes_of.items() if h == my_hero_id]
        mine = holders[0] if len(holders) == 1 else None
    sides_known = mine is not None and bool(second)
    if sides_known and any(p.key == mine for p in second):
        first, second = second, first
    heroes = registry().heroes

    def describe(group: list[Found]) -> list[dict]:
        rows = []
        for p in sorted(group, key=lambda p: (p.x, p.y)):
            e, hero_id = entries[p.key], heroes_of[p.key]
            hero = heroes.get(hero_id) if hero_id else None
            rows.append({"hero_id": hero_id, "hero": hero.name if hero else hero_id,
                         "role": hero.role if hero else None, "player": e["player"], "me": p.key == mine})
        return rows

    return {"ally": describe(first), "enemy": describe(second), "sides_known": sides_known,
            "complete": sum(1 for h in heroes_of.values() if h) >= 10}

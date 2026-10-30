from app.live.composition import Word, read_composition, teams_from
from app.live.session import LiveSession


def loading_screen_words():
    """Écran de chargement simulé : alliés en haut, adversaires en bas, pseudo puis héros."""
    top = [("Moi", "Li Li"), ("Bnizzle", "Valla"), ("Domino", "Le Boucher"), ("LiteKnight", "Xal'atath"), ("AngryLobster", "Diablo")]
    bottom = [("XiaoPiHai", "Luisaile"), ("Kappa", "Johanna"), ("silvanas", "Gul'dan"), ("Bar", "Sergent Marteau"), ("Baz", "Cho")]
    words = [Word("HÉROS", 0.5, 0.02)]
    for row_y, row in ((0.30, top), (0.75, bottom)):
        for i, (player, hero) in enumerate(row):
            x = 0.12 + i * 0.19
            words.append(Word(player, x, row_y))
            parts = hero.split(" ")
            for j, part in enumerate(parts):
                words.append(Word(part, x - 0.02 * (len(parts) - 1) + 0.04 * j, row_y + 0.04))
    return words


def test_reads_both_team_compositions_from_loading_screen():
    lobby = ["Moi#1234", "Bnizzle#1", "Domino#2", "LiteKnight#3", "AngryLobster#4",
             "XiaoPiHai#5", "Kappa#6", "silvanas#7", "Bar#8", "Baz#9"]
    entries = read_composition(loading_screen_words(), lobby, {"moi"})
    teams = teams_from(entries)
    assert teams["complete"] and teams["sides_known"]
    assert [h["hero_id"] for h in teams["ally"]] == ["lili", "valla", "butcher", "xalatath", "diablo"]
    assert [h["hero_id"] for h in teams["enemy"]] == ["brightwing", "johanna", "guldan", "sgthammer", "cho"]
    assert teams["ally"][0]["me"] and teams["ally"][3]["role"] == "Ranged Assassin"


def test_ocr_typos_tolerated_and_composition_accumulates():
    s = LiveSession()
    s.on_lobby(["Moi#1", "Bnizzle#2"], None, None, None)
    entries = read_composition([Word("Moi", 0.1, 0.3), Word("Vala", 0.1, 0.34),  # « Valla » mal lu
                                Word("Bnizzle", 0.1, 0.75), Word("Johana", 0.1, 0.79)], s.lobby_players, {"moi"})
    s.add_composition(entries)
    teams = s.snapshot()["teams"]
    assert teams["ally"][0]["hero_id"] == "valla" and teams["enemy"][0]["hero_id"] == "johanna"
    assert not teams["complete"]


def _session(lobby: list[str]) -> LiveSession:
    s = LiveSession()
    s.on_lobby(lobby, None, None, None)
    return s


def test_player_without_read_hero_does_not_steal_neighbour_hero():
    # cartes serrées : le héros de Bnizzle est aussi à portée de Moi, dont le héros n'est pas lu
    s = _session(["Moi#1", "Bnizzle#2", "Kappa#3"])
    words = [Word("Moi", 0.10, 0.30), Word("Bnizzle", 0.18, 0.30), Word("Valla", 0.18, 0.34),
             Word("Kappa", 0.10, 0.75), Word("Johanna", 0.10, 0.79)]
    s.add_composition(read_composition(words, s.lobby_players, {"moi"}))
    ally = s.snapshot()["teams"]["ally"]
    assert [(m["player"], m["hero_id"]) for m in ally] == [("Moi", None), ("Bnizzle", "valla")]
    assert ally[0]["me"] and ally[0]["hero"] is None


def test_wrong_first_reading_is_outvoted_and_no_duplicate_hero_in_a_team():
    s = _session(["Moi#1", "Bnizzle#2", "Kappa#3"])
    good = [Word("Moi", 0.10, 0.30), Word("Cho", 0.10, 0.34), Word("Bnizzle", 0.30, 0.30), Word("Gall", 0.30, 0.34),
            Word("Kappa", 0.10, 0.75), Word("Johanna", 0.10, 0.79)]
    bad = [w if w.text != "Cho" else Word("Gall", 0.10, 0.34) for w in good]  # « Cho » lu « Gall »
    s.add_composition(read_composition(bad, s.lobby_players, {"moi"}))
    ally = s.snapshot()["teams"]["ally"]
    assert sorted(m["hero_id"] or "" for m in ally) == ["", "gall"]  # jamais deux Gall dans une équipe
    for _ in range(2):
        s.add_composition(read_composition(good, s.lobby_players, {"moi"}))
    ally = s.snapshot()["teams"]["ally"]
    assert [m["hero_id"] for m in ally] == ["cho", "gall"]


def test_sides_known_from_my_hero_when_my_name_is_not_read():
    s = _session(["Bnizzle#2", "Kappa#3"])
    s.my_hero_id = "johanna"
    words = [Word("Bnizzle", 0.10, 0.30), Word("Valla", 0.10, 0.34),
             Word("Kappa", 0.10, 0.75), Word("Johanna", 0.10, 0.79)]
    s.add_composition(read_composition(words, s.lobby_players, set()))
    teams = s.snapshot()["teams"]
    assert teams["sides_known"] and teams["ally"][0]["hero_id"] == "johanna" and teams["ally"][0]["me"]


def test_layout_offset_is_learned_from_confident_pairs():
    # le nom du héros est à droite du pseudo ; celui de C est lu à gauche, loin de sa place habituelle
    s = _session(["Aaa#1", "Bbb#2", "Ccc#3", "Ddd#4"])
    words = [Word("Aaa", 0.10, 0.30), Word("Valla", 0.16, 0.30), Word("Bbb", 0.30, 0.30), Word("Jaina", 0.36, 0.30),
             Word("Ccc", 0.50, 0.30), Word("Diablo", 0.42, 0.31), Word("Ddd", 0.70, 0.30), Word("Muradin", 0.76, 0.30)]
    s.add_composition(read_composition(words, s.lobby_players, set()))
    rows = s.snapshot()["teams"]["ally"] + s.snapshot()["teams"]["enemy"]
    assert {m["player"]: m["hero_id"] for m in rows} == {"Aaa": "valla", "Bbb": "jaina", "Ccc": "diablo", "Ddd": "muradin"}


def test_french_hero_names_from_replays_and_loading_screen():
    from app.reference import registry
    for name, hero_id in [("Aile de mort", "deathwing"), ("Balafré", "stitches"), ("Bourbie", "murky"),
                          ("EDN-OS", "probius"), ("Kramer", "blaze"), ("Sgt Marteau", "sgthammer")]:
        assert registry().resolve_hero(name).id == hero_id
    entries = read_composition([Word("Moi", 0.1, 0.3), Word("Balafré", 0.1, 0.34)], ["Moi#1"], {"moi"})
    assert entries["Moi"]["hero_id"] == "stitches"


def test_talent_catalog_is_current_and_keeps_retired_talents():
    from app.talents import talent_info, talent_name
    assert talent_name("XalatathVoidAdept") == "Void Adept"  # héros ajouté au patch 2.57
    assert talent_info("XalatathHeroicAbilityVoidEruption")["level"] == 10
    assert talent_name("AlarakDeadlyChargeSecondHeroic") == "Deadly Charge"  # retiré du jeu, présent dans d'anciens replays

"""Cycles d'objectifs : extraction des replays, calibration, timer en direct."""
from app.analytics.timings import calibrate_cycles, map_timings
from app.live.session import LiveSession, compute_overlay
from app.models import Match, MatchEvent, Replay
from app.replay.objectives import extract_cycles

LOOPS = 16  # boucles de jeu par seconde


def born(t, unit, tag):
    return {"_event": "NNet.Replay.Tracker.SUnitBornEvent", "_gameloop": t * LOOPS, "m_unitTypeName": unit.encode(),
            "m_unitTagIndex": tag, "m_unitTagRecycle": 1}


def died(t, tag):
    return {"_event": "NNet.Replay.Tracker.SUnitDiedEvent", "_gameloop": t * LOOPS, "m_unitTagIndex": tag, "m_unitTagRecycle": 1}


def stat(t, name):
    return {"_event": "NNet.Replay.Tracker.SStatGameEvent", "_gameloop": t * LOOPS, "m_eventName": name.encode()}


def to_s(loop):
    return loop / LOOPS


def test_hanamura_cycles_from_unit_events():
    events = [
        born(150, "Payload_Neutral_Warning", 1), born(150, "Payload_Neutral_Warning", 2),  # rafale = 1 préavis
        born(180, "Payload_Neutral", 3), died(277, 3),
        born(403, "Payload_Neutral_Warning", 4), born(433, "Payload_Neutral", 5), died(480, 5),
    ]
    phases = [(p["t_s"], p["phase"]) for p in extract_cycles("hanamura_temple", events, to_s)]
    assert phases == [(150, "warning"), (180, "start"), (277, "end"), (403, "warning"), (433, "start"), (480, "end")]


def test_sky_temple_end_is_last_shot_of_burst():
    events = [stat(180, "SkyTempleActivated"), *[stat(t, "SkyTempleShotsFired") for t in range(183, 250, 5)],
              stat(371, "SkyTempleActivated")]
    phases = extract_cycles("sky_temple", events, to_s)
    assert [(p["t_s"], p["phase"]) for p in phases] == [(180, "start"), (248, "end"), (371, "start")]


def test_unknown_map_has_no_cycles():
    assert extract_cycles("lost_cavern", [born(10, "Payload_Neutral", 1)], to_s) == []


def _add_match(db, map_id, phases):
    replay = Replay(file_path="x", file_hash=f"h{len(db.query(Replay).all())}")
    db.add(replay)
    db.flush()
    match = Match(replay_id=replay.id, map_id=map_id, map_name=map_id, game_mode="Quick Match", duration_s=1200)
    db.add(match)
    db.flush()
    for t, phase in phases:
        db.add(MatchEvent(match_id=match.id, t_s=t, kind="objective_cycle", payload={"phase": phase}))
    db.commit()


def test_calibration_separates_fixed_delay_from_variable_duration(db):
    # durée variable (60 à 140 s), délai fin -> début fixe (121 s), premier objectif à 3:00
    for duration in (60, 80, 100, 120, 140):
        end = 180 + duration
        _add_match(db, "sky_temple", [(180, "start"), (end, "end"), (end + 121, "start"), (end + 121 + duration, "end")])
    cal = calibrate_cycles(db, "sky_temple")
    assert cal["first_objective_s"] == 180
    assert cal["objective_interval_s"] == 121
    assert cal["objective_duration_s"] == 100
    assert cal["duration_low_s"] < 100 < cal["duration_high_s"]
    timings = map_timings(db, "sky_temple")
    assert timings["source"] == "vos replays" and timings["objective_interval_s"] == 121


TIMINGS = {"first_objective_s": 180, "objective_interval_s": 150, "objective_duration_s": 100,
           "duration_low_s": 80, "duration_high_s": 140, "source": "mesuré"}


def at(s, clock):
    s.sync_clock(clock)
    return compute_overlay(s)["objective"]


def test_live_first_objective_is_exact_then_active():
    s = LiveSession()
    s.start("sky_temple", None, 100, TIMINGS)
    o = at(s, 100)
    assert o["phase"] == "waiting" and round(o["next_in_s"]) == 80 and not o["estimated"]
    o = at(s, 200)
    assert o["phase"] == "active" and round(o["ends_in_s"]) == 80  # fin estimée à 180 + 100


def test_live_confirmed_end_gives_exact_next_objective():
    s = LiveSession()
    s.start("sky_temple", None, 100, TIMINGS)
    at(s, 200)
    s.sync_clock(260)
    s.objective_done()  # le joueur signale la fin à 4:20
    o = at(s, 260)
    assert o["phase"] == "waiting" and round(o["next_in_s"]) == 150 and not o["estimated"]


def test_live_unconfirmed_end_is_estimated():
    s = LiveSession()
    s.start("sky_temple", None, 100, TIMINGS)
    at(s, 200)
    o = at(s, 180 + 140 + 16)  # fourchette haute dépassée sans confirmation
    assert o["phase"] == "waiting" and o["estimated"]
    assert round(o["next_in_s"]) == 180 + 100 + 150 - 336  # fin supposée à la durée habituelle


def test_late_join_projects_full_cycles():
    s = LiveSession()
    s.start("sky_temple", None, 600, TIMINGS)  # partie rejointe à 10:00
    o = at(s, 600)
    assert o["estimated"]  # 180 + 250 + 250 = 680 : prochain début estimé
    assert round(o["next_in_s"]) == 80

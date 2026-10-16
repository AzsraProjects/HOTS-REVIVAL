import { describe, expect, it } from "vitest";
import { canonical, Invalid, parseSummary } from "../src/validate";

export function sample(): Record<string, any> {
  return {
    v: 1,
    me_slot: 1,
    match: {
      map_id: "towers_of_doom", mode: "Storm League", version: "2.55.6.93393",
      played_at: 1_760_000_000, duration_s: 825, winner_team: 1, levels: [18, 20],
    },
    players: Array.from({ length: 10 }, (_, i) => ({
      slot: i, toon_handle: `2-Hero-1-${1000 + i}`, team: i < 5 ? 0 : 1, hero_id: `hero_${i}`,
      role: "Tank", win: i >= 5, heros_score: 50, talents: ["A", "B", "C", "", "", "", ""],
      kills: 2, deaths: 3, assists: 7, takedowns: 9, hero_damage: 30000, siege_damage: 40000, healing: 0,
      self_healing: 1000, damage_taken: 30000, xp: 8000, mercs: 1, time_dead_s: 90,
    })),
  };
}

describe("parseSummary", () => {
  it("accepte un résumé cohérent", () => {
    const m = parseSummary(sample(), 1_760_100_000);
    expect(m.players).toHaveLength(10);
    expect(m.me_slot).toBe(1);
    expect(m.players[0].stats.kills).toBe(2);
  });

  it.each([
    ["mode non compté", (s: any) => { s.match.mode = "Versus AI"; }],
    ["résultat incohérent", (s: any) => { s.players[0].win = true; }],
    ["équipes déséquilibrées", (s: any) => { s.players[5].team = 0; s.players[5].win = false; }],
    ["joueurs en double", (s: any) => { s.players[1].toon_handle = s.players[0].toon_handle; }],
    ["kills invalide", (s: any) => { s.players[0].kills = -1; }],
    ["10 joueurs attendus", (s: any) => { s.players.pop(); }],
    ["talents invalides", (s: any) => { s.players[0].talents = ["A"]; }],
    ["played_at invalide", (s: any) => { s.match.played_at = 2_000_000_000; }],
    ["toon_handle invalide", (s: any) => { s.players[0].toon_handle = "Bob#1234"; }],
  ])("refuse : %s", (message, mutate) => {
    const s = sample();
    mutate(s);
    expect(() => parseSummary(s, 1_760_100_000)).toThrow(new Invalid(message));
  });

  it("deux envois identiques ont la même forme canonique, quel que soit l'envoyeur", () => {
    const a = sample();
    const b = sample();
    b.me_slot = 7;
    const pids = Array.from({ length: 10 }, (_, i) => `pid${i}`);
    expect(canonical(parseSummary(a, 1_760_100_000), pids)).toBe(canonical(parseSummary(b, 1_760_100_000), pids));
    b.players[3].kills = 9;
    expect(canonical(parseSummary(a, 1_760_100_000), pids)).not.toBe(canonical(parseSummary(b, 1_760_100_000), pids));
  });
});

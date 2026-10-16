-- Plateforme communautaire HOTS REVIVAL (Cloudflare D1 / SQLite).
-- Aucun pseudo de joueur n'est stocké : chaque compte est un identifiant pseudonymisé
-- (pid = HMAC du toon_handle avec un secret serveur). Seuls les joueurs qui rendent
-- leur profil public y associent un nom.

-- Installation de l'application (jeton d'envoi, jamais stocké en clair).
CREATE TABLE installs (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  created_day TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX installs_ip_day ON installs (ip_hash, created_day);

CREATE TABLE matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fingerprint TEXT NOT NULL UNIQUE,  -- même partie envoyée par plusieurs joueurs
  summary_hash TEXT NOT NULL,
  map_id TEXT NOT NULL,
  mode TEXT NOT NULL,
  version TEXT NOT NULL,
  played_at INTEGER NOT NULL,         -- secondes Unix
  duration_s INTEGER NOT NULL,
  winner_team INTEGER NOT NULL,
  level_0 INTEGER NOT NULL,
  level_1 INTEGER NOT NULL,
  confirmations INTEGER NOT NULL DEFAULT 1,  -- envois concordants
  conflicts INTEGER NOT NULL DEFAULT 0,      -- envois divergents (à modérer)
  created_at INTEGER NOT NULL
);
CREATE INDEX matches_played ON matches (played_at);

CREATE TABLE match_players (
  match_id INTEGER NOT NULL REFERENCES matches (id) ON DELETE CASCADE,
  slot INTEGER NOT NULL,
  pid TEXT NOT NULL,
  team INTEGER NOT NULL,
  hero_id TEXT NOT NULL,
  role TEXT,
  win INTEGER NOT NULL,
  kills INTEGER NOT NULL,
  deaths INTEGER NOT NULL,
  assists INTEGER NOT NULL,
  takedowns INTEGER NOT NULL,
  hero_damage INTEGER NOT NULL,
  siege_damage INTEGER NOT NULL,
  healing INTEGER NOT NULL,
  self_healing INTEGER NOT NULL,
  damage_taken INTEGER NOT NULL,
  xp INTEGER NOT NULL,
  mercs INTEGER NOT NULL,
  time_dead_s INTEGER NOT NULL,
  heros_score INTEGER,
  talents TEXT NOT NULL,              -- JSON : 7 noms de talents ("" si non choisi)
  PRIMARY KEY (match_id, slot)
);
CREATE INDEX match_players_pid ON match_players (pid);
CREATE INDEX match_players_hero ON match_players (hero_id);

-- Qui a envoyé quoi : dédoublonnage par installation, quotas, preuve de propriété d'un compte.
CREATE TABLE uploads (
  install_id TEXT NOT NULL REFERENCES installs (id) ON DELETE CASCADE,
  match_id INTEGER NOT NULL REFERENCES matches (id) ON DELETE CASCADE,
  me_pid TEXT,
  day TEXT NOT NULL,
  PRIMARY KEY (install_id, match_id)
);
CREATE INDEX uploads_install_day ON uploads (install_id, day);
CREATE INDEX uploads_install_me ON uploads (install_id, me_pid);

-- Profils publics (opt-in explicite depuis l'application).
CREATE TABLE profiles (
  slug TEXT PRIMARY KEY,
  install_id TEXT NOT NULL UNIQUE REFERENCES installs (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_public INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX profiles_name ON profiles (name COLLATE NOCASE);

CREATE TABLE profile_pids (
  pid TEXT PRIMARY KEY,
  slug TEXT NOT NULL REFERENCES profiles (slug) ON DELETE CASCADE,
  region INTEGER
);

-- Agrégats recalculés de façon incrémentale par la tâche planifiée.
CREATE TABLE agg_state (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE TABLE hero_stats (
  hero_id TEXT NOT NULL,
  mode TEXT NOT NULL,
  map_id TEXT NOT NULL,
  games INTEGER NOT NULL,
  wins INTEGER NOT NULL,
  kills INTEGER NOT NULL,
  deaths INTEGER NOT NULL,
  assists INTEGER NOT NULL,
  hero_damage INTEGER NOT NULL,
  siege_damage INTEGER NOT NULL,
  healing INTEGER NOT NULL,
  damage_taken INTEGER NOT NULL,
  xp INTEGER NOT NULL,
  duration_s INTEGER NOT NULL,
  PRIMARY KEY (hero_id, mode, map_id)
);

CREATE TABLE hero_pairs (
  hero_id TEXT NOT NULL,
  other_id TEXT NOT NULL,
  relation TEXT NOT NULL,  -- 'with' (même équipe) | 'vs' (adversaire)
  mode TEXT NOT NULL,
  games INTEGER NOT NULL,
  wins INTEGER NOT NULL,   -- victoires de hero_id
  PRIMARY KEY (hero_id, other_id, relation, mode)
);

CREATE TABLE talent_stats (
  hero_id TEXT NOT NULL,
  mode TEXT NOT NULL,
  tier INTEGER NOT NULL,
  talent TEXT NOT NULL,
  games INTEGER NOT NULL,
  wins INTEGER NOT NULL,
  PRIMARY KEY (hero_id, mode, tier, talent)
);

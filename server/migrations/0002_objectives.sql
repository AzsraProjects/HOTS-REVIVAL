-- Horaires d'objectifs de carte mis en commun (envoyés avec le résumé de chaque partie).
-- objectives : JSON {"first_start": s|null, "durations": [s…], "respawns": [s…], "periods": [s…]}
--   durations : début → fin d'un objectif (variable, dépend des joueurs)
--   respawns  : fin → début suivant (fixe pour une carte)
--   periods   : fin → fin, pour les cartes dont seule la fin est enregistrée
ALTER TABLE matches ADD COLUMN objectives TEXT;
ALTER TABLE matches ADD COLUMN objectives_aggregated INTEGER NOT NULL DEFAULT 0;
CREATE INDEX matches_objectives_pending ON matches (objectives_aggregated, id) WHERE objectives IS NOT NULL;

-- Histogrammes par carte (à la seconde) : médianes et quartiles sans relire les parties.
CREATE TABLE objective_hist (
  map_id TEXT NOT NULL,
  metric TEXT NOT NULL,  -- 'first_start' | 'duration' | 'respawn' | 'period'
  bucket INTEGER NOT NULL,  -- valeur en secondes
  n INTEGER NOT NULL,
  PRIMARY KEY (map_id, metric, bucket)
);

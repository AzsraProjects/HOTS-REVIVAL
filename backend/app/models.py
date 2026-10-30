"""Schéma relationnel (PostgreSQL en production, SQLite pour les tests)."""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base

JSONType = JSON().with_variant(JSONB(), "postgresql")


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Player(Base):
    __tablename__ = "players"

    id: Mapped[int] = mapped_column(primary_key=True)
    toon_handle: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(64))
    battletag: Mapped[str | None] = mapped_column(String(80))
    region: Mapped[int | None] = mapped_column(Integer)
    rank: Mapped[str | None] = mapped_column(String(32))
    is_me: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Replay(Base):
    __tablename__ = "replays"

    id: Mapped[int] = mapped_column(primary_key=True)
    file_path: Mapped[str] = mapped_column(Text)
    file_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    status: Mapped[str] = mapped_column(String(16), default="pending")  # pending|parsed|failed
    error: Mapped[str | None] = mapped_column(Text)
    imported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    match: Mapped["Match | None"] = relationship(back_populates="replay", uselist=False)


class Match(Base):
    __tablename__ = "matches"

    id: Mapped[int] = mapped_column(primary_key=True)
    replay_id: Mapped[int] = mapped_column(ForeignKey("replays.id", ondelete="CASCADE"), unique=True)
    map_id: Mapped[str] = mapped_column(String(48), index=True)
    map_name: Mapped[str] = mapped_column(String(80))
    game_mode: Mapped[str | None] = mapped_column(String(32))
    game_version: Mapped[str | None] = mapped_column(String(32))
    played_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    duration_s: Mapped[int] = mapped_column(Integer)
    winner_team: Mapped[int | None] = mapped_column(Integer)
    team_levels: Mapped[dict] = mapped_column(JSONType, default=dict)  # {"0": 20, "1": 18}

    replay: Mapped[Replay] = relationship(back_populates="match")
    players: Mapped[list["MatchPlayer"]] = relationship(
        back_populates="match", cascade="all, delete-orphan", order_by="MatchPlayer.slot"
    )
    events: Mapped[list["MatchEvent"]] = relationship(
        back_populates="match", cascade="all, delete-orphan", order_by="MatchEvent.t_s"
    )


class MatchPlayer(Base):
    __tablename__ = "match_players"
    __table_args__ = (UniqueConstraint("match_id", "slot"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    match_id: Mapped[int] = mapped_column(ForeignKey("matches.id", ondelete="CASCADE"), index=True)
    player_id: Mapped[int | None] = mapped_column(ForeignKey("players.id"), index=True)
    slot: Mapped[int] = mapped_column(Integer)
    team: Mapped[int] = mapped_column(Integer)
    is_winner: Mapped[bool] = mapped_column(Boolean)
    is_me: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    name: Mapped[str] = mapped_column(String(64))
    toon_handle: Mapped[str | None] = mapped_column(String(64))
    hero_id: Mapped[str] = mapped_column(String(48), index=True)
    hero_name: Mapped[str] = mapped_column(String(64))
    role: Mapped[str | None] = mapped_column(String(32))

    kills: Mapped[int] = mapped_column(Integer, default=0)
    deaths: Mapped[int] = mapped_column(Integer, default=0)
    assists: Mapped[int] = mapped_column(Integer, default=0)
    takedowns: Mapped[int] = mapped_column(Integer, default=0)
    hero_damage: Mapped[int] = mapped_column(Integer, default=0)
    siege_damage: Mapped[int] = mapped_column(Integer, default=0)
    healing: Mapped[int] = mapped_column(Integer, default=0)
    self_healing: Mapped[int] = mapped_column(Integer, default=0)
    damage_taken: Mapped[int] = mapped_column(Integer, default=0)
    xp_contribution: Mapped[int] = mapped_column(Integer, default=0)
    merc_camp_captures: Mapped[int] = mapped_column(Integer, default=0)
    time_spent_dead_s: Mapped[int] = mapped_column(Integer, default=0)
    stats: Mapped[dict] = mapped_column(JSONType, default=dict)  # score screen complet
    talents: Mapped[list] = mapped_column(JSONType, default=list)  # [{tier, level, name}]

    match: Mapped[Match] = relationship(back_populates="players")
    score: Mapped["HerosScore | None"] = relationship(
        back_populates="match_player", uselist=False, cascade="all, delete-orphan"
    )


class MatchEvent(Base):
    __tablename__ = "match_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    match_id: Mapped[int] = mapped_column(ForeignKey("matches.id", ondelete="CASCADE"), index=True)
    t_s: Mapped[float] = mapped_column(Float)
    kind: Mapped[str] = mapped_column(String(32), index=True)  # death|level|camp|objective|structure
    team: Mapped[int | None] = mapped_column(Integer)
    slot: Mapped[int | None] = mapped_column(Integer)
    payload: Mapped[dict] = mapped_column(JSONType, default=dict)

    match: Mapped[Match] = relationship(back_populates="events")


class HerosScore(Base):
    __tablename__ = "heros_scores"

    id: Mapped[int] = mapped_column(primary_key=True)
    match_player_id: Mapped[int] = mapped_column(
        ForeignKey("match_players.id", ondelete="CASCADE"), unique=True
    )
    placement: Mapped[int] = mapped_column(Integer)
    macro: Mapped[int] = mapped_column(Integer)
    teamfight: Mapped[int] = mapped_column(Integer)
    objectives: Mapped[int] = mapped_column(Integer)
    survival: Mapped[int] = mapped_column(Integer)
    draft: Mapped[int] = mapped_column(Integer)
    overall: Mapped[int] = mapped_column(Integer, index=True)
    algo_version: Mapped[str] = mapped_column(String(16))
    details: Mapped[dict] = mapped_column(JSONType, default=dict)

    match_player: Mapped[MatchPlayer] = relationship(back_populates="score")


class Report(Base):
    __tablename__ = "reports"
    __table_args__ = (UniqueConstraint("match_id", "match_player_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    match_id: Mapped[int] = mapped_column(ForeignKey("matches.id", ondelete="CASCADE"), index=True)
    match_player_id: Mapped[int] = mapped_column(ForeignKey("match_players.id", ondelete="CASCADE"))
    facts: Mapped[dict] = mapped_column(JSONType, default=dict)
    ai_summary: Mapped[dict | None] = mapped_column(JSONType)
    model: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class SavedAnalysis(Base):
    """Résumé IA archivé par empreinte du replay : jamais supprimé (voir app/safekeeping.py)."""

    __tablename__ = "saved_analyses"

    id: Mapped[int] = mapped_column(primary_key=True)
    file_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    ai_summary: Mapped[dict] = mapped_column(JSONType)
    model: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class CommunityUpload(Base):
    """Partie déjà envoyée à la plateforme communautaire (clé : empreinte du replay,
    stable même si l'historique est réanalysé)."""

    __tablename__ = "community_uploads"

    file_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    status: Mapped[str] = mapped_column(String(16))  # accepted|confirmed|conflict|duplicate|rejected
    detail: Mapped[str | None] = mapped_column(Text)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class CommunityObjectiveUpload(Base):
    """Partie dont les horaires d'objectifs ont été envoyés (renvoi de l'historique partagé
    avant que les résumés ne les contiennent)."""

    __tablename__ = "community_objective_uploads"

    file_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Draft(Base):
    __tablename__ = "drafts"

    id: Mapped[int] = mapped_column(primary_key=True)
    map_id: Mapped[str | None] = mapped_column(String(48))
    allies: Mapped[list] = mapped_column(JSONType, default=list)
    enemies: Mapped[list] = mapped_column(JSONType, default=list)
    bans: Mapped[list] = mapped_column(JSONType, default=list)
    result: Mapped[dict] = mapped_column(JSONType, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class CoachConversation(Base):
    __tablename__ = "coach_conversations"

    id: Mapped[int] = mapped_column(primary_key=True)
    match_id: Mapped[int | None] = mapped_column(ForeignKey("matches.id", ondelete="SET NULL"))
    title: Mapped[str] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    messages: Mapped[list["CoachMessage"]] = relationship(
        back_populates="conversation", cascade="all, delete-orphan", order_by="CoachMessage.id"
    )


class CoachMessage(Base):
    __tablename__ = "coach_messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    conversation_id: Mapped[int] = mapped_column(
        ForeignKey("coach_conversations.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[str] = mapped_column(String(16))  # user|assistant
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    conversation: Mapped[CoachConversation] = relationship(back_populates="messages")


class MetaTierList(Base):
    """Tier list Icy Veins (dernière version valide)."""

    __tablename__ = "meta_tier_lists"

    id: Mapped[int] = mapped_column(primary_key=True)
    list_key: Mapped[str] = mapped_column(String(32), unique=True)
    title: Mapped[str] = mapped_column(String(80))
    url: Mapped[str] = mapped_column(Text)
    updated_label: Mapped[str | None] = mapped_column(String(40))
    entries: Mapped[list] = mapped_column(JSONType, default=list)  # [{hero_id, tier, role}]
    slugs: Mapped[dict] = mapped_column(JSONType, default=dict)  # hero_id -> slug Icy Veins
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class MetaHeroGuide(Base):
    """Guide Icy Veins d'un héros : synergies, contres, builds (noms de talents résolus)."""

    __tablename__ = "meta_hero_guides"

    id: Mapped[int] = mapped_column(primary_key=True)
    hero_id: Mapped[str] = mapped_column(String(48), unique=True)
    url: Mapped[str] = mapped_column(Text)
    synergies: Mapped[list] = mapped_column(JSONType, default=list)
    counters: Mapped[list] = mapped_column(JSONType, default=list)
    builds: Mapped[list] = mapped_column(JSONType, default=list)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class RankSnapshot(Base):
    """Rang déclaré par le joueur (Blizzard n'expose aucune API de rang pour HotS)."""

    __tablename__ = "rank_snapshots"

    id: Mapped[int] = mapped_column(primary_key=True)
    mode: Mapped[str] = mapped_column(String(32), default="Storm League")
    league: Mapped[str] = mapped_column(String(24))
    division: Mapped[int | None] = mapped_column(Integer)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)


class Goal(Base):
    """Objectif personnel suivi d'une partie à l'autre (un seul actif : ended_at nul)."""

    __tablename__ = "goals"

    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String(32))  # voir app/analytics/goals.py (GOALS)
    target: Mapped[float] = mapped_column(Float)
    hero_id: Mapped[str | None] = mapped_column(String(48))  # objectif « hero » : héros à retravailler
    source_match_id: Mapped[int | None] = mapped_column(Integer)  # partie dont il est issu (sans clé étrangère)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Bookmark(Base):
    """Moment « à revoir » marqué en jeu (raccourci), rattaché ensuite au replay par son empreinte :
    il survit donc aux réanalyses de l'historique."""

    __tablename__ = "bookmarks"

    id: Mapped[int] = mapped_column(primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    clock_s: Mapped[float | None] = mapped_column(Float)  # horloge de jeu (None : horloge non synchronisée)
    clock_estimated: Mapped[bool] = mapped_column(Boolean, default=False)  # déduite de la fin du replay
    map_id: Mapped[str | None] = mapped_column(String(48))
    note: Mapped[str] = mapped_column(Text, default="")
    file_hash: Mapped[str | None] = mapped_column(String(64), index=True)  # replay associé (None : en attente)

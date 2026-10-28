"""Objectif personnel suivi et marque-pages de replay."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload

from app.analytics.goals import GOALS, played_after, active_goal, evaluate, goal_out, progress, suggestions
from app.bookmarks import bookmark_out, match_bookmarks
from app.db import get_db
from app.i18n import tr
from app.live.session import live_session
from app.models import Bookmark, Goal, Match, MatchPlayer, Report
from app.schemas import BookmarkNoteRequest, GoalRequest

router = APIRouter(tags=["objectifs"])


def _match_and_me(db: Session, match_id: int) -> tuple[Match, MatchPlayer]:
    match = db.get(Match, match_id, options=[selectinload(Match.players).selectinload(MatchPlayer.score),
                                             selectinload(Match.events)])
    me = next((p for p in match.players if p.is_me), None) if match else None
    if not match or not me:
        raise HTTPException(404, tr("Partie introuvable"))
    return match, me


def _facts(db: Session, match_id: int) -> dict | None:
    report = db.query(Report).filter(Report.match_id == match_id).first()
    return report.facts if report else None


def refresh_live_goal(db: Session) -> None:
    """L'overlay rappelle l'objectif au chargement de chaque partie."""
    goal = active_goal(db)
    live_session.set_goal(goal_out(goal) if goal else None)


@router.get("/goals")
def get_goal(db: Session = Depends(get_db)) -> dict:
    goal = active_goal(db)
    return {"active": progress(db, goal) if goal else None}


@router.get("/goals/suggestions")
def get_suggestions(match_id: int, db: Session = Depends(get_db)) -> list[dict]:
    match, me = _match_and_me(db, match_id)
    return suggestions(match, me, _facts(db, match_id))


@router.post("/goals")
def set_goal(body: GoalRequest, db: Session = Depends(get_db)) -> dict:
    now = datetime.now(timezone.utc)
    current = active_goal(db)
    if current:
        current.ended_at = now
    goal = Goal(key=body.key, target=body.target, source_match_id=body.match_id, created_at=now)
    db.add(goal)
    db.commit()
    refresh_live_goal(db)
    return {"active": progress(db, goal)}


@router.delete("/goals/active")
def end_goal(db: Session = Depends(get_db)) -> dict:
    current = active_goal(db)
    if current:
        current.ended_at = datetime.now(timezone.utc)
        db.commit()
    refresh_live_goal(db)
    return {"active": None}


@router.get("/goals/match/{match_id}")
def goal_for_match(match_id: int, db: Session = Depends(get_db)) -> dict | None:
    """Bilan de l'objectif actif sur une partie (in_period : partie jouée depuis le choix de l'objectif)."""
    goal = active_goal(db)
    if not goal:
        return None
    match, me = _match_and_me(db, match_id)
    result = evaluate(GOALS[goal.key], goal.target, match, me, _facts(db, match_id))
    return {"goal": goal_out(goal), "result": result, "in_period": played_after(match, goal.created_at)}


@router.get("/matches/{match_id}/bookmarks")
def bookmarks_for_match(match_id: int, db: Session = Depends(get_db)) -> list[dict]:
    match, me = _match_and_me(db, match_id)
    return match_bookmarks(db, match, me.team)


@router.put("/bookmarks/{bookmark_id}")
def update_bookmark(bookmark_id: int, body: BookmarkNoteRequest, db: Session = Depends(get_db)) -> dict:
    bm = db.get(Bookmark, bookmark_id)
    if not bm:
        raise HTTPException(404, tr("Marque-page introuvable"))
    bm.note = body.note.strip()
    db.commit()
    return bookmark_out(bm)


@router.delete("/bookmarks/{bookmark_id}")
def delete_bookmark(bookmark_id: int, db: Session = Depends(get_db)) -> dict:
    bm = db.get(Bookmark, bookmark_id)
    if bm:
        db.delete(bm)
        db.commit()
    return {"deleted": bookmark_id}

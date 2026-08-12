import json
import os
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field


def get_wolf_dir() -> Path:
    override = os.environ.get("OPENWOLF_DATA_DIR")
    if override:
        return Path(override)
    return Path(__file__).resolve().parents[2] / ".wolf"


app = FastAPI(
    title="OpenWolf API",
    description=(
        "Read-only access to this project's OpenWolf bug log, memory log, "
        "cerebrum learnings, and anatomy file map."
    ),
)


class Bug(BaseModel):
    id: str
    timestamp: Optional[str] = None
    error_message: Optional[str] = None
    file: Optional[str] = None
    root_cause: Optional[str] = None
    fix: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    related_bugs: List[str] = Field(default_factory=list)
    occurrences: Optional[int] = None
    last_seen: Optional[str] = None


def load_bugs() -> List[Bug]:
    path = get_wolf_dir() / "buglog.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    return [Bug(**b) for b in data.get("bugs", [])]


@app.get("/bugs", response_model=List[Bug], operation_id="search_bugs")
def search_bugs(
    q: Optional[str] = None,
    tag: Optional[str] = None,
    file: Optional[str] = None,
) -> List[Bug]:
    """Search the OpenWolf bug log. `q` matches error_message/root_cause/fix
    (case-insensitive substring). `tag` matches tag membership. `file`
    matches the bug's file field (case-insensitive substring). No filters
    returns every logged bug."""
    bugs = load_bugs()
    if q:
        needle = q.lower()
        bugs = [
            b for b in bugs
            if needle in (b.error_message or "").lower()
            or needle in (b.root_cause or "").lower()
            or needle in (b.fix or "").lower()
        ]
    if tag:
        bugs = [b for b in bugs if tag in b.tags]
    if file:
        needle = file.lower()
        bugs = [b for b in bugs if needle in (b.file or "").lower()]
    return bugs


@app.get("/bugs/{bug_id}", response_model=Bug, operation_id="get_bug")
def get_bug(bug_id: str) -> Bug:
    """Look up a single OpenWolf bug log entry by its id (e.g. "bug-001")."""
    for bug in load_bugs():
        if bug.id == bug_id:
            return bug
    raise HTTPException(status_code=404, detail=f"No bug with id {bug_id!r}")

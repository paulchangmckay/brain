import json
import os
import re
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


class MemoryEntry(BaseModel):
    session: str
    cells: List[str]


SESSION_RE = re.compile(r"^## Session: (.+)$")


def parse_memory(text: str) -> List[MemoryEntry]:
    entries: List[MemoryEntry] = []
    current_session: Optional[str] = None
    for line in text.splitlines():
        session_match = SESSION_RE.match(line.strip())
        if session_match:
            current_session = session_match.group(1).strip()
            continue
        stripped = line.strip()
        if not stripped.startswith("|") or current_session is None:
            continue
        cells = [c.strip() for c in stripped.strip("|").split("|")]
        if not cells or cells[0] == "Time" or set(cells[0]) <= {"-"}:
            continue
        entries.append(MemoryEntry(session=current_session, cells=cells))
    return entries


def load_memory() -> List[MemoryEntry]:
    path = get_wolf_dir() / "memory.md"
    return parse_memory(path.read_text(encoding="utf-8"))


@app.get("/memory", response_model=List[MemoryEntry], operation_id="recent_memory")
def recent_memory(limit: int = 20) -> List[MemoryEntry]:
    """Return the `limit` most recent OpenWolf memory-log action rows, most
    recent first. Empty "Consolidated session" blocks (no action rows) are
    skipped entirely."""
    entries = load_memory()
    return list(reversed(entries[-limit:]))

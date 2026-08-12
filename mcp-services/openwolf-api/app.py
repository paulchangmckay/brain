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


# wolf-debt: no pagination on /bugs (currently ~230 records, full list returned) — add limit/offset if the bug log grows large enough that returning everything in one MCP response becomes a problem
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
    return list(reversed(entries[-limit:])) if limit > 0 else []


class CerebrumBlock(BaseModel):
    header: str
    type: str
    content: str


CEREBRUM_HEADER_RE = re.compile(r"^## (.+)$")

CEREBRUM_TYPE_PREFIXES = {
    "preferences": "User Preferences",
    "learnings": "Key Learnings",
    "do-not-repeat": "Do-Not-Repeat",
    "decisions": "Decision Log",
    "compaction": "Compaction event",
}


def classify_cerebrum_header(header_text: str) -> str:
    for type_key, prefix in CEREBRUM_TYPE_PREFIXES.items():
        if header_text.startswith(prefix):
            return type_key
    return "other"


def parse_cerebrum(text: str) -> List[CerebrumBlock]:
    blocks: List[CerebrumBlock] = []
    current_header: Optional[str] = None
    current_lines: List[str] = []

    def flush() -> None:
        if current_header is not None:
            blocks.append(CerebrumBlock(
                header=current_header,
                type=classify_cerebrum_header(current_header),
                content="\n".join(current_lines).strip(),
            ))

    for line in text.splitlines():
        match = CEREBRUM_HEADER_RE.match(line.strip())
        if match:
            flush()
            current_header = match.group(1).strip()
            current_lines = []
        elif current_header is not None:
            current_lines.append(line)
    flush()
    return blocks


def load_cerebrum() -> List[CerebrumBlock]:
    path = get_wolf_dir() / "cerebrum.md"
    return parse_cerebrum(path.read_text(encoding="utf-8"))


@app.get("/cerebrum", response_model=List[CerebrumBlock], operation_id="query_cerebrum")
def query_cerebrum(type: Optional[str] = None, limit: int = 10) -> List[CerebrumBlock]:
    """Return the `limit` most recent OpenWolf cerebrum.md learning-log blocks,
    most recent first. `type` filters to one of: preferences, learnings,
    do-not-repeat, decisions, compaction. No `type` returns blocks of every type."""
    blocks = load_cerebrum()
    if type:
        blocks = [b for b in blocks if b.type == type]
    return list(reversed(blocks[-limit:])) if limit > 0 else []


class AnatomyEntry(BaseModel):
    path: str
    description: str


ANATOMY_DIR_HEADER_RE = re.compile(r"^## (.+)$")
ANATOMY_BULLET_RE = re.compile(r"^- `([^`]+)`\s*(.*)$")


def parse_anatomy(text: str) -> List[AnatomyEntry]:
    entries: List[AnatomyEntry] = []
    current_dir: Optional[str] = None
    for line in text.splitlines():
        stripped = line.strip()
        header_match = ANATOMY_DIR_HEADER_RE.match(stripped)
        if header_match:
            current_dir = header_match.group(1).strip()
            continue
        bullet_match = ANATOMY_BULLET_RE.match(stripped)
        if bullet_match and current_dir is not None:
            filename, description = bullet_match.groups()
            entries.append(AnatomyEntry(
                path=current_dir + filename,
                description=description.lstrip("— ").strip(),
            ))
    return entries


def load_anatomy() -> List[AnatomyEntry]:
    path = get_wolf_dir() / "anatomy.md"
    return parse_anatomy(path.read_text(encoding="utf-8"))


@app.get("/anatomy", response_model=List[AnatomyEntry], operation_id="list_anatomy")
def list_anatomy(path_prefix: Optional[str] = None) -> List[AnatomyEntry]:
    """List files from OpenWolf's anatomy.md file map. Each entry's full
    repo-relative path is reconstructed from its directory header plus
    filename. `path_prefix` filters to paths starting with that prefix."""
    entries = load_anatomy()
    if path_prefix:
        entries = [e for e in entries if e.path.startswith(path_prefix)]
    return entries


from fastapi_mcp import FastApiMCP

mcp = FastApiMCP(app)
mcp.mount_http()

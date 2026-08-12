import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import app  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

FIXTURES = Path(__file__).resolve().parent / "fixtures"
client = TestClient(app)


@pytest.fixture(autouse=True)
def fixture_data_dir(monkeypatch):
    monkeypatch.setenv("OPENWOLF_DATA_DIR", str(FIXTURES))


def test_search_bugs_no_filter_returns_all():
    response = client.get("/bugs")
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 2
    assert {b["id"] for b in body} == {"bug-001", "bug-002"}


def test_search_bugs_filters_by_q():
    response = client.get("/bugs", params={"q": "gitleaks"})
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["id"] == "bug-002"


def test_search_bugs_filters_by_tag():
    response = client.get("/bugs", params={"tag": "js"})
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["id"] == "bug-001"


def test_get_bug_by_id_found():
    response = client.get("/bugs/bug-002")
    assert response.status_code == 200
    assert response.json()["fix"] == "Removed empty allowlist table"


def test_get_bug_by_id_not_found():
    response = client.get("/bugs/bug-999")
    assert response.status_code == 404


def test_recent_memory_returns_action_rows_most_recent_first():
    response = client.get("/memory", params={"limit": 2})
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 2
    assert body[0]["session"] == "2026-08-10 22:45"
    assert body[0]["cells"][1] == "Created docs/spec.md"
    assert body[1]["session"] == "2026-08-10 22:32"


def test_recent_memory_skips_empty_consolidated_sessions():
    response = client.get("/memory", params={"limit": 100})
    body = response.json()
    assert len(body) == 3
    sessions = {entry["session"] for entry in body}
    assert "2026-07-15 21:14" not in sessions


def test_recent_memory_limit_zero_returns_empty():
    response = client.get("/memory", params={"limit": 0})
    assert response.status_code == 200
    assert response.json() == []


def test_query_cerebrum_filters_by_type():
    response = client.get("/cerebrum", params={"type": "do-not-repeat"})
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert "mcpServers" in body[0]["content"]


def test_query_cerebrum_no_filter_returns_all_types():
    response = client.get("/cerebrum", params={"limit": 100})
    body = response.json()
    assert len(body) == 6
    types = {b["type"] for b in body}
    assert types == {"preferences", "learnings", "do-not-repeat", "decisions", "compaction"}


def test_list_anatomy_reconstructs_full_paths():
    response = client.get("/anatomy")
    assert response.status_code == 200
    body = response.json()
    paths = {e["path"] for e in body}
    assert ".claude/rules/openwolf.md" in paths
    assert "./CLAUDE.md" in paths


def test_list_anatomy_filters_by_path_prefix():
    response = client.get("/anatomy", params={"path_prefix": ".claude/rules/"})
    body = response.json()
    assert len(body) == 2
    assert all(e["path"].startswith(".claude/rules/") for e in body)


def test_mcp_server_mounted():
    route_paths = {route.path for route in app.routes}
    assert any(path.startswith("/mcp") for path in route_paths)

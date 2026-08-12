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

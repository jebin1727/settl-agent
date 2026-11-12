from fastapi.testclient import TestClient

from src.main import app

client = TestClient(app)


def test_list_audit_logs_requires_auth():
    response = client.get("/v1/audit-logs")
    assert response.status_code == 401

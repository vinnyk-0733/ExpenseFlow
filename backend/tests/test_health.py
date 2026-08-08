import pytest

@pytest.mark.asyncio
async def test_liveness_health_check(async_client):
    """Test that GET /api/v1/health returns 200 OK and healthy status."""
    response = await async_client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "ExpenseFlow API v1"
    assert "timestamp" in data


@pytest.mark.asyncio
async def test_readiness_check(async_client):
    """Test that GET /api/v1/ready checks database connection successfully."""
    response = await async_client.get("/api/v1/ready")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ready"
    assert data["checks"]["database"] == "up"

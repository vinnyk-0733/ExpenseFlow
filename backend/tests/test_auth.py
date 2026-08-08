import pytest

@pytest.mark.asyncio
async def test_signup_success(async_client):
    payload = {
        "name": "Jane Doe",
        "phone_number": "9876543210",
        "pin": "123456"
    }
    response = await async_client.post("/api/v1/auth/signup", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["user_name"] == "Jane Doe"


@pytest.mark.asyncio
async def test_signup_invalid_pin_format(async_client):
    """PINs must be exactly 6 digits (rejection of old 4-digit PINs)."""
    payload = {
        "name": "Short PIN User",
        "phone_number": "9876543211",
        "pin": "1234"  # 4 digits should fail validation!
    }
    response = await async_client.post("/api/v1/auth/signup", json=payload)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_signin_and_me_flow(async_client):
    # 1. Sign up
    signup_payload = {
        "name": "John Smith",
        "phone_number": "9123456789",
        "pin": "654321"
    }
    await async_client.post("/api/v1/auth/signup", json=signup_payload)

    # 2. Sign in with correct PIN
    signin_payload = {
        "phone_number": "9123456789",
        "pin": "654321"
    }
    signin_res = await async_client.post("/api/v1/auth/signin", json=signin_payload)
    assert signin_res.status_code == 200
    token_data = signin_res.json()
    access_token = token_data["access_token"]

    # 3. Access protected /me route
    headers = {"Authorization": f"Bearer {access_token}"}
    me_res = await async_client.get("/api/v1/auth/me", headers=headers)
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["name"] == "John Smith"
    assert me_data["phone_number"] == "9123456789"


@pytest.mark.asyncio
async def test_signin_wrong_pin(async_client):
    signup_payload = {
        "name": "Alice Johnson",
        "phone_number": "9998887776",
        "pin": "112233"
    }
    await async_client.post("/api/v1/auth/signup", json=signup_payload)

    signin_payload = {
        "phone_number": "9998887776",
        "pin": "999999"  # Wrong PIN
    }
    res = await async_client.post("/api/v1/auth/signin", json=signin_payload)
    assert res.status_code == 401

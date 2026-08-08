import pytest

async def get_authenticated_headers(async_client, phone="9000000001"):
    signup_payload = {
        "name": "Card Tester",
        "phone_number": phone,
        "pin": "111222"
    }
    res = await async_client.post("/api/v1/auth/signup", json=signup_payload)
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_create_and_get_days(async_client):
    headers = await get_authenticated_headers(async_client, "9000000001")

    # Create first Day card
    create_res = await async_client.post("/api/v1/days", headers=headers)
    assert create_res.status_code == 201
    day1 = create_res.json()
    assert day1["day"] == 1
    assert "linear-gradient" in day1["color"]

    # Fetch days
    get_res = await async_client.get("/api/v1/days", headers=headers)
    assert get_res.status_code == 200
    paginated_data = get_res.json()
    assert len(paginated_data["items"]) == 1
    assert paginated_data["has_more"] is False


@pytest.mark.asyncio
async def test_expense_crud_and_decimal_amount(async_client):
    headers = await get_authenticated_headers(async_client, "9000000002")

    # Create day
    day_res = await async_client.post("/api/v1/days", headers=headers)
    day_id = day_res.json()["id"]

    # Add expense
    expense_payload = {
        "category": "Groceries",
        "description": "Weekly Vegetables",
        "amount": 45.75
    }
    exp_res = await async_client.post(f"/api/v1/days/{day_id}/expenses", json=expense_payload, headers=headers)
    assert exp_res.status_code == 201
    exp_data = exp_res.json()
    assert float(exp_data["amount"]) == 45.75
    assert exp_data["category"] == "Groceries"

    # Edit expense
    edit_payload = {
        "category": "Groceries",
        "description": "Weekly Organic Vegetables",
        "amount": 52.00
    }
    edit_res = await async_client.put(f"/api/v1/days/{day_id}/expenses/{exp_data['id']}", json=edit_payload, headers=headers)
    assert edit_res.status_code == 200
    assert float(edit_res.json()["amount"]) == 52.00

    # Delete expense
    del_res = await async_client.delete(f"/api/v1/days/{day_id}/expenses/{exp_data['id']}", headers=headers)
    assert del_res.status_code == 204

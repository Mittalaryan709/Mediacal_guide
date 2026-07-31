"""MediGuide AI backend regression tests."""
import base64
import io
import json
import os
import time

import pytest
import requests
from PIL import Image, ImageDraw, ImageFont

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://med-assistant-44.preview.emergentagent.com").rstrip("/")
TOKEN = "test_session_token_mediguide"
H = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def prescription_b64():
    img = Image.new("RGB", (700, 900), "white")
    d = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 22)
        fsm = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 18)
    except Exception:
        font = ImageFont.load_default()
        fsm = font
    lines = [
        ("Dr. A. Sharma, MBBS, MD", font),
        ("City Health Clinic - Prescription", font),
        ("---------------------------------", fsm),
        ("Patient: John Doe   Age: 34   Date: 2026-01-10", fsm),
        ("Diagnosis: Bacterial throat infection", fsm),
        ("", fsm),
        ("Rx", font),
        ("1) Amoxicillin 500mg - 1 tab thrice a day", fsm),
        ("   after food - for 5 days (morning, afternoon, night)", fsm),
        ("2) Paracetamol 650mg - SOS if fever above 100F", fsm),
        ("   (up to 3 times a day)", fsm),
        ("3) Cetirizine 10mg - 1 tab at night for 5 days", fsm),
        ("", fsm),
        ("Advice: Drink plenty of water, take rest.", fsm),
        ("Follow up after 5 days.", fsm),
        ("Signature: A. Sharma", fsm),
    ]
    y = 30
    for text, f in lines:
        d.text((30, y), text, fill="black", font=f)
        y += 40
    # Add a border for edges
    d.rectangle([(10, 10), (690, 890)], outline="black", width=3)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return base64.b64encode(buf.getvalue()).decode()


# ---------- Auth ----------
class TestAuth:
    def test_invalid_session_returns_401(self):
        r = requests.post(f"{BASE}/api/auth/session", json={"session_id": "invalid_xyz_123"})
        assert r.status_code == 401, r.text

    def test_me_requires_bearer(self):
        r = requests.get(f"{BASE}/api/auth/me")
        assert r.status_code == 401

    def test_me_with_seeded_token(self):
        r = requests.get(f"{BASE}/api/auth/me", headers=H)
        assert r.status_code == 200, r.text
        u = r.json()
        assert u["user_id"] == "user_testabc123"
        assert u["email"] == "test@mediguide.ai"
        assert "_id" not in u

    def test_reports_unauthenticated(self):
        r = requests.get(f"{BASE}/api/reports")
        assert r.status_code == 401


# ---------- Analyze ----------
class TestAnalyze:
    def test_analyze_prescription(self, prescription_b64):
        r = requests.post(f"{BASE}/api/reports/analyze",
                          json={"image_base64": prescription_b64, "title": "TEST_Prescription"},
                          headers=H, timeout=90)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "report" in data and "medicines" in data
        rep = data["report"]
        assert rep["id"].startswith("rep_")
        assert "confidence" in rep and isinstance(rep["confidence"], int)
        assert "_id" not in rep
        # medicines should be present with timing arrays
        assert isinstance(data["medicines"], list)
        if data["medicines"]:
            m = data["medicines"][0]
            assert m["id"].startswith("med_")
            assert isinstance(m["timing"], list) and len(m["timing"]) >= 1
            for t in m["timing"]:
                assert t in ("morning", "afternoon", "evening", "night")
        pytest.report_id = rep["id"]


# ---------- Reports listing ----------
class TestReports:
    def test_list_reports(self):
        r = requests.get(f"{BASE}/api/reports", headers=H)
        assert r.status_code == 200
        arr = r.json()
        assert isinstance(arr, list)
        assert len(arr) >= 1
        assert all("_id" not in x and "image_base64" not in x for x in arr)

    def test_list_reports_filter_type(self):
        r = requests.get(f"{BASE}/api/reports?report_type=prescription", headers=H)
        assert r.status_code == 200
        for x in r.json():
            assert x["report_type"] == "prescription"

    def test_list_reports_search(self):
        r = requests.get(f"{BASE}/api/reports?search=TEST", headers=H)
        assert r.status_code == 200

    def test_get_report_by_id(self):
        rid = getattr(pytest, "report_id", None)
        if not rid:
            arr = requests.get(f"{BASE}/api/reports", headers=H).json()
            rid = arr[0]["id"]
        r = requests.get(f"{BASE}/api/reports/{rid}", headers=H)
        assert r.status_code == 200
        d = r.json()
        assert d["report"]["id"] == rid
        assert isinstance(d["medicines"], list)

    def test_get_report_404(self):
        r = requests.get(f"{BASE}/api/reports/rep_nonexistent999", headers=H)
        assert r.status_code == 404


# ---------- Medicines ----------
class TestMedicines:
    def test_today_groups(self):
        r = requests.get(f"{BASE}/api/medicines/today", headers=H)
        assert r.status_code == 200
        d = r.json()
        for p in ("morning", "afternoon", "evening", "night"):
            assert p in d and isinstance(d[p], list)

    def test_log_medicine_and_dashboard(self):
        # find one medicine
        d = requests.get(f"{BASE}/api/medicines/today", headers=H).json()
        med = None
        period = None
        for p in ("morning", "afternoon", "evening", "night"):
            if d.get(p):
                med = d[p][0]; period = p; break
        if not med:
            pytest.skip("no medicines yet")
        r = requests.post(f"{BASE}/api/medicines/{med['id']}/log",
                          json={"status": "completed", "period": period}, headers=H)
        assert r.status_code == 200
        # confirm via today
        d2 = requests.get(f"{BASE}/api/medicines/today", headers=H).json()
        found = [m for m in d2[period] if m["id"] == med["id"]]
        assert found and found[0]["status"] == "completed"
        # dashboard
        dash = requests.get(f"{BASE}/api/dashboard", headers=H).json()
        assert dash["today_completed"] >= 1
        assert 0 <= dash["health_score"] <= 100
        assert 0 <= dash["adherence"] <= 100

    def test_log_invalid_status(self):
        r = requests.post(f"{BASE}/api/medicines/med_xxx/log",
                          json={"status": "bogus", "period": "morning"}, headers=H)
        assert r.status_code == 400


# ---------- Chat ----------
class TestChat:
    def test_chat_stream(self):
        r = requests.post(f"{BASE}/api/chat", json={"message": "What is paracetamol used for?"},
                          headers=H, stream=True, timeout=60)
        assert r.status_code == 200
        chunks = []
        done = False
        for line in r.iter_lines(decode_unicode=True):
            if not line:
                continue
            if line.startswith("data:"):
                payload = line[5:].strip()
                if payload == "[DONE]":
                    done = True; break
                try:
                    j = json.loads(payload)
                    if "content" in j:
                        chunks.append(j["content"])
                except Exception:
                    pass
        assert done
        assert len("".join(chunks)) > 5

    def test_chat_history_persists(self):
        time.sleep(1)
        r = requests.get(f"{BASE}/api/chat/history", headers=H)
        assert r.status_code == 200
        msgs = r.json()
        assert len(msgs) >= 2
        roles = [m["role"] for m in msgs[-2:]]
        assert "user" in roles and "assistant" in roles


# ---------- Emergency ----------
class TestEmergency:
    def test_emergency_round_trip(self):
        payload = {"blood_group": "O+", "allergies": ["penicillin"], "conditions": ["asthma"],
                   "emergency_contacts": [{"name": "Jane", "phone": "+1234567890"}], "notes": "TEST"}
        r = requests.put(f"{BASE}/api/emergency", json=payload, headers=H)
        assert r.status_code == 200
        g = requests.get(f"{BASE}/api/emergency", headers=H)
        assert g.status_code == 200
        card = g.json()
        assert card["blood_group"] == "O+"
        assert "penicillin" in card["allergies"]
        assert "asthma" in card["conditions"]
        assert card["emergency_contacts"][0]["name"] == "Jane"
        assert "current_medicines" in card and isinstance(card["current_medicines"], list)

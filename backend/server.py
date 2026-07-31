import json
import logging
import os
import re
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Optional

import httpx
from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from emergentintegrations.llm.chat import (  # noqa: E402
    ImageContent,
    LlmChat,
    StreamDone,
    TextDelta,
    UserMessage,
)

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')
GEMINI_MODEL = "gemini-3-flash-preview"
EMERGENT_SESSION_API = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"

app = FastAPI(title="MediGuide AI API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("mediguide")

DISCLAIMER = "This is educational information only, not medical advice. Always consult your doctor."


def now_utc():
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.isoformat()


# ---------- Models ----------
class SessionRequest(BaseModel):
    session_id: str


class MedicineOut(BaseModel):
    id: str
    report_id: str
    name: str
    purpose: str = ""
    dosage: str = ""
    how_to_take: str = ""
    timing: List[str] = []
    side_effects: List[str] = []
    precautions: List[str] = []


class ChatRequest(BaseModel):
    message: str
    report_id: Optional[str] = None
    language: Optional[str] = "en"


class MedLogRequest(BaseModel):
    status: str  # completed | skipped | pending
    period: str  # morning | afternoon | evening | night


class EmergencyCard(BaseModel):
    blood_group: str = ""
    allergies: List[str] = []
    conditions: List[str] = []
    emergency_contacts: List[dict] = []
    notes: str = ""


class AnalyzeRequest(BaseModel):
    image_base64: str
    title: Optional[str] = None
    language: Optional[str] = "en"


class VitalRequest(BaseModel):
    vital_type: str  # bp | sugar | weight
    systolic: Optional[float] = None
    diastolic: Optional[float] = None
    value: Optional[float] = None
    recorded_at: Optional[str] = None


LANG_NAMES = {"en": "English", "hi": "Hindi", "bn": "Bengali"}


# ---------- Auth helpers ----------
async def get_current_user(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = auth.split(" ", 1)[1]
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    expires = session["expires_at"]
    if isinstance(expires, str):
        expires = datetime.fromisoformat(expires)
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires < now_utc():
        raise HTTPException(status_code=401, detail="Session expired")
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


@api_router.post("/auth/session")
async def create_session(body: SessionRequest):
    async with httpx.AsyncClient(timeout=15) as hc:
        resp = await hc.get(EMERGENT_SESSION_API, headers={"X-Session-ID": body.session_id})
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session id")
    data = resp.json()
    existing = await db.users.find_one({"email": data["email"]}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one({"user_id": user_id}, {"$set": {"name": data.get("name", ""), "picture": data.get("picture", "")}})
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": data["email"],
            "name": data.get("name", ""),
            "picture": data.get("picture", ""),
            "created_at": iso(now_utc()),
        })
    session_token = data["session_token"]
    await db.user_sessions.insert_one({
        "session_token": session_token,
        "user_id": user_id,
        "created_at": now_utc(),
        "expires_at": now_utc() + timedelta(days=7),
    })
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {"user": user, "session_token": session_token}


@api_router.get("/auth/me")
async def auth_me(request: Request):
    return await get_current_user(request)


@api_router.post("/auth/logout")
async def logout(request: Request):
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        await db.user_sessions.delete_one({"session_token": auth.split(" ", 1)[1]})
    return {"ok": True}


# ---------- AI Analysis ----------
ANALYSIS_PROMPT = """You are MediGuide AI, an educational medical document assistant. Analyze this medical document image (prescription, lab report, or discharge summary).

Return ONLY valid JSON (no markdown fences) with this exact structure:
{
  "report_type": "prescription" | "lab_report" | "discharge_summary" | "other",
  "title": "short descriptive title",
  "detected_text": "key text detected from the document",
  "summary": "2-3 sentence plain-language summary",
  "simple_explanation": "explain what this document means in very simple, friendly language a 12-year-old could understand",
  "condition_explanation": "educational explanation of any condition/disease mentioned (or empty string)",
  "doctor_instructions": ["instruction 1", "instruction 2"],
  "precautions": ["precaution 1"],
  "confidence": 0-100 integer of how confident you are in reading this document,
  "medicines": [
    {
      "name": "medicine name",
      "purpose": "what it is for (educational)",
      "dosage": "e.g. 500mg",
      "how_to_take": "e.g. after food with water",
      "timing": ["morning","afternoon","evening","night"] (only applicable ones),
      "side_effects": ["common side effect"],
      "precautions": ["precaution"]
    }
  ]
}

Rules: Never diagnose or recommend starting/stopping/changing medicines. Educational tone only. If the image is not a medical document or unreadable, set confidence below 30 and explain in summary."""


def parse_json_response(text: str) -> dict:
    text = text.strip()
    text = re.sub(r'^```(json)?', '', text).strip()
    text = re.sub(r'```$', '', text).strip()
    match = re.search(r'\{.*\}', text, re.DOTALL)
    if match:
        return json.loads(match.group(0))
    return json.loads(text)


@api_router.post("/reports/analyze")
async def analyze_report(body: AnalyzeRequest, request: Request):
    user = await get_current_user(request)
    lang = LANG_NAMES.get(body.language or "en", "English")
    chat = LlmChat(
        api_key=LLM_KEY,
        session_id=f"analyze-{uuid.uuid4().hex[:8]}",
        system_message="You are a careful medical document analysis assistant. Output only valid JSON.",
    ).with_model("gemini", GEMINI_MODEL)
    lang_note = "" if lang == "English" else f"\n\nIMPORTANT: Write ALL human-readable values (title, summary, simple_explanation, condition_explanation, doctor_instructions, precautions, medicine purpose/how_to_take/side_effects/precautions) in {lang}. Keep JSON keys, report_type and medicine names in English."
    msg = UserMessage(text=ANALYSIS_PROMPT + lang_note, file_contents=[ImageContent(image_base64=body.image_base64)])
    try:
        raw = ""
        async for ev in chat.stream_message(msg):
            if isinstance(ev, TextDelta):
                raw += ev.content
            elif isinstance(ev, StreamDone):
                break
        analysis = parse_json_response(raw)
    except json.JSONDecodeError:
        logger.error("JSON parse failed: %s", raw[:500])
        raise HTTPException(status_code=422, detail="Could not analyze document. Please retake a clearer photo.")
    except Exception as e:
        logger.error("Analysis failed: %s", e)
        raise HTTPException(status_code=502, detail="AI analysis failed. Please try again.")

    report_id = f"rep_{uuid.uuid4().hex[:12]}"
    report = {
        "id": report_id,
        "user_id": user["user_id"],
        "title": body.title or analysis.get("title", "Medical Report"),
        "report_type": analysis.get("report_type", "other"),
        "summary": analysis.get("summary", ""),
        "simple_explanation": analysis.get("simple_explanation", ""),
        "condition_explanation": analysis.get("condition_explanation", ""),
        "doctor_instructions": analysis.get("doctor_instructions", []),
        "precautions": analysis.get("precautions", []),
        "confidence": int(analysis.get("confidence", 0)),
        "detected_text": analysis.get("detected_text", ""),
        "image_base64": body.image_base64,
        "created_at": iso(now_utc()),
        "disclaimer": DISCLAIMER,
    }
    await db.reports.insert_one({**report})

    medicines = []
    for m in analysis.get("medicines", []):
        med = {
            "id": f"med_{uuid.uuid4().hex[:12]}",
            "user_id": user["user_id"],
            "report_id": report_id,
            "name": m.get("name", "Unknown"),
            "purpose": m.get("purpose", ""),
            "dosage": m.get("dosage", ""),
            "how_to_take": m.get("how_to_take", ""),
            "timing": [t for t in m.get("timing", []) if t in ("morning", "afternoon", "evening", "night")] or ["morning"],
            "side_effects": m.get("side_effects", []),
            "precautions": m.get("precautions", []),
            "active": True,
            "created_at": iso(now_utc()),
        }
        medicines.append(med)
    if medicines:
        await db.medicines.insert_many([{**m} for m in medicines])

    report.pop("image_base64", None)
    return {"report": report, "medicines": medicines}


@api_router.get("/reports")
async def list_reports(request: Request, search: Optional[str] = None, report_type: Optional[str] = None):
    user = await get_current_user(request)
    query = {"user_id": user["user_id"]}
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"summary": {"$regex": search, "$options": "i"}},
            {"detected_text": {"$regex": search, "$options": "i"}},
        ]
    if report_type and report_type != "all":
        query["report_type"] = report_type
    reports = await db.reports.find(query, {"_id": 0, "image_base64": 0}).sort("created_at", -1).to_list(200)
    return reports


@api_router.get("/reports/{report_id}")
async def get_report(report_id: str, request: Request):
    user = await get_current_user(request)
    report = await db.reports.find_one({"id": report_id, "user_id": user["user_id"]}, {"_id": 0, "image_base64": 0})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    medicines = await db.medicines.find({"report_id": report_id}, {"_id": 0}).to_list(100)
    return {"report": report, "medicines": medicines}


@api_router.delete("/reports/{report_id}")
async def delete_report(report_id: str, request: Request):
    user = await get_current_user(request)
    await db.reports.delete_one({"id": report_id, "user_id": user["user_id"]})
    await db.medicines.delete_many({"report_id": report_id, "user_id": user["user_id"]})
    return {"ok": True}


# ---------- Medicines & Timeline ----------
@api_router.get("/medicines/today")
async def medicines_today(request: Request):
    user = await get_current_user(request)
    today = now_utc().date().isoformat()
    meds = await db.medicines.find({"user_id": user["user_id"], "active": True}, {"_id": 0}).to_list(200)
    logs = await db.med_logs.find({"user_id": user["user_id"], "date": today}, {"_id": 0}).to_list(500)
    log_map = {(l["medicine_id"], l["period"]): l["status"] for l in logs}
    periods = {"morning": [], "afternoon": [], "evening": [], "night": []}
    for med in meds:
        for period in med.get("timing", []):
            if period in periods:
                periods[period].append({**med, "status": log_map.get((med["id"], period), "pending"), "period": period})
    return periods


@api_router.post("/medicines/{medicine_id}/log")
async def log_medicine(medicine_id: str, body: MedLogRequest, request: Request):
    user = await get_current_user(request)
    if body.status not in ("completed", "skipped", "pending"):
        raise HTTPException(status_code=400, detail="Invalid status")
    today = now_utc().date().isoformat()
    await db.med_logs.update_one(
        {"user_id": user["user_id"], "medicine_id": medicine_id, "period": body.period, "date": today},
        {"$set": {"status": body.status, "updated_at": iso(now_utc())}},
        upsert=True,
    )
    return {"ok": True, "status": body.status}


# ---------- Dashboard ----------
@api_router.get("/dashboard")
async def dashboard(request: Request):
    user = await get_current_user(request)
    uid = user["user_id"]
    reports_count = await db.reports.count_documents({"user_id": uid})
    recent_reports = await db.reports.find({"user_id": uid}, {"_id": 0, "image_base64": 0}).sort("created_at", -1).to_list(3)
    meds = await db.medicines.find({"user_id": uid, "active": True}, {"_id": 0}).to_list(200)
    today = now_utc().date().isoformat()
    logs = await db.med_logs.find({"user_id": uid, "date": today}, {"_id": 0}).to_list(500)
    total_doses = sum(len(m.get("timing", [])) for m in meds)
    completed = sum(1 for l in logs if l["status"] == "completed")
    skipped = sum(1 for l in logs if l["status"] == "skipped")
    # 7-day adherence
    week_ago = (now_utc().date() - timedelta(days=7)).isoformat()
    week_logs = await db.med_logs.find({"user_id": uid, "date": {"$gte": week_ago}}, {"_id": 0}).to_list(2000)
    week_completed = sum(1 for l in week_logs if l["status"] == "completed")
    week_total = len(week_logs)
    adherence = round((week_completed / week_total) * 100) if week_total else 100
    health_score = min(100, 60 + round(adherence * 0.35) + (5 if reports_count > 0 else 0))
    return {
        "user": user,
        "health_score": health_score,
        "adherence": adherence,
        "reports_count": reports_count,
        "recent_reports": recent_reports,
        "today_total_doses": total_doses,
        "today_completed": completed,
        "today_skipped": skipped,
        "today_pending": max(0, total_doses - completed - skipped),
    }


# ---------- AI Chat ----------
CHAT_SYSTEM = """You are MediGuide AI, a friendly educational medical assistant inside a mobile app.
Rules:
- Explain medical terms, medicines, and reports in simple, warm language.
- NEVER diagnose, prescribe, or recommend starting/stopping/changing medicines.
- When relevant, remind the user to consult their doctor for medical decisions.
- Keep answers concise and mobile-friendly (short paragraphs, bullet lists).
{context}"""


@api_router.post("/chat")
async def chat_endpoint(body: ChatRequest, request: Request):
    user = await get_current_user(request)
    uid = user["user_id"]
    context = ""
    if body.report_id:
        report = await db.reports.find_one({"id": body.report_id, "user_id": uid}, {"_id": 0, "image_base64": 0})
        if report:
            meds = await db.medicines.find({"report_id": body.report_id}, {"_id": 0}).to_list(50)
            context = f"\nThe user is asking about this report:\n{json.dumps({'report': report, 'medicines': meds}, default=str)[:6000]}"
    else:
        reports = await db.reports.find({"user_id": uid}, {"_id": 0, "image_base64": 0}).sort("created_at", -1).to_list(3)
        if reports:
            context = f"\nUser's recent reports for context:\n{json.dumps(reports, default=str)[:6000]}"

    history = await db.chat_messages.find({"user_id": uid}, {"_id": 0}).sort("created_at", -1).to_list(10)
    history.reverse()
    history_text = "\n".join(f"{h['role']}: {h['content'][:500]}" for h in history)
    prompt = f"Previous conversation:\n{history_text}\n\nUser: {body.message}" if history_text else body.message

    await db.chat_messages.insert_one({
        "id": f"msg_{uuid.uuid4().hex[:12]}", "user_id": uid, "role": "user",
        "content": body.message, "report_id": body.report_id, "created_at": iso(now_utc()),
    })

    chat = LlmChat(
        api_key=LLM_KEY,
        session_id=f"chat-{uid}-{uuid.uuid4().hex[:6]}",
        system_message=CHAT_SYSTEM.format(context=context)
        + (f"\nAlways reply in {LANG_NAMES[body.language]}." if body.language in ("hi", "bn") else ""),
    ).with_model("gemini", GEMINI_MODEL)

    async def event_generator():
        full = ""
        try:
            async for ev in chat.stream_message(UserMessage(text=prompt)):
                if isinstance(ev, TextDelta):
                    full += ev.content
                    yield f"data: {json.dumps({'content': ev.content})}\n\n"
                elif isinstance(ev, StreamDone):
                    break
        except Exception as e:
            logger.error("Chat stream failed: %s", e)
            yield f"data: {json.dumps({'error': 'AI response failed. Please try again.'})}\n\n"
        if full:
            await db.chat_messages.insert_one({
                "id": f"msg_{uuid.uuid4().hex[:12]}", "user_id": uid, "role": "assistant",
                "content": full, "report_id": body.report_id, "created_at": iso(now_utc()),
            })
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@api_router.get("/chat/history")
async def chat_history(request: Request):
    user = await get_current_user(request)
    msgs = await db.chat_messages.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", 1).to_list(200)
    return msgs


@api_router.delete("/chat/history")
async def clear_chat(request: Request):
    user = await get_current_user(request)
    await db.chat_messages.delete_many({"user_id": user["user_id"]})
    return {"ok": True}


# ---------- Emergency Card ----------
@api_router.get("/emergency")
async def get_emergency(request: Request):
    user = await get_current_user(request)
    card = await db.emergency_cards.find_one({"user_id": user["user_id"]}, {"_id": 0})
    meds = await db.medicines.find({"user_id": user["user_id"], "active": True}, {"_id": 0, "name": 1, "dosage": 1}).to_list(50)
    if not card:
        card = {"user_id": user["user_id"], "blood_group": "", "allergies": [], "conditions": [], "emergency_contacts": [], "notes": ""}
    card["current_medicines"] = [{"name": m.get("name", ""), "dosage": m.get("dosage", "")} for m in meds]
    card["name"] = user.get("name", "")
    return card


@api_router.put("/emergency")
async def update_emergency(body: EmergencyCard, request: Request):
    user = await get_current_user(request)
    await db.emergency_cards.update_one(
        {"user_id": user["user_id"]},
        {"$set": {**body.dict(), "user_id": user["user_id"], "updated_at": iso(now_utc())}},
        upsert=True,
    )
    return {"ok": True}


# ---------- Vitals & Analytics ----------
@api_router.post("/vitals")
async def add_vital(body: VitalRequest, request: Request):
    user = await get_current_user(request)
    if body.vital_type not in ("bp", "sugar", "weight"):
        raise HTTPException(status_code=400, detail="Invalid vital type")
    if body.vital_type == "bp" and (body.systolic is None or body.diastolic is None):
        raise HTTPException(status_code=400, detail="BP requires systolic and diastolic")
    if body.vital_type in ("sugar", "weight") and body.value is None:
        raise HTTPException(status_code=400, detail="Value required")
    vital = {
        "id": f"vit_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "vital_type": body.vital_type,
        "systolic": body.systolic,
        "diastolic": body.diastolic,
        "value": body.value,
        "recorded_at": body.recorded_at or iso(now_utc()),
    }
    await db.vitals.insert_one({**vital})
    return vital


@api_router.get("/vitals")
async def list_vitals(request: Request, vital_type: Optional[str] = None):
    user = await get_current_user(request)
    query = {"user_id": user["user_id"]}
    if vital_type:
        query["vital_type"] = vital_type
    return await db.vitals.find(query, {"_id": 0}).sort("recorded_at", 1).to_list(500)


@api_router.delete("/vitals/{vital_id}")
async def delete_vital(vital_id: str, request: Request):
    user = await get_current_user(request)
    await db.vitals.delete_one({"id": vital_id, "user_id": user["user_id"]})
    return {"ok": True}


@api_router.get("/analytics")
async def analytics(request: Request):
    user = await get_current_user(request)
    uid = user["user_id"]
    # 7-day adherence series
    adherence_series = []
    for i in range(6, -1, -1):
        day = (now_utc().date() - timedelta(days=i))
        logs = await db.med_logs.find({"user_id": uid, "date": day.isoformat()}, {"_id": 0}).to_list(500)
        total = len(logs)
        completed = sum(1 for l in logs if l["status"] == "completed")
        adherence_series.append({
            "date": day.isoformat(),
            "label": day.strftime("%a"),
            "pct": round((completed / total) * 100) if total else 0,
            "total": total,
        })
    # monthly uploads (last 6 months)
    reports = await db.reports.find({"user_id": uid}, {"_id": 0, "created_at": 1}).to_list(1000)
    monthly = {}
    for r in reports:
        month = r["created_at"][:7]
        monthly[month] = monthly.get(month, 0) + 1
    months = []
    for i in range(5, -1, -1):
        d = now_utc().replace(day=1) - timedelta(days=i * 30)
        key = d.strftime("%Y-%m")
        months.append({"month": key, "label": d.strftime("%b"), "count": monthly.get(key, 0)})
    # vitals series
    vitals = await db.vitals.find({"user_id": uid}, {"_id": 0}).sort("recorded_at", 1).to_list(500)
    bp = [v for v in vitals if v["vital_type"] == "bp"][-14:]
    sugar = [v for v in vitals if v["vital_type"] == "sugar"][-14:]
    weight = [v for v in vitals if v["vital_type"] == "weight"][-14:]
    week_logs_flat = [l for d in adherence_series for l in [d] if d["total"]]
    overall = round(sum(d["pct"] for d in week_logs_flat) / len(week_logs_flat)) if week_logs_flat else 100
    return {
        "adherence_7d": adherence_series,
        "adherence_overall": overall,
        "monthly_uploads": months,
        "bp": bp,
        "sugar": sugar,
        "weight": weight,
        "reports_count": len(reports),
    }


@api_router.get("/")
async def root():
    return {"message": "MediGuide AI API", "status": "ok"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
    await db.reports.create_index([("user_id", 1), ("created_at", -1)])
    await db.medicines.create_index("user_id")
    await db.med_logs.create_index([("user_id", 1), ("date", 1)])
    await db.chat_messages.create_index([("user_id", 1), ("created_at", 1)])
    await db.vitals.create_index([("user_id", 1), ("recorded_at", 1)])


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

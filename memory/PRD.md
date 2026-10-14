# MediGuide AI — PRD & Progress

## Original Problem Statement
Build a premium AI-powered assistant that helps patients understand prescriptions, lab reports and discharge summaries. Simplify complex medical info, organize medicine schedules, reminders, AI chat, emergency card, dark/light mode. Must NOT diagnose or prescribe — educational only with disclaimers. Premium UI (Apple/Linear/Stripe-inspired), glassmorphism, gradients, color palette Primary #2563EB / Secondary #14B8A6 / Accent #8B5CF6.

## User Choices
- Mobile app stack: Expo (Router, SDK 54) + FastAPI + MongoDB — confirmed
- AI: Gemini via Emergent Universal LLM Key (model: gemini-3-flash-preview); user's own Gemini key can be swapped later
- Auth: Emergent-managed Google social login
- MVP scope confirmed; analytics charts & multi-language in phase 2


## Architecture
- Backend: /app/backend/server.py (FastAPI, single file). MongoDB collections: users, user_sessions, reports, medicines, med_logs, chat_messages, emergency_cards. All routes under /api. Bearer token auth.
- AI: emergentintegrations LlmChat, Gemini gemini-3-flash-preview. Analyze = image+prompt → structured JSON (report_type, summary, simple_explanation, condition_explanation, doctor_instructions, precautions, confidence, medicines[] with timing). Chat = SSE streaming grounded on recent/selected reports.
- Frontend: Expo Router. Landing (/), tabs: home, timeline, chat, history, profile; modals: /upload, /report/[id], /emergency. Theme context (dark default, persisted), AuthContext per Emergent auth playbook, chat streaming via expo/fetch. Design tokens from /app/design_guidelines.json.

## User Personas
- Patients (esp. elderly/non-medical) who receive prescriptions/lab reports and want plain-language explanations + medicine schedule tracking.

## Implemented (Jun 2026 — MVP)
- Google login (Emergent), session management, logout
- Report scan/upload (camera + gallery) with scanning animation → Gemini OCR + analysis
- AI Analysis screen: confidence badge, simple explanation, condition info, expandable medicine cards (purpose, dosage, how to take, side effects, precautions), doctor instructions, precautions, disclaimer
- Medicine Timeline: morning/afternoon/evening/night vertical timeline, complete/skip/pending with haptics, filter chips
- Dashboard: health score (adherence-based), today's dose stats, quick actions, recent reports
- AI Chat: streaming SSE responses, suggestion chips, history persistence, safety banner
- History: search + type filter chips
- Emergency Card: Apple Wallet-style card, QR code, blood group, allergies, conditions, contacts, current medicines, edit form
- Profile: dark/light toggle (persisted), emergency link, sign out
- Testing: 16/16 backend tests + full frontend e2e passed (iteration_1)

## Backlog (prioritized)
- P0: —
- P1: Health analytics charts (BP/sugar/weight trends, adherence %, monthly uploads); multi-language (Hindi, Bengali); voice narration (OpenAI TTS via universal key)
- P1: Local medicine reminders (notifications require user request + build)
- P2: Drug interaction warnings, export PDF, medicine scanner, smart symptom search, PWA/offline cache

## Notes
- Test session for API testing: see /app/memory/test_credentials.md
- Emergent LLM key in /app/backend/.env; swap to user's own GEMINI key on request

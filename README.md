# OPIc Practice Studio 🎙️

> **Target Intermediate High (IH)** — An interactive test simulation and AI diagnostic coaching studio designed specifically for Vietnamese learners preparing for the OPIc spoken English test.

---

### ⚠️ Disclaimer
**OPIc Practice Studio is an independent educational practice platform and is NOT affiliated with, sponsored by, or endorsed by ACTFL or Language Testing International (LTI).** All practice prompts, question sets, and evaluation frameworks are original educational simulations created to assist candidates in reaching Intermediate High (IH) proficiency.

---

## 🏗️ Architecture & Technology Stack

- **Backend**:
  - Python 3.11+, FastAPI (REST API + WebSocket proxy)
  - SQLAlchemy ORM with SQLite default (switches seamlessly to PostgreSQL via `DATABASE_URL`)
  - Pydantic V2 models & JSON schema validation with retry resilience
  - ReportLab automated PDF diagnostic report generation
  - Direct bcrypt password hashing and JWT authentication
- **Speech & AI Intelligence**:
  - **LLM**: OpenAI API (`OPENAI_MODEL` env var, default `"gpt-5.6-luna"`, structured outputs)
  - **STT (Speech-to-Text)**: Soniox real-time WebSocket streaming (`/ws/stt` proxy + temporary token generator; permanent API key is never exposed to the client)
  - **TTS (Text-to-Speech)**: open-source Kokoro-82M (`TTS_PROVIDER=kokoro`, voice `af_heart`, runs on CPU, no API key) or OpenAI TTS (`TTS_PROVIDER=openai`), with disk-based hash caching (`hash(text + voice + model)`) so every prompt is synthesized only once; browser Web Speech API fallback
- **Frontend**:
  - React 18, Vite 5, Tailwind CSS
  - SVG Animated Examiner Avatar "Eva" with synchronized mouth animation and audio soundwave visualizer
  - Web Audio API microphone volume meter & 60s–120s OPIc target zone timer
  - Interactive Side-by-Side Diff Viewer ("Improve my answer")
  - Sentence-by-sentence Shadowing Mode with speed controls (0.7x – 1.2x)
  - Custom 6-axis Radar Chart comparing against the 4.0 IH benchmark line
  - English UI with Vietnamese tooltips (`ViTooltip`)

---

## 📁 Repository Structure

```
opic-practice-studio/
├── .env.example                # Template for environment configuration
├── .gitignore                  # Git ignore rules for Python, Node, data, and cache
├── docker-compose.yml          # Containerized setup for backend, frontend, and PostgreSQL
├── README.md                   # Documentation and run instructions
├── backend/
│   ├── Dockerfile              # Python 3.12 slim container
│   ├── requirements.txt        # Backend dependencies
│   └── app/
│       ├── main.py             # FastAPI entrypoint, CORS, static mounts
│       ├── config.py           # Pydantic BaseSettings
│       ├── database.py         # SQLAlchemy engine and session dependency
│       ├── models/             # Database ORM models
│       │   ├── user.py         # Candidate accounts
│       │   ├── session.py      # Test sessions (survey, self-assessment, topics)
│       │   ├── question.py     # Questions & Model answers
│       │   ├── answer.py       # Answers & Versioning
│       │   ├── evaluation.py   # ACTFL evaluations & Feedback items
│       │   └── report.py       # Diagnostic session reports & LLM usage logs
│       ├── schemas/            # Pydantic request/response schemas
│       ├── core/
│       │   ├── rubrics.py      # Single source of truth for IL, IM, IH rubrics
│       │   ├── security.py     # Bcrypt & JWT verification
│       │   └── seed_data.py    # Curated OPIc question banks & Vietnamese guides
│       ├── prompts/            # LLM prompt templates
│       │   ├── evaluate.txt    # ACTFL rater evaluation template
│       │   ├── rewrite.txt     # Upgrade answer template (IL -> IM, IM -> IH)
│       │   ├── model_answers.txt # 3-level model generation template
│       │   └── session_report.txt # Final diagnostic report template
│       ├── services/
│       │   ├── llm_service.py  # OpenAI client with structured parsing & retry
│       │   ├── tts_service.py  # Eva TTS (Kokoro / OpenAI) with hash disk caching
│       │   ├── stt_service.py  # Soniox proxy & word confidence parser
│       │   ├── question_generator.py # 15-question OPIc exam generator
│       │   └── pdf_service.py  # ReportLab PDF report generation
│       ├── routers/            # API endpoints (/auth, /sessions, /questions, /answers, /stt, /history, /system)
│       └── tests/              # Pytest unit & end-to-end integration tests
└── frontend/
    ├── package.json            # Node dependencies
    ├── vite.config.js          # Vite config with API & WebSocket proxies
    ├── tailwind.config.js      # Tailwind CSS styling system
    ├── index.html              # HTML shell
    ├── src/
    │   ├── main.jsx            # React root
    │   ├── App.jsx             # State router & orchestration
    │   ├── index.css           # Custom styles & animations
    │   ├── api/client.js       # Axios HTTP & STT client
    │   ├── context/AuthContext.jsx # Candidate auth state
    │   ├── components/         # Reusable UI components
    │   │   ├── EvaAvatar.jsx   # Animated AI examiner with mouth sync
    │   │   ├── AudioRecorder.jsx # Recording timer with 60-120s sweet spot
    │   │   ├── DiffViewer.jsx  # Side-by-side answer upgrade comparison
    │   │   ├── RadarChart.jsx  # 6-criteria radar chart with IH target line
    │   │   ├── ShadowingPlayer.jsx # Sentence-by-sentence shadowing mode
    │   │   ├── Tooltip.jsx     # Bilingual Vietnamese guidance tooltips
    │   │   └── RubricGuideModal.jsx # Comprehensive ACTFL scoring criteria
    │   └── pages/              # Flow screens
    │       ├── Login.jsx       # Email & Magic code login
    │       ├── Dashboard.jsx   # Candidate studio home
    │       ├── SystemCheck.jsx # 5-step hardware check (Bandwidth, Browser, Mic, Video, Captions)
    │       ├── Survey.jsx      # Background survey
    │       ├── SelfAssessment.jsx # 6 difficulty levels
    │       ├── TopicSelection.jsx # Choose exactly 3 of 5 topics
    │       ├── PreTestSetup.jsx # Eva warm-up question calibration
    │       ├── TestSession.jsx # 15-question test interface
    │       ├── AnswerCoaching.jsx # Editable transcript, evaluation, rewrite, models
    │       ├── SessionReport.jsx # Diagnostic report & PDF export
    │       └── HistoryPage.jsx # Archive and analytics dashboard
```

---

## 🚀 Quickstart & Run Instructions

### 1. Environment Configuration

Copy the example environment template:
```bash
cp .env.example .env
```
Fill in your credentials in `.env`:
```ini
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5.6-luna
TTS_PROVIDER=kokoro          # kokoro (open-source, no key) | openai | browser
KOKORO_VOICE=af_heart
SONIOX_API_KEY=...
DATABASE_URL=sqlite:///./data/opic_studio.db
SECRET_KEY=secure_random_key_here
```

> **Offline/Mock Mode**: If `OPENAI_API_KEY` or `SONIOX_API_KEY` are not set, the studio automatically switches to built-in pedagogical mock generators and chimes, allowing 100% full testing and demonstration offline.

---

### 2. Run Locally (Development)

#### Backend
```bash
cd backend
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
Backend API will be running at: `http://localhost:8000` (API Docs at `http://localhost:8000/docs`).

#### Frontend
```bash
cd frontend
npm install
npm run dev
```
Frontend application will be running at: `http://localhost:5173`.

---

### 3. Run with Docker Compose

To launch the full stack (Frontend, Backend, and PostgreSQL database) with a single command:
```bash
docker-compose up --build
```
- Web Application: `http://localhost:5173`
- Backend API Docs: `http://localhost:8000/docs`
- PostgreSQL: `localhost:5432`

---

## 🧪 Testing

Run backend unit and end-to-end integration tests:
```bash
# From workspace root
$env:PYTHONPATH="backend"  # On Windows PowerShell
python -m pytest backend/app/tests -v
```
All tests validate:
- Level rubric completeness and Vietnamese prompt injection
- STT word confidence parsing
- Word-level diff chunk calculation for "Improve my answer"
- Full 15-question end-to-end flow with mocked speech and LLM services

---

## 📋 The 7-Step OPIc Test Flow

1. **System Check**: 5 checks (Bandwidth, Web browser, Microphone recording/playback, Video playback, Captions disabled check).
2. **Background Survey**: Real-world categories (Occupation, Student status, Living situation, Leisure activities, Hobbies, Sports, Travel).
3. **Self-Assessment**: Levels 1 to 6 in English and Vietnamese; levels 4 & 5 recommended for IH candidates.
4. **Topic Selection**: Selects exactly 3 of 5 topics:
   - 1) Environment
   - 2) Human Rights
   - 3) Global Workplace
   - 4) Socio-Cultural Issues
   - 5) Communication Media
5. **Pre-Test Setup & Warm-Up**: Eva plays sample question audio; candidate tests microphone.
6. **15-Question Test**:
   - Q1: Self-introduction (fixed default question, not scored)
   - Q2–Q4: Combo 1 (Survey Topic: Living/Routine/Incident)
   - Q5–Q7: Combo 2 (Survey Topic: Leisure/Café/Memorable story)
   - Q8–Q10: Combo 3 (Topic 1: Description/Past Effort/Comparison)
   - Q11–Q13: Role-Play Combo (Inquire 3–4 questions → Unexpected problem & 2–3 alternatives → Related past experience)
   - Q14: Topic 2 Complication narrative
   - Q15: Topic 3 Comparison past vs present & Future outlook
   - Q2–Q15 are personalised by the LLM from the survey, level and topics (curated bank as fallback)
7. **Coaching & Results**:
   - Real-time Soniox transcript with word confidence highlights
   - Inline transcript editing (creates `answer_version`)
   - ACTFL 6 sub-scores and IH gap analysis
   - "Improve my answer" side-by-side diff
   - 3-level model answers (IL, IM, IH) with sentence-by-sentence shadowing mode
   - Diagnostic Session Report with Radar Chart & PDF Export!

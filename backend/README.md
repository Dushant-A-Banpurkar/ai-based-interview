# AI-based Interview Backend

The backend is a TypeScript API for creating interview sessions, coordinating live interviews, running coding exercises, and generating post-interview reports. It uses Express and Socket.IO, MongoDB for persistent records, Redis and BullMQ for live session data and background work, and external AI and speech services.

For the full application setup and frontend instructions, see the [repository README](../README.md).

## Requirements

- Node.js 22 or later and npm.
- MongoDB and Redis.
- A Deepgram API key (required for the server to start).
- At least one AI provider key: OpenAI or Gemini, for interviewer responses. OpenAI is used for reports, with Gemini as a fallback.
- Judge0 for code execution and final coding-assignment verification.
- Cloudflare R2 credentials if you use the recording worker.

## Setup

Run these commands from the `backend/` directory:

```sh
npm install
```

Create `backend/.env` with the settings you need:

```dotenv
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/ai-based-interview
REDIS_URL=redis://localhost:6379

DEEPGRAM_API_KEY=your-deepgram-api-key
OPENAI_API_KEY=your-openai-api-key
GEMINI_API_KEY=your-gemini-api-key
GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/

JUDGE0_URL=http://localhost:2358
JUDGE0_API_KEY=your-judge0-api-key
FRONTEND_ORIGINS=http://localhost:3000
```

Never commit `.env` or real credentials. `MONGODB_URI`, `REDIS_URL`, and `DEEPGRAM_API_KEY` are needed for the backend's normal startup and live-interview features. Configure `OPENAI_API_KEY` or `GEMINI_API_KEY` for interviewer responses; report generation uses OpenAI first and falls back to Gemini. `OPENAI_INTERVIEW_MODEL` and `GEMINI_INTERVIEW_MODEL` optionally override the live-interviewer models.

`JUDGE0_URL` defaults to `http://localhost:2358`; configure the URL and any provider credentials required by your Judge0 deployment. `FRONTEND_ORIGINS` is a comma-separated list of additional allowed browser origins. For recording uploads, also configure `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_BUCKET_NAME`.

## Run and test

Start MongoDB and Redis, then run the backend:

```sh
npm run dev
```

The API listens on `http://localhost:5000` by default. Available scripts:

```sh
npm run build
npm start
npm test
npm run test:watch
npm run test:coverage
```

`npm start` runs the compiled `dist/main.js`; build first with `npm run build`.

## HTTP API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Process health check. |
| `GET` | `/ready` | Readiness check; returns `503` until MongoDB is connected. |
| `POST` | `/api/interviews/createinterviewsession` | Create an interview session. |
| `POST` | `/api/interviews/:interviewId/end` | End a session and queue report generation. |
| `GET` | `/api/interviews/:interviewId/status` | Get a session's current status. |
| `GET` | `/api/interviews/:interviewId/report` | Retrieve its generated report. |

Interview creation accepts multipart form data. Required fields are `candidateId`, `roleTitle`, and `jobDescription`; an optional resume PDF goes in the `pdf` field. Optional fields are `targetSkills`, `difficultyMode` (`beginner`, `medium`, `hard`, or `extreme`), `durationMinutes` (`15`, `30`, or `50`), `enableSandbox`, and `allowedLanguages`. Send array values such as `targetSkills` and `allowedLanguages` as JSON-encoded strings.

Example:

```sh
curl -X POST http://localhost:5000/api/interviews/createinterviewsession \
  -F "candidateId=candidate-123" \
  -F "roleTitle=Backend Engineer" \
  -F "jobDescription=Build and maintain backend services" \
  -F 'targetSkills=["Node.js","MongoDB"]' \
  -F 'allowedLanguages=["javascript","python"]' \
  -F "durationMinutes=30"
```

The response includes the created `interviewId`. Use it in the session routes and as the `interviewId` Socket.IO connection query parameter.

## Live interview and coding

The Socket.IO server handles live interview audio, transcription, interviewer responses, and coding events. The core client events include `start_interview`, `audio:stream`, `start_coding`, `sandbox_execute`, `coding_draft`, and `submit_coding`. Server events include `stt:transcript`, `ai_transcript`, `coding:started`, `sandbox_result`, and `interview:error`.

Coding assignments are selected from a curated bank. Supported languages are JavaScript, Python, and C++; assignment availability and timing are controlled by the backend. A sandbox run is not a final solution verification: the final submission is checked against private tests.

## Backend layout

```text
src/
  controller/    HTTP request handlers
  database/      MongoDB connection
  helper/        PDF text extraction
  middlewares/   Upload handling
  model/         Mongoose models
  queues/        BullMQ queues and recording storage
  routes/        Express routes
  schemas/       Request and socket validation
  services/      Interview, coding, sandbox, and report logic
  socket/        Live interview and coding event handlers
  test/          Vitest tests
  workers/       Background report processing
```

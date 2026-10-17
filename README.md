# AI-based Interview

AI-based Interview is an experimental interview-preparation project. It is intended to let a candidate practice a role-specific interview, optionally using a resume and job description to shape the session, then review an AI-generated evaluation.

The repository contains a TypeScript/Express backend and a Next.js frontend. The backend uses MongoDB for interview data, Redis and BullMQ for real-time and background work, Socket.IO for live communication, and external AI, speech-to-text, and code-execution services. The frontend includes interview setup, live-session, coding, and report components; the product and its end-to-end integration are still under active development.

## Capabilities

- Create interview sessions with a role, job description, skills, difficulty, and optional PDF resume.
- Stream audio over Socket.IO and request live transcription through Deepgram.
- Generate contextual interviewer follow-up questions from candidate transcripts using OpenAI, with Gemini as a fallback.
- Collect audio-derived telemetry in the browser and store session telemetry in Redis.
- Run submitted code through Judge0 when sandbox execution is enabled.
- Generate an interview evaluation with OpenAI and persist it in MongoDB.

Some of these paths are not yet wired end to end. See [Current implementation notes](#current-implementation-notes) before relying on the UI or report pipeline.

New to the codebase or preparing to explain it in an interview? Start with the [Project Study Guide](STUDY_GUIDE.md), which walks through the architecture, key files, live audio flow, and known limitations.

## Technology

| Area | Tools |
| --- | --- |
| Frontend | Next.js 16, React 19, TypeScript, Redux Toolkit, TanStack Query, Socket.IO Client |
| Backend | Node.js, TypeScript, Express 5, Socket.IO |
| Data and jobs | MongoDB with Mongoose, Redis, BullMQ |
| AI and media | OpenAI, Gemini, Deepgram, Meyda, Judge0 |
| Testing | Vitest |

## Repository layout

```text
backend/
  src/
    controller/       HTTP request handlers
    database/         MongoDB connection
    queues/           BullMQ queues and recording storage
    routes/           Express routes
    services/         Report and code-execution services
    socket/           Socket.IO handlers
    workers/          Background processing
    test/             Backend tests
frontend/
  src/
    app/              Next.js app routes and providers
    components/       Interview UI components
    hooks/            Client-side data and media hooks
    store/            Redux state and Socket.IO middleware
```

## Requirements

- Node.js and npm (use a current Node.js LTS release).
- MongoDB (local or hosted).
- Redis (local or hosted) for Socket.IO telemetry and BullMQ.
- API credentials for the external services you intend to use:
  - OpenAI or Gemini for live interviewer responses; OpenAI is also used for evaluation reports.
  - Deepgram for live speech transcription.
  - Judge0 RapidAPI for code execution.
  - AWS credentials, region, and an S3 bucket if using recording storage.
- A modern browser with microphone access for the live interview experience.

## Installation

Clone the repository and install dependencies in each app:

```sh
git clone https://github.com/Dushant-A-Banpurkar/ai-based-interview.git
cd ai-based-interview

cd backend
npm install

cd ../frontend
npm install
```

Create `backend/.env` and set the backend variables described below. Create `frontend/.env.local` for the frontend URLs. Do not commit either file or add real credentials to source control.

### Backend environment

```dotenv
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/ai-based-interview
REDIS_URL=redis://localhost:6379

OPENAI_API_KEY=your-openai-api-key
GEMINI_API_KEY=your-gemini-api-key
GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
DEEPGRAM_API_KEY=your-deepgram-api-key
JUDGE0_API_KEY=your-judge0-rapidapi-key

AWS_REGION=your-aws-region
S3_Bucket_NAME=your-s3-bucket-name
```

| Variable | Required for | Notes |
| --- | --- | --- |
| `PORT` | Backend server | Optional; defaults to `5000`. |
| `MONGODB_URI` | Backend startup | MongoDB connection string. |
| `REDIS_URL` | Real-time and queued work | Redis connection string; some components default to `redis://localhost:6379`. Set it explicitly for consistent local and deployed configuration. |
| `OPENAI_API_KEY` | Live interviewer and report generation | The interviewer defaults to `gpt-4o-mini`; the report worker currently requests `gpt-4o`. |
| `OPENAI_INTERVIEW_MODEL` | Live interviewer | Optional model override; defaults to `gpt-4o-mini`. |
| `GEMINI_API_KEY` | Live interviewer fallback | Used when OpenAI is unavailable or rate-limited. Set this or `OPENAI_API_KEY` to enable live interviewer responses. |
| `GEMINI_BASE_URL` | Gemini-compatible API | Optional; defaults to Google's OpenAI-compatible Generative Language API endpoint. |
| `GEMINI_INTERVIEW_MODEL` | Live interviewer fallback | Optional model override; defaults to `gemini-3.5-flash-lite`. Confirm that the model is available to your Gemini API account. |
| `DEEPGRAM_API_KEY` | Speech transcription | Used by the Socket.IO interview handler. Backend startup checks that this value is present. |
| `JUDGE0_API_KEY` | Code execution | Judge0 is accessed through the RapidAPI endpoint. |
| `AWS_REGION`, `S3_Bucket_NAME` | Recording storage | AWS SDK credentials must also be available through the standard AWS credential chain (for example, environment credentials or an assigned role). |

Deepgram is required for live speech transcription. Configure at least one interviewer AI provider (`OPENAI_API_KEY` or `GEMINI_API_KEY`); if both are configured, Gemini is tried when OpenAI fails. A provider HTTP 429 generally means the account is rate-limited or out of quota—check that provider's usage, billing, and model access. OpenAI, Judge0, and AWS credentials are feature-specific; configure them for the features you use. MongoDB is required for the API to start, and Redis is required for real-time/queue features.

### Frontend environment

```dotenv
NEXT_PUBLIC_BACKEND_API=http://localhost:5000
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
```

`NEXT_PUBLIC_SOCKET_URL` is used for the backend host by interview and socket code. `NEXT_PUBLIC_BACKEND_API` is referenced by the login and signup hooks. These values are public and must never contain secrets. The API URL conventions are not fully consistent across the current frontend; see [Current implementation notes](#current-implementation-notes).

## Running locally

Start MongoDB and Redis first. With Docker installed, Redis can be started locally with:

```sh
docker run --name ai-interview-redis --rm -p 6379:6379 redis:7
```

In separate terminals, run the backend and frontend development servers:

```sh
cd backend
npm run dev
```

```sh
cd frontend
npm run dev
```

The backend listens on `http://localhost:5000` by default. Its health endpoint is `http://localhost:5000/health`. The frontend uses the Next.js development-server default, usually `http://localhost:3000`.

### Live audio and interviewer

On the interview setup page, the browser captures microphone audio as 16 kHz, signed 16-bit linear PCM and sends binary chunks over the `audio:stream` Socket.IO event. The backend forwards the chunks to Deepgram (`nova-3`, `linear16`, 16 kHz). Final Deepgram transcripts are saved in Redis and sent to the room as `stt:transcript`; the interviewer uses recent conversation history to generate a follow-up through OpenAI or Gemini and sends it as `ai_transcript`. The live interview page renders both candidate and interviewer messages.

If Deepgram is still connecting, a small bounded number of audio chunks are buffered. Check backend logs for the Deepgram connection-open and first-response messages when diagnosing a missing transcript. Interviewer provider failures are reported to the browser; rate limits or exhausted provider quota must be resolved with the provider account.

### Docker Compose

The Compose backend reads `backend/.env` through `env_file`; create that file and include the required backend settings and service keys before starting Compose. Compose overrides `REDIS_URL` to use the Redis service. Start the containers from the repository root:

```sh
docker compose up --build
```

The frontend is built from its Docker image without a host bind mount, keeping `.next` inside the container and avoiding host/container ownership conflicts. Although the frontend Dockerfile sets `USER node`, the current Compose service explicitly overrides that user to `root`; remove that override if you want Compose to run the container as the non-root image user. Rebuild the frontend image after changing frontend source. The backend source is bind-mounted for development.

Background processing runs in a separate process. Keep the API server running in one terminal, then start the report worker from the backend directory in another:

```sh
npx tsx watch src/workers/interview.worker.ts
```

The report worker requires Redis and an AI provider API key. However, the report queue is not currently connected end to end: ending an interview enqueues a job on `interview-process`, while `src/workers/interview.worker.ts` listens on `interview-processing-queue`. The worker process can start, but it will not consume those report jobs until the queue names are aligned. The separate recording worker in `src/queues/interview.queue.ts` uses `interview-processing` and requires AWS/S3 configuration.

## Usage

The intended workflow is:

1. Create a session with the role title and job description; optionally include a resume PDF, target skills, interview difficulty, and allowed coding languages.
2. Open the session setup screen, allow microphone access, and establish the Socket.IO connection.
3. Complete the live interview and coding exercise.
4. End the session and view its report after background evaluation finishes.

The backend currently exposes these HTTP routes:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Check that the API process is responding. |
| `POST` | `/api/interviews/createinterviewsession` | Create an interview. Accepts multipart form data; an optional resume PDF is sent in the `file` field. |
| `POST` | `/api/interviews/:interviewId/end` | Mark an interview as processing and enqueue post-interview work. |
| `GET` | `/api/interviews/:interviewId/status` | Intended to return interview status. |
| `GET` | `/api/interviews/:interviewId/report` | Retrieve a generated report. |

Interview creation requires `candidateId`, `roleTitle`, and `jobDescription`. Optional fields include `targetSkills` (string array), `difficultyMode` (`beginner`, `medium`, `hard`, or `extreme`), `enableSandbox` (boolean), and `allowedLanguages` (string array). For multipart requests, send arrays as JSON-encoded strings. The API responds with an `interviewId`.

Example health check:

```sh
curl http://localhost:5000/health
```

The frontend is not yet a complete application flow. In particular, the root page is currently a placeholder, and the UI's authentication/dashboard and interview creation routes should not be assumed to work with the backend without further integration.

## Development and tests

Backend scripts (run from `backend/`):

```sh
npm run dev            # Start the API in watch mode
npm run build          # Compile TypeScript
npm test               # Run Vitest once
npm run test:watch     # Run Vitest in watch mode
npm run test:coverage  # Run tests with coverage
```

Frontend scripts (run from `frontend/`):

```sh
npm run dev
npm run build
npm run start
npm run lint
```

## Current implementation notes

- The frontend and backend currently disagree on some API paths and environment-variable fallbacks. Confirm and align these before using the frontend as an end-to-end client.
- Interview-status route handling is unfinished: the route parameter name and controller validation do not currently agree.
- Report jobs are added to the `interview-process` queue, but `src/workers/interview.worker.ts` consumes `interview-processing-queue`; align these names before expecting reports to be generated. The recording worker uses a third queue name, `interview-processing`.
- Authentication, dashboard behavior, interview lifecycle, and recording/report delivery are still evolving. Treat this project as an experiment rather than a production-ready interview or hiring system.

## Contributing

Contributions are welcome. Before opening a pull request:

1. Check existing issues and open a focused issue for substantial changes or behavior changes.
2. Keep changes scoped, follow the existing TypeScript and React patterns, and avoid committing credentials or local environment files.
3. Add or update tests for backend behavior; verify backend tests/build and the relevant frontend lint/build commands.
4. Update this README when setup, configuration, routes, scripts, or user-facing behavior changes.
5. Open a pull request with a concise summary, rationale, and test results. Note any external services or environment variables needed to verify the change.

## License

The backend package currently declares the ISC license. Review the repository and package license files before redistributing or reusing the project.

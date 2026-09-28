# AI-based Interview

AI-based Interview is an experimental interview-preparation project. It is intended to let a candidate practice a role-specific interview, optionally using a resume and job description to shape the session, then review an AI-generated evaluation.

The repository contains a TypeScript/Express backend and a Next.js frontend. The backend uses MongoDB for interview data, Redis and BullMQ for real-time and background work, Socket.IO for live communication, and external AI, speech-to-text, and code-execution services. The frontend includes interview setup, live-session, coding, and report components; the product and its end-to-end integration are still under active development.

## Capabilities

- Create interview sessions with a role, job description, skills, difficulty, and optional PDF resume.
- Stream audio over Socket.IO and request live transcription through Deepgram.
- Collect audio-derived telemetry in the browser and store session telemetry in Redis.
- Run submitted code through Judge0 when sandbox execution is enabled.
- Generate an interview evaluation with OpenAI and persist it in MongoDB.

Some of these paths are not yet wired end to end. See [Current implementation notes](#current-implementation-notes) before relying on the UI or report pipeline.

## Technology

| Area | Tools |
| --- | --- |
| Frontend | Next.js 16, React 19, TypeScript, Redux Toolkit, TanStack Query, Socket.IO Client |
| Backend | Node.js, TypeScript, Express 5, Socket.IO |
| Data and jobs | MongoDB with Mongoose, Redis, BullMQ |
| AI and media | OpenAI, Deepgram, Meyda, Judge0 |
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
  - OpenAI for evaluation reports.
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
PORT=6000
MONGODB_URI=mongodb://127.0.0.1:27017/ai-based-interview
REDIS_URL=redis://localhost:6379

OPENAI_API_KEY=your-openai-api-key
DEEPGRAM_API_KEY=your-deepgram-api-key
JUDGE0_API_KEY=your-judge0-rapidapi-key

AWS_REGION=your-aws-region
S3_Bucket_NAME=your-s3-bucket-name
```

| Variable | Required for | Notes |
| --- | --- | --- |
| `PORT` | Backend server | Optional; defaults to `6000`. |
| `MONGODB_URI` | Backend startup | MongoDB connection string. |
| `REDIS_URL` | Real-time and queued work | Redis connection string; some components default to `redis://localhost:6379`. Set it explicitly for consistent local and deployed configuration. |
| `OPENAI_API_KEY` | Report generation | The report worker currently requests the `gpt-4o` model. |
| `DEEPGRAM_API_KEY` | Speech transcription | Used by the Socket.IO interview handler. |
| `JUDGE0_API_KEY` | Code execution | Judge0 is accessed through the RapidAPI endpoint. |
| `AWS_REGION`, `S3_Bucket_NAME` | Recording storage | AWS SDK credentials must also be available through the standard AWS credential chain (for example, environment credentials or an assigned role). |

OpenAI, Deepgram, Judge0, and AWS credentials are feature-specific; configure the services used by your deployment. MongoDB is required for the API to start, and Redis is required for real-time/queue features.

### Frontend environment

```dotenv
NEXT_PUBLIC_BACKEND_API=http://localhost:6000
NEXT_PUBLIC_SOCKET_URL=http://localhost:6000
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

The backend listens on `http://localhost:6000` by default. Its health endpoint is `http://localhost:6000/health`. The frontend uses the Next.js development-server default, usually `http://localhost:3000`.

Background processing is implemented separately from the API server. To start the report worker from the backend directory:

```sh
npx tsx watch src/workers/interview.worker.ts
```

The worker requires Redis and `OPENAI_API_KEY`. Recording storage uses AWS and S3 configuration.

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
curl http://localhost:6000/health
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
- The report queue name used when ending an interview does not match the queue consumed by the report worker. As a result, launching the worker alone does not guarantee that queued reports will be processed.
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

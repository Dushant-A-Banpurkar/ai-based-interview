# Interview frontend

The frontend is a Next.js 16 and React 19 application for configuring interview
sessions, joining a live interview, working through a coding assignment, and
viewing the resulting report.

## Run locally

Install dependencies and start the frontend:

```sh
npm install
npm run dev
```

Set `frontend/.env.local`:

```dotenv
NEXT_PUBLIC_BACKEND_API=http://localhost:5000
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
```

The backend, MongoDB, and Redis must also be running. See the repository
[README](../README.md) for backend environment variables and service setup.
Microphone access requires browser permission; use localhost or a secure
context.

## Live coding flow

The live interview page connects to the backend with Socket.IO. The backend
decides whether an assignment is available and when its timer starts. When it
emits `coding:started`, the UI displays the statement, examples, constraints,
allowed languages, and remaining time.

- **Run Code** emits `sandbox_execute` and displays the result for the sample
  input. A successful run does not mean the assignment is solved.
- **Submit** emits `submit_coding` with the current source and language. The
  backend stores the final submission and checks its private test cases.
- The editor sends debounced `coding_draft` events so the latest code and
  language can be restored after reconnect. The server remains authoritative
  for assignment availability and timing.

Assignments are selected from a small curated backend bank. Judge0 is required
for sandbox execution and final verification.

## Development checks

Run these commands from `frontend/`:

```sh
npm run lint
npm run build
```

The Redux Socket.IO middleware is in `src/store/middleware/socketMiddleware.ts`;
interview/coding state is in `src/store/slices/interviewSlice.ts`; and the live
interview and editor UI are in `src/app/interview/[id]/page.tsx` and
`src/components/editor/CodeSandbox.tsx`.

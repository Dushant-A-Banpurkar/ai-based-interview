const backendUrls = [
  process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5000",
  process.env.NEXT_PUBLIC_BACKEND_BACKUP_API,
]
  .filter((url): url is string => Boolean(url))
  .map((url) => url.replace(/\/+$/, ""));

const readinessCache = new Map<
  string,
  { promise: Promise<boolean>; expiresAt: number }
>();

async function checkReady(baseUrl: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 3000);

  try {
    const response = await fetch(`${baseUrl}/ready`, {
      cache: "no-store",
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeout);
  }
}

function isReady(baseUrl: string): Promise<boolean> {
  const now = Date.now();
  const cached = readinessCache.get(baseUrl);

  if (cached && cached.expiresAt > now) {
    return cached.promise;
  }

  const entry: { promise: Promise<boolean>; expiresAt: number } = {
    promise: Promise.resolve(false),
    expiresAt: Number.POSITIVE_INFINITY,
  };
  entry.promise = checkReady(baseUrl).then((ready) => {
    entry.expiresAt = Date.now() + (ready ? 10_000 : 2_000);
    return ready;
  });

  readinessCache.set(baseUrl, entry);
  return entry.promise;
}
export async function fetchInterviewBackend(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  for (let i = 0; i < backendUrls.length; i++) {
    const baseUrl = backendUrls[i];

    if (!(await isReady(baseUrl))) continue;

    try {
      const response = await fetch(`${baseUrl}${path}`, init);
      if (
        method === "GET" &&
        [502, 503, 504].includes(response.status) &&
        i < backendUrls.length - 1
      ) {
        continue;
      }
      return response;
    } catch (error) {
      if (method !== "GET" || i === backendUrls.length - 1) {
        throw error;
      }
    }
  }
  throw new Error("No interview backend is currenty available");
}

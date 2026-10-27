const authBackendUrls = [
  process.env.NEXT_PUBLIC_BACKEND_API,
  process.env.NEXT_PUBLIC_AUTH_BACKUP_API,
]
  .filter((url): url is string => Boolean(url))
  .map((url) => url.replace(/\/+$/, ""));

export async function fetchAuthBackend(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  if (authBackendUrls.length === 0) {
    throw new Error("Authentication backend URLs are not configured.");
  }

  let lastResponse: Response | undefined;

  for (let i = 0; i < authBackendUrls.length; i++) {
    try {
      const response = await fetch(`${authBackendUrls[i]}${path}`, init);
      lastResponse = response;

      if (
        [502, 503, 504].includes(response.status) &&
        i < authBackendUrls.length - 1
      ) {
        continue;
      }

      return response;
    } catch (error) {
      if (i === authBackendUrls.length - 1) {
        throw error;
      }
    }
  }

  if (lastResponse) {
    return lastResponse;
  }

  throw new Error("No authentication backend is currently available.");
}

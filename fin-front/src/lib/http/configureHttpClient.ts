import type { HttpClient } from "./HttpClient";

let client: HttpClient | undefined;

/** Call once at bootstrap (e.g. main.tsx) before any code uses `getHttpClient`. */
export function configureHttpClient(next: HttpClient): void {
  client = next;
}

export function getHttpClient(): HttpClient {
  if (!client) {
    throw new Error(
      "HttpClient is not configured. Call configureHttpClient() from main.tsx before rendering."
    );
  }
  return client;
}

import crypto from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";

export type BrowserLoginResult = {
  token: string;
  email?: string;
  expiresAt?: string;
};

export type BrowserLoginSession = {
  loginUrl: string;
  waitForResult: Promise<BrowserLoginResult>;
  close: () => Promise<void>;
};

export function createCliLoginUrl({
  apiUrl,
  redirectUri,
  state,
}: {
  apiUrl: string;
  redirectUri: string;
  state: string;
}) {
  const url = new URL("/cli/login", apiUrl);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  return url.toString();
}

function html(message: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Varel CLI</title></head><body><main style="font-family: system-ui, sans-serif; max-width: 42rem; margin: 4rem auto;"><h1>${message}</h1><p>You can return to your terminal.</p></main></body></html>`;
}

function writeHtml(
  response: http.ServerResponse,
  statusCode: number,
  message: string,
) {
  response.writeHead(statusCode, { "content-type": "text/html; charset=utf-8" });
  response.end(html(message));
}

export async function startBrowserLogin({
  apiUrl,
  timeoutMs = 120_000,
}: {
  apiUrl: string;
  timeoutMs?: number;
}): Promise<BrowserLoginSession> {
  const state = crypto.randomBytes(24).toString("base64url");
  let settle:
    | {
        resolve: (result: BrowserLoginResult) => void;
        reject: (error: Error) => void;
      }
    | undefined;

  const waitForResult = new Promise<BrowserLoginResult>((resolve, reject) => {
    settle = { resolve, reject };
  });

  const server = http.createServer((request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");

    if (requestUrl.pathname !== "/callback") {
      writeHtml(response, 404, "Unknown Varel CLI callback");
      return;
    }

    if (requestUrl.searchParams.get("state") !== state) {
      writeHtml(response, 400, "Invalid Varel CLI login state");
      settle?.reject(new Error("CLI login returned an invalid state."));
      return;
    }

    const token = requestUrl.searchParams.get("token");

    if (!token) {
      writeHtml(response, 400, "Varel CLI login did not return a token");
      settle?.reject(new Error("CLI login did not return a token."));
      return;
    }

    writeHtml(response, 200, "Varel CLI login complete");
    settle?.resolve({
      token,
      email: requestUrl.searchParams.get("email") ?? undefined,
      expiresAt: requestUrl.searchParams.get("expires_at") ?? undefined,
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address() as AddressInfo;
  const redirectUri = `http://127.0.0.1:${address.port}/callback`;
  const timeout = setTimeout(() => {
    settle?.reject(new Error("Timed out waiting for browser login."));
    void closeServer(server);
  }, timeoutMs);

  waitForResult.finally(() => clearTimeout(timeout)).catch(() => undefined);

  return {
    loginUrl: createCliLoginUrl({ apiUrl, redirectUri, state }),
    waitForResult,
    close: () => closeServer(server),
  };
}

function closeServer(server: http.Server) {
  return new Promise<void>((resolve, reject) => {
    if (!server.listening) {
      resolve();
      return;
    }

    server.close((error) => (error ? reject(error) : resolve()));
  });
}

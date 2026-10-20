import { expect, test } from "@playwright/test";
import { createServer, type Server } from "node:http";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";

// Isolated HTTP stub, NOT Django. Exercises the actual Next cookie proxy,
// including binary uploads and refresh replay without database mutations.
test.describe.configure({ mode: "serial" });
let upstream: Server;
let frontend: ChildProcess;
let origin: string;
const received: { path: string; method: string; auth: string; body: Buffer }[] =
  [];

test.beforeAll(async () => {
  upstream = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const body = Buffer.concat(chunks);
    const path = req.url ?? "";
    const auth = req.headers.authorization ?? "";
    received.push({ path, auth, body, method: req.method ?? "" });
    res.setHeader("Content-Type", "application/json");
    if (path === "/api/v1/auth/token/refresh/") {
      res.end(
        JSON.stringify({
          access: "fresh-test-token",
          refresh: "rotated-test-refresh",
        }),
      );
    } else if (auth === "Bearer expired-test-token") {
      res.statusCode = 401;
      res.end(JSON.stringify({ detail: "Token expired" }));
    } else if (
      req.method === "OPTIONS" &&
      path === "/api/v1/catalog/stock/movements/"
    ) {
      res.statusCode = auth === "Bearer staff-test-token" ? 200 : 403;
      res.end(JSON.stringify({ name: "Stock movements" }));
    } else if (
      path === "/api/v1/catalog/product-image" &&
      req.method === "POST"
    ) {
      res.statusCode = 201;
      res.end(JSON.stringify({ id: 87 }));
    } else {
      res.statusCode = 404;
      res.end(JSON.stringify({ detail: "Test endpoint not found" }));
    }
  });
  upstream.listen(0, "127.0.0.1");
  await once(upstream, "listening");
  const upstreamPort = (upstream.address() as { port: number }).port;
  const reserve = createServer();
  reserve.listen(0, "127.0.0.1");
  await once(reserve, "listening");
  const port = (reserve.address() as { port: number }).port;
  await new Promise<void>((resolve) => reserve.close(() => resolve()));
  origin = `http://127.0.0.1:${port}`;
  frontend = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    {
      env: {
        ...process.env,
        DJANGO_API_ORIGIN: `http://127.0.0.1:${upstreamPort}`,
        SIFAT_CATALOG_SOURCE: "demo",
        SIFAT_ADMIN_SOURCE: "demo",
      },
      stdio: "ignore",
    },
  );
  await expect
    .poll(
      async () => {
        try {
          return (await fetch(`${origin}/api/backend/v1/auth/me`)).status;
        } catch {
          return 0;
        }
      },
      { timeout: 20_000 },
    )
    .toBe(401);
});
test.afterAll(async () => {
  if (frontend && frontend.exitCode === null) {
    const exited = once(frontend, "exit");
    frontend.kill("SIGTERM");
    await exited;
  }
  if (upstream) {
    upstream.closeAllConnections();
    await new Promise<void>((resolve) => upstream.close(() => resolve()));
  }
});
test.beforeEach(() => {
  received.length = 0;
});

test("guest me stays local and OPTIONS forwards the real backend staff verdict", async ({
  request,
}) => {
  const guest = await request.get(`${origin}/api/backend/v1/auth/me`);
  expect(guest.status()).toBe(401);
  expect(received).toHaveLength(0);
  const denied = await request.fetch(
    `${origin}/api/backend/v1/catalog/stock/movements`,
    {
      method: "OPTIONS",
      headers: { cookie: "sifat_access=customer-test-token" },
    },
  );
  expect(denied.status()).toBe(403);
  const staff = await request.fetch(
    `${origin}/api/backend/v1/catalog/stock/movements`,
    { method: "OPTIONS", headers: { cookie: "sifat_access=staff-test-token" } },
  );
  expect(staff.status()).toBe(200);
  expect(
    received.every(
      (entry) =>
        entry.path === "/api/v1/catalog/stock/movements/" &&
        entry.method === "OPTIONS",
    ),
  ).toBe(true);
});

test("multipart bytes survive upload and JWT refresh replay on the exact slashless image URL", async ({
  request,
}) => {
  const binary = Buffer.concat([
    Buffer.from(
      '--sifat-test\r\nContent-Disposition: form-data; name="image"; filename="test.webp"\r\nContent-Type: image/webp\r\n\r\n',
    ),
    Buffer.from([0, 255, 128, 13, 10, 17]),
    Buffer.from("\r\n--sifat-test--\r\n"),
  ]);
  const response = await request.post(
    `${origin}/api/backend/v1/catalog/product-image`,
    {
      headers: {
        cookie:
          "sifat_access=expired-test-token; sifat_refresh=refresh-test-token",
        "content-type": "multipart/form-data; boundary=sifat-test",
      },
      data: binary,
    },
  );
  expect(response.status()).toBe(201);
  const uploads = received.filter(
    (entry) => entry.path === "/api/v1/catalog/product-image",
  );
  expect(uploads).toHaveLength(2);
  expect(uploads.every((entry) => entry.body.equals(binary))).toBe(true);
  expect(uploads.map((entry) => entry.auth)).toEqual([
    "Bearer expired-test-token",
    "Bearer fresh-test-token",
  ]);
  const cookie = response.headers()["set-cookie"];
  expect(cookie).toContain("HttpOnly");
  expect(cookie).toContain("fresh-test-token");
});

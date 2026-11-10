import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer } from "../server/index.mjs";

async function fixture(options, fn) {
  const dataDir = await mkdtemp(path.join(tmpdir(), "wps-auth-"));
  const server = createServer({ dataDir, ...options });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = (action, data, cookie, extra = {}) =>
    fetch(base + "/api/auth/" + action, {
      method: action === "me" ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: base,
        ...(cookie ? { Cookie: cookie } : {}),
        ...extra,
      },
      ...(action === "me" ? {} : { body: JSON.stringify(data || {}) }),
    });
  try {
    await fn({ call, dataDir, base });
  } finally {
    await new Promise((r) => server.close(r));
    await rm(dataDir, { recursive: true, force: true });
  }
}
const credentials = {
  email: "Test@example.test",
  password: "Длинная тестовая фраза 2026",
};
const cookieOf = (r) => r.headers.get("set-cookie").split(";")[0];

test("API отклоняет поддельный сеанс, неверный JSON, большой запрос и метод", async () =>
  fixture({}, async ({ call, base }) => {
    assert.equal(
      (await call("me", null, "wps_session=" + "a".repeat(64))).status,
      401,
    );
    assert.equal((await fetch(base + "/api/auth/login")).status, 405);
    assert.equal((await call("unknown")).status, 404);
    for (const [body, status] of [
      ["{", 400],
      ["null", 400],
      [JSON.stringify({ padding: "x".repeat(9000) }), 413],
    ]) {
      const r = await fetch(base + "/api/auth/register", {
        method: "POST",
        headers: { Origin: base, "Content-Type": "application/json" },
        body,
      });
      assert.equal(r.status, status);
    }
  }));

test("Одновременная регистрация email создаёт только одну запись", async () =>
  fixture({}, async ({ call, dataDir }) => {
    const responses = await Promise.all([
      call("register", credentials),
      call("register", credentials),
    ]);
    assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409]);
    assert.equal(
      JSON.parse(await readFile(path.join(dataDir, "users.json"), "utf8"))
        .length,
      1,
    );
  }));

test("Регистрация, защищённый профиль, выход, вход и отзыв старой сессии", async () =>
  fixture({}, async ({ call, dataDir }) => {
    assert.equal((await call("me")).status, 401);
    const created = await call("register", credentials);
    assert.equal(created.status, 201);
    const cookie = cookieOf(created);
    assert.match(
      created.headers.get("set-cookie"),
      /HttpOnly; SameSite=Strict/,
    );
    assert.equal(created.headers.get("cache-control"), "no-store");
    const profile = (await created.json()).user;
    assert.deepEqual(Object.keys(profile).sort(), ["email", "id"]);
    assert.equal(profile.email, "test@example.test");
    assert.equal((await call("me", null, cookie)).status, 200);
    const stored = await readFile(path.join(dataDir, "users.json"), "utf8");
    assert.ok(!stored.includes(credentials.password));
    assert.ok(!stored.includes(cookie.slice(12)));
    const record = JSON.parse(stored)[0];
    assert.equal(record.password.algorithm, "scrypt");
    assert.equal(record.password.N, 131072);
    assert.equal(record.password.salt.length, 32);
    assert.equal(record.password.hash.length, 128);
    assert.equal(
      (
        await call("login", {
          ...credentials,
          password: "Неверная длинная фраза",
        })
      ).status,
      401,
    );
    assert.equal(
      (await call("login", { ...credentials, email: "absent@example.test" }))
        .status,
      401,
    );
    const login = await call("login", credentials, cookie);
    assert.equal(login.status, 200);
    const next = cookieOf(login);
    assert.notEqual(cookie, next);
    assert.equal((await call("me", null, cookie)).status, 401);
    assert.equal((await call("logout", {}, next)).status, 200);
    assert.equal((await call("me", null, next)).status, 401);
    assert.equal((await call("register", credentials)).status, 409);
  }));

test("Валидация, Origin, ограничения и истечение сессии", async () => {
  let time = Date.now();
  await fixture(
    { now: () => time, sessionMs: 1000, rateLimit: 4 },
    async ({ call }) => {
      assert.equal(
        (
          await call("register", credentials, null, {
            Origin: "https://evil.example",
          })
        ).status,
        403,
      );
      assert.equal(
        (await call("register", { ...credentials, password: "short" })).status,
        400,
      );
      assert.equal(
        (
          await call("register", credentials, null, {
            "Content-Type": "text/plain",
          })
        ).status,
        415,
      );
      const response = await call("register", credentials);
      assert.equal(response.status, 201);
      const cookie = cookieOf(response);
      time += 1001;
      assert.equal((await call("me", null, cookie)).status, 401);
      assert.equal(
        (await call("register", { ...credentials, email: "bad" })).status,
        400,
      );
      assert.equal((await call("login", credentials)).status, 429);
      time += 15 * 60 * 1000;
      assert.equal((await call("login", credentials)).status, 200);
    },
  );
});

test("HTTPS cookie и разные соли для одинаковых паролей", async () =>
  fixture({ origin: "https://editor.example" }, async ({ call, dataDir }) => {
    for (const email of ["one@example.test", "two@example.test"]) {
      const r = await call("register", { ...credentials, email }, null, {
        Origin: "https://editor.example",
      });
      assert.equal(r.status, 201);
      assert.match(r.headers.get("set-cookie"), /; Secure/);
    }
    const records = JSON.parse(
      await readFile(path.join(dataDir, "users.json"), "utf8"),
    );
    assert.notEqual(records[0].password.salt, records[1].password.salt);
    assert.notEqual(records[0].password.hash, records[1].password.hash);
  }));

test("Хранилище переживает перезапуск, а сеансы отзываются", async () =>
  fixture({}, async ({ call, dataDir }) => {
    const registered = await call("register", credentials),
      cookie = cookieOf(registered);
    const other = createServer({ dataDir });
    await new Promise((r) => other.listen(0, "127.0.0.1", r));
    try {
      const base = `http://127.0.0.1:${other.address().port}`;
      assert.equal(
        (await fetch(base + "/api/auth/me", { headers: { Cookie: cookie } }))
          .status,
        401,
      );
      assert.equal(
        (
          await fetch(base + "/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json", Origin: base },
            body: JSON.stringify(credentials),
          })
        ).status,
        200,
      );
    } finally {
      await new Promise((r) => other.close(r));
    }
  }));

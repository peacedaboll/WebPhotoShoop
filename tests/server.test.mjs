import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "../server/index.mjs";
test("Сервер отдаёт приложение и API, ограничивает методы и пути", async () => {
  const server = createServer();
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const page = await fetch(base);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /<html lang="ru">/);
    assert.match(page.headers.get("content-type"), /text\/html/);
    const health = await fetch(base + "/api/health");
    assert.deepEqual(await health.json(), { status: "ok", version: "0.1.0" });
    const cap = await fetch(base + "/api/capabilities");
    assert.equal((await cap.json()).maxLayers, 12);
    assert.equal((await fetch(base + "/", { method: "POST" })).status, 405);
    assert.equal((await fetch(base + "/missing.txt")).status, 404);
    assert.equal((await fetch(base + "/%2e%2e%5cpackage.json")).status, 403);
    const head = await fetch(base, { method: "HEAD" });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), "");
  } finally {
    await new Promise((r) => server.close(r));
  }
});

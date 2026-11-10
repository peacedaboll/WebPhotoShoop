import {
  randomBytes,
  randomUUID,
  scrypt as derive,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
const scrypt = promisify(derive);
const cost = { N: 131072, r: 8, p: 1, maxmem: 160 * 1024 * 1024 };
const digest = (s) => createHash("sha256").update(s).digest("hex");
const fail = (status, message) => Object.assign(new Error(message), { status });

export function createAuth({
  dataDir = process.env.DATA_DIR || path.resolve("data"),
  origin = process.env.APP_ORIGIN,
  now = Date.now,
  sessionMs = 8 * 60 * 60 * 1000,
  rateLimit = 20,
} = {}) {
  const file = path.join(dataDir, "users.json"),
    sessions = new Map(),
    attempts = new Map();
  let queue = Promise.resolve(),
    activeHashes = 0;
  const locked = (fn) => {
    const result = queue.then(fn);
    queue = result.catch(() => {});
    return result;
  };
  async function users() {
    try {
      const result = JSON.parse(await readFile(file, "utf8"));
      if (!Array.isArray(result)) throw Error();
      return result;
    } catch (e) {
      if (e.code === "ENOENT") return [];
      throw fail(503, "Хранилище учётных записей недоступно.");
    }
  }
  async function hash(password, salt) {
    if (activeHashes >= 2)
      throw fail(503, "Сервер занят. Повторите попытку позже.");
    activeHashes++;
    try {
      return await scrypt(password, salt, 64, cost);
    } finally {
      activeHashes--;
    }
  }
  const tokenOf = (req) =>
    /(?:^|;\s*)wps_session=([a-f0-9]{64})(?:;|$)/.exec(
      req.headers.cookie || "",
    )?.[1];
  function prune() {
    for (const [k, v] of sessions) if (v.expires <= now()) sessions.delete(k);
    for (const [k, v] of attempts) if (v.until <= now()) attempts.delete(k);
  }
  function cookie(res, token, secure, age = sessionMs / 1000) {
    res.setHeader(
      "Set-Cookie",
      `wps_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(age)}${secure ? "; Secure" : ""}`,
    );
  }
  function issue(req, res, user, secure) {
    if (sessions.size >= 10000)
      throw fail(503, "Сервер занят. Повторите попытку позже.");
    const old = tokenOf(req);
    if (old) sessions.delete(digest(old));
    const token = randomBytes(32).toString("hex"),
      profile = { id: user.id, email: user.email };
    sessions.set(digest(token), { profile, expires: now() + sessionMs });
    cookie(res, token, secure);
    return profile;
  }
  async function body(req) {
    if (!(req.headers["content-type"] || "").startsWith("application/json"))
      throw fail(415, "Отправьте JSON.");
    const chunks = [];
    let size = 0;
    await new Promise((resolve, reject) => {
      req.on("data", (chunk) => {
        size += chunk.length;
        if (size > 8192) {
          chunks.length = 0;
          reject(fail(413, "Запрос слишком большой."));
        } else chunks.push(chunk);
      });
      req.on("end", resolve);
      req.on("error", reject);
      req.on("aborted", () => reject(fail(400, "Запрос прерван.")));
    });
    try {
      const result = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if (!result || typeof result !== "object" || Array.isArray(result))
        throw Error();
      return result;
    } catch {
      throw fail(400, "Некорректный JSON.");
    }
  }
  return async function auth(req, res, url) {
    if (!url.pathname.startsWith("/api/auth/")) return false;
    res.setHeader("Cache-Control", "no-store");
    prune();
    const send = (status, value) =>
      res
        .writeHead(status, {
          "Content-Type": "application/json; charset=utf-8",
        })
        .end(JSON.stringify(value));
    try {
      const action = url.pathname.slice(10);
      if (!["me", "login", "register", "logout"].includes(action))
        throw fail(404, "Метод API не найден.");
      if (req.method !== (action === "me" ? "GET" : "POST")) {
        res.setHeader("Allow", action === "me" ? "GET" : "POST");
        throw fail(405, "Метод не поддерживается.");
      }
      if (action === "me") {
        const token = tokenOf(req),
          session = token && sessions.get(digest(token));
        if (!session) throw fail(401, "Войдите в учётную запись.");
        send(200, { user: session.profile });
        return true;
      }
      const expected = origin || `http://${req.headers.host}`;
      if (req.headers.origin !== expected)
        throw fail(403, "Источник запроса не разрешён.");
      const secure = new URL(expected).protocol === "https:";
      if (action === "logout") {
        const token = tokenOf(req);
        if (token) sessions.delete(digest(token));
        cookie(res, "", secure, 0);
        send(200, { ok: true });
        return true;
      }
      const ip = req.socket.remoteAddress || "unknown";
      const limit = attempts.get(ip) || {
        count: 0,
        until: now() + 15 * 60 * 1000,
      };
      if (
        limit.count >= rateLimit ||
        (attempts.size >= 10000 && !attempts.has(ip))
      ) {
        res.setHeader("Retry-After", "900");
        throw fail(429, "Слишком много попыток. Повторите через 15 минут.");
      }
      limit.count++;
      attempts.set(ip, limit);
      const value = await body(req);
      const email =
        typeof value.email === "string" ? value.email.trim().toLowerCase() : "";
      const password = value.password;
      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        email.length > 254 ||
        typeof password !== "string" ||
        password.length < 15 ||
        password.length > 128 ||
        Buffer.byteLength(password) > 512
      )
        throw fail(400, "Введите email и пароль длиной от 15 до 128 символов.");
      if (action === "register") {
        const salt = randomBytes(16).toString("hex"),
          derived = (await hash(password, salt)).toString("hex");
        const user = await locked(async () => {
          const list = await users();
          if (list.some((u) => u.email === email))
            throw fail(
              409,
              "Не удалось создать учётную запись с этим email. Попробуйте войти.",
            );
          if (list.length >= 10000)
            throw fail(503, "Регистрация временно недоступна.");
          const u = {
            id: randomUUID(),
            email,
            password: {
              algorithm: "scrypt",
              N: cost.N,
              r: cost.r,
              p: cost.p,
              salt,
              hash: derived,
            },
          };
          await mkdir(dataDir, { recursive: true, mode: 0o700 });
          const temp = file + ".tmp";
          await writeFile(temp, JSON.stringify([...list, u]), { mode: 0o600 });
          await rename(temp, file);
          return u;
        });
        send(201, { user: issue(req, res, user, secure) });
      } else {
        const list = await users(),
          user = list.find((u) => u.email === email);
        const actual = await hash(
          password,
          user?.password.salt || "00000000000000000000000000000000",
        );
        const expectedHash = Buffer.from(
          user?.password.hash || "00".repeat(64),
          "hex",
        );
        if (
          !user ||
          expectedHash.length !== actual.length ||
          !timingSafeEqual(expectedHash, actual)
        )
          throw fail(401, "Неверный email или пароль.");
        send(200, { user: issue(req, res, user, secure) });
      }
    } catch (e) {
      send(e.status || 503, {
        error: e.status ? e.message : "Сервис временно недоступен.",
      });
    }
    return true;
  };
}

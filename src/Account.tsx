import { FormEvent, useEffect, useRef, useState } from "react";
type User = { id: string; email: string };
export function Account() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [user, setUser] = useState<User | null>(null);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    fetch("/api/auth/me")
      .then(async (r) => {
        if (r.ok) setUser((await r.json()).user);
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      data = new FormData(form);
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.get("email"),
          password: data.get("password"),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Не удалось войти.");
      setUser(result.user);
      form.reset();
      dialog.current?.close();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Сервер недоступен.");
    } finally {
      setPending(false);
    }
  }
  async function logout() {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok)
        throw Error("Не удалось завершить сеанс. Повторите выход.");
      setUser(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Сервер недоступен.");
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="account">
      {user ? (
        <>
          <span className="account-email" title={user.email}>
            {user.email}
          </span>
          <button disabled={pending} onClick={logout}>
            Выйти
          </button>
        </>
      ) : (
        <button
          disabled={checking}
          onClick={() => {
            setError("");
            dialog.current?.showModal();
          }}
        >
          Войти
        </button>
      )}
      {error && user && <span role="alert">{error}</span>}
      <dialog
        ref={dialog}
        aria-labelledby="account-title"
        className="account-dialog"
        onClose={() => {
          setError("");
          dialog.current?.querySelector("form")?.reset();
        }}
        onCancel={(e) => {
          if (pending) e.preventDefault();
        }}
      >
        <div className="modal-heading">
          <h2 id="account-title">
            {mode === "login" ? "С возвращением" : "Создать учётную запись"}
          </h2>
          <button
            aria-label="Закрыть вход"
            disabled={pending}
            onClick={() => dialog.current?.close()}
          >
            ×
          </button>
        </div>
        <p>
          Редактируйте без входа. Учётная запись создаёт личный сеанс;
          фотографии остаются на устройстве.
        </p>
        <form onSubmit={submit}>
          <label>
            Email
            <input
              name="email"
              type="email"
              maxLength={254}
              required
              autoComplete="username"
              autoFocus
              disabled={pending}
            />
          </label>
          <label>
            Пароль
            <input
              name="password"
              type="password"
              minLength={15}
              maxLength={128}
              required
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              disabled={pending}
            />
          </label>
          <small>
            От 15 до 128 символов. Подойдёт длинная парольная фраза.
          </small>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button className="primary" disabled={pending} type="submit">
            {pending
              ? "Проверяем…"
              : mode === "login"
                ? "Войти"
                : "Зарегистрироваться"}
          </button>
          <button
            disabled={pending}
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError("");
              dialog.current?.querySelector("form")?.reset();
            }}
          >
            {mode === "login"
              ? "Создать учётную запись"
              : "Уже есть учётная запись"}
          </button>
        </form>
      </dialog>
    </div>
  );
}

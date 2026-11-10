import { useEffect, useRef, useState, PointerEvent as PE } from "react";
import {
  EditorDocument,
  History,
  Snapshot,
  MAX_PIXELS,
  copyCanvas,
} from "./core/EditorDocument";
import { adjustPixels } from "./core/filters";
import { applyPreset, presets } from "./core/presets";
import { Account } from "./Account";
type Tool = "move" | "brush" | "eraser" | "text" | "crop";
const tools: { id: Tool; icon: string; name: string; key: string }[] = [
  { id: "move", icon: "↖", name: "Просмотр", key: "V" },
  { id: "brush", icon: "✎", name: "Кисть", key: "B" },
  { id: "eraser", icon: "▱", name: "Ластик", key: "E" },
  { id: "text", icon: "T", name: "Текст", key: "T" },
  { id: "crop", icon: "⌗", name: "Обрезка", key: "C" },
];
export default function App() {
  const doc = useRef<EditorDocument | null>(null),
    history = useRef(new History<Snapshot>(8)),
    canvas = useRef<HTMLCanvasElement>(null),
    input = useRef<HTMLInputElement>(null);
  const [revision, bump] = useState(0),
    [tool, setTool] = useState<Tool>("move"),
    [color, setColor] = useState("#c6fa68"),
    [size, setSize] = useState(24),
    [zoom, setZoom] = useState(60),
    [message, setMessage] = useState("Готово к работе"),
    [busy, setBusy] = useState(false),
    [modal, setModal] = useState<"new" | "export" | "adjust" | null>(null),
    [title, setTitle] = useState("Без названия"),
    [text, setText] = useState("Новый взгляд"),
    [format, setFormat] = useState("image/png"),
    [quality, setQuality] = useState(92),
    [brightness, setBrightness] = useState(0),
    [contrast, setContrast] = useState(0),
    [saturation, setSaturation] = useState(100),
    [tab, setTab] = useState("layers"),
    [dimensions, setDimensions] = useState({ w: 1200, h: 800 }),
    [cropBox, setCropBox] = useState({ x: 100, y: 100, w: 800, h: 500 });
  const [error, setError] = useState("");
  const drawing = useRef(false),
    last = useRef({ x: 0, y: 0 }),
    edited = useRef(false);
  const refresh = () => {
    if (doc.current && canvas.current) doc.current.render(canvas.current);
    bump((n) => n + 1);
  };
  const commit = (label: string) => {
    history.current.push(doc.current!.snapshot(label));
    history.current.trim(
      Math.floor(
        128_000_000 /
          (doc.current!.width *
            doc.current!.height *
            doc.current!.layers.length *
            4),
      ),
    );
    edited.current = true;
    refresh();
    setMessage(label);
  };
  const safe = (action: () => void) => {
    try {
      action();
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : "Действие не выполнено. Повторите попытку.";
      setMessage(msg);
      setError(msg);
    }
  };
  useEffect(() => {
    doc.current = new EditorDocument();
    history.current.clear();
    history.current.push(doc.current.snapshot("Холст создан"));
    refresh();
  }, []);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (edited.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);
  const undo = () =>
    safe(() => {
      const s = history.current.undo();
      if (s) {
        doc.current!.restore(s);
        edited.current = true;
        refresh();
        setMessage("Действие отменено");
      }
    });
  const redo = () =>
    safe(() => {
      const s = history.current.redo();
      if (s) {
        doc.current!.restore(s);
        edited.current = true;
        refresh();
        setMessage("Действие повторено");
      }
    });
  useEffect(() => {
    const keys = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement).matches("input,textarea,select") ||
        modal ||
        document.querySelector("dialog[open]")
      )
        return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
        return;
      }
      if (e.ctrlKey || e.metaKey) return;
      const t = tools.find((t) => t.key.toLowerCase() === e.key.toLowerCase());
      if (t) setTool(t.id);
    };
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  });
  const download = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const load = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setMessage("Открываем изображение…");
    try {
      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
        throw new Error("Выберите PNG, JPEG или WebP.");
      if (file.size > 20 * 1024 * 1024)
        throw new Error("Файл слишком большой. Допустимо до 20 МБ.");
      const bitmap = await createImageBitmap(file);
      try {
        if (bitmap.width * bitmap.height > MAX_PIXELS)
          throw new Error(
            "Изображение превышает 8 миллионов пикселей. Уменьшите его перед загрузкой.",
          );
        const next = new EditorDocument(bitmap.width, bitmap.height);
        next.active.name = "Исходное изображение";
        next.active.canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
        doc.current = next;
        history.current.clear();
        history.current.push(next.snapshot("Изображение открыто"));
        setTitle(file.name.replace(/\.[^.]+$/, ""));
        setZoom(Math.min(80, Math.round((640 / bitmap.width) * 100)));
        edited.current = false;
        refresh();
        setMessage(
          "Изображение открыто. Оригинал остаётся на вашем устройстве.",
        );
      } finally {
        bitmap.close();
      }
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "Не удалось прочитать изображение. Возможно, файл повреждён.",
      );
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };
  const demo = () =>
    safe(() => {
      const d = new EditorDocument(1200, 800),
        x = d.active.canvas.getContext("2d")!,
        g = x.createLinearGradient(0, 0, 1000, 800);
      g.addColorStop(0, "#d9bd9b");
      g.addColorStop(0.55, "#9b6746");
      g.addColorStop(1, "#362f30");
      x.fillStyle = g;
      x.fillRect(0, 0, 1200, 800);
      x.fillStyle = "#e8d6bd";
      x.beginPath();
      x.ellipse(570, 290, 260, 360, -0.3, 0, Math.PI * 2);
      x.fill();
      x.fillStyle = "#567260";
      x.beginPath();
      x.moveTo(0, 800);
      x.lineTo(300, 400);
      x.lineTo(550, 800);
      x.fill();
      x.fillStyle = "#293c36";
      x.beginPath();
      x.moveTo(280, 800);
      x.lineTo(810, 260);
      x.lineTo(1200, 800);
      x.fill();
      x.fillStyle = "#b58f6b";
      x.beginPath();
      x.moveTo(620, 800);
      x.lineTo(1030, 460);
      x.lineTo(1200, 800);
      x.fill();
      x.fillStyle = "#f3dfb0";
      x.beginPath();
      x.arc(880, 170, 72, 0, Math.PI * 2);
      x.fill();
      d.active.name = "Пейзаж";
      const l = d.addLayer("Надпись");
      const ctx = l.canvas.getContext("2d")!;
      ctx.fillStyle = "#fff8ed";
      ctx.font = "bold 92px Georgia";
      ctx.fillText("Тише. Ближе.", 82, 180);
      ctx.font = "22px Arial";
      ctx.fillText("КОЛЛЕКЦИЯ МОМЕНТОВ  /  2026", 86, 230);
      doc.current = d;
      history.current.clear();
      history.current.push(d.snapshot("Демо открыто"));
      setTitle("Тёплый горизонт");
      edited.current = false;
      refresh();
    });
  const point = (e: PE<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) * doc.current!.width) / r.width,
      y: ((e.clientY - r.top) * doc.current!.height) / r.height,
    };
  };
  const stroke = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const ctx = doc.current!.active.canvas.getContext("2d")!;
    ctx.globalCompositeOperation =
      tool === "eraser" ? "destination-out" : "source-over";
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x + 0.01, b.y + 0.01);
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
    doc.current!.render(canvas.current!);
  };
  const down = (e: PE<HTMLCanvasElement>) =>
    safe(() => {
      if (busy || !doc.current) return;
      if (!doc.current.active.visible)
        throw new Error("Слой скрыт. Включите видимость, чтобы рисовать.");
      const p = point(e);
      if (tool === "text") {
        const x = doc.current.active.canvas.getContext("2d")!;
        x.fillStyle = color;
        x.font = `bold ${size * 3}px Arial`;
        x.fillText(text.slice(0, 200), p.x, p.y);
        commit("Текст добавлен");
      }
      if (tool === "brush" || tool === "eraser") {
        drawing.current = true;
        last.current = p;
        e.currentTarget.setPointerCapture(e.pointerId);
        stroke(p, p);
      }
    });
  const finish = () => {
    if (drawing.current) {
      drawing.current = false;
      commit(tool === "eraser" ? "Ластик применён" : "Мазок кисти");
    }
  };
  const exportImage = async () => {
    setBusy(true);
    setMessage("Подготавливаем файл…");
    try {
      await new Promise((r) => setTimeout(r, 30));
      const c = document.createElement("canvas");
      doc.current!.render(c);
      if (format === "image/jpeg") {
        const ctx = c.getContext("2d")!;
        ctx.globalCompositeOperation = "destination-over";
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, c.width, c.height);
      }
      const blob = await new Promise<Blob>((resolve, reject) =>
        c.toBlob(
          (b) =>
            b ? resolve(b) : reject(new Error("Не удалось подготовить файл.")),
          format,
          quality / 100,
        ),
      );
      if (blob.type !== format)
        throw new Error(
          "Браузер не поддерживает выбранный формат. Выберите PNG.",
        );
      download(
        blob,
        `${title.replace(/[<>:"/\\|?*]/g, "_")}.${format === "image/jpeg" ? "jpg" : format.split("/")[1]}`,
      );
      setMessage("Файл подготовлен для скачивания");
      setModal(null);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Экспорт не выполнен.");
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    setError("");
    if (!modal) return;
    const panel = document.querySelector<HTMLElement>(".modal");
    const focusable = () =>
      Array.from(
        panel?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input:not(:disabled),select:not(:disabled)",
        ) ?? [],
      );
    focusable()[0]?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const nodes = focusable(),
        first = nodes[0],
        last = nodes.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => document.removeEventListener("keydown", trap);
  }, [modal]);
  const d = doc.current;
  return (
    <div className="app" data-revision={revision}>
      <header>
        <a className="brand" href="/" aria-label="WebPhotoShoop">
          W<span>✳</span>
        </a>
        <div className="project-name">
          <strong>{title}</strong>
          <span>
            Локальный проект <i /> v0.3
          </span>
        </div>
        <div className="header-actions">
          <Account />
          <button onClick={() => setModal("new")} disabled={busy}>
            Новый холст
          </button>
          <button onClick={() => input.current?.click()} disabled={busy}>
            Открыть файл
          </button>
          <button
            className="primary"
            onClick={() => setModal("export")}
            disabled={busy}
          >
            Экспорт <span>↗</span>
          </button>
        </div>
      </header>
      <div className="options">
        <div>
          <span className="eyebrow">ИНСТРУМЕНТ</span>{" "}
          <strong>{tools.find((t) => t.id === tool)?.name}</strong>
        </div>
        <label>
          Размер{" "}
          <input
            aria-label="Размер инструмента"
            type="range"
            min="1"
            max="100"
            value={size}
            onChange={(e) => setSize(+e.target.value)}
          />
          <b>{size} px</b>
        </label>
        <label className="color-label">
          Цвет{" "}
          <input
            aria-label="Цвет"
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
          />
        </label>
        {tool === "text" && (
          <input
            aria-label="Текст надписи"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={200}
          />
        )}
        <div className="history-buttons">
          <button
            aria-label="Отменить"
            title="Ctrl+Z"
            disabled={!history.current.canUndo || busy}
            onClick={undo}
          >
            ↶
          </button>
          <button
            aria-label="Повторить"
            title="Ctrl+Shift+Z"
            disabled={!history.current.canRedo || busy}
            onClick={redo}
          >
            ↷
          </button>
        </div>
      </div>
      <div className="workspace">
        <nav className="toolbar" aria-label="Инструменты">
          {tools.map((t) => (
            <button
              aria-label={t.name}
              title={`${t.name} (${t.key})`}
              className={tool === t.id ? "active" : ""}
              onClick={() => setTool(t.id)}
              key={t.id}
            >
              {t.icon}
            </button>
          ))}
          <div className="divider" />
          <button
            aria-label="Повернуть на 90 градусов"
            title="Повернуть холст"
            disabled={busy}
            onClick={() =>
              safe(() => {
                d!.rotate();
                commit("Холст повёрнут");
              })
            }
          >
            ⟳
          </button>
          <button
            aria-label="Коррекция"
            title="Яркость и цвет"
            disabled={busy}
            onClick={() => {
              setBrightness(0);
              setContrast(0);
              setSaturation(100);
              setModal("adjust");
            }}
          >
            ☼
          </button>
          <span className="toolbar-end">0.3</span>
        </nav>
        <main
          className="stage"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (!busy) void load(e.dataTransfer.files[0]);
          }}
        >
          <div className="stage-top">
            <span>
              {title} <span className="muted">/ RGB · 8 бит</span>
            </span>
            <button onClick={demo} disabled={busy}>
              Открыть демо ↗
            </button>
          </div>
          <div className="canvas-scroll">
            <canvas
              ref={canvas}
              style={{
                width: d ? (d.width * zoom) / 100 : 720,
                height: d ? (d.height * zoom) / 100 : 480,
                cursor: tool === "move" ? "default" : "crosshair",
              }}
              onPointerDown={down}
              onPointerMove={(e) => {
                if (drawing.current) {
                  const p = point(e);
                  stroke(last.current, p);
                  last.current = p;
                }
              }}
              onPointerUp={finish}
              onPointerCancel={finish}
            />
            {history.current.entries.length === 1 &&
              title === "Без названия" && (
                <div className="welcome">
                  <span className="welcome-mark">✳</span>
                  <h1>Место для нового взгляда</h1>
                  <p>
                    Перетащите фотографию сюда
                    <br />
                    или начните с чистого холста
                  </p>
                  <button
                    className="primary"
                    onClick={() => input.current?.click()}
                    disabled={busy}
                  >
                    Открыть изображение
                  </button>
                  <button onClick={demo} disabled={busy}>
                    Попробовать на демо
                  </button>
                  <small>PNG, JPEG, WebP · до 20 МБ</small>
                </div>
              )}
          </div>
          <div className="stage-bottom">
            <span>
              {d?.width} × {d?.height} px
            </span>
            <label>
              Масштаб{" "}
              <select
                aria-label="Масштаб"
                value={zoom}
                onChange={(e) => setZoom(+e.target.value)}
              >
                {Array.from(new Set([25, 50, 60, 75, 100, 125, zoom]))
                  .sort((a, b) => a - b)
                  .map((z) => (
                    <option key={z} value={z}>
                      {z}%
                    </option>
                  ))}
              </select>
            </label>
          </div>
        </main>
        <aside>
          <div className="properties">
            <span className="eyebrow">ЦВЕТОВЫЕ ЭФФЕКТЫ</span>
            <p>Для активного слоя. Результат можно отменить.</p>
            <div className="preset-buttons">
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  disabled={busy}
                  onClick={() =>
                    safe(() => {
                      const ctx = d!.active.canvas.getContext("2d")!;
                      const pixels = ctx.getImageData(
                        0,
                        0,
                        d!.width,
                        d!.height,
                      );
                      applyPreset(pixels.data, preset.id);
                      ctx.putImageData(pixels, 0, 0);
                      commit(`Эффект: ${preset.name}`);
                    })
                  }
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>
          <div className="aside-title">
            <span>РАБОЧАЯ ОБЛАСТЬ</span>
            <span>◧</span>
          </div>
          <div className="tabs">
            <button
              className={tab === "layers" ? "selected" : ""}
              onClick={() => setTab("layers")}
            >
              Слои <small>{d?.layers.length ?? 1}</small>
            </button>
            <button
              className={tab === "history" ? "selected" : ""}
              onClick={() => setTab("history")}
            >
              История
            </button>
          </div>
          {tab === "layers" ? (
            <>
              <div className="layer-list">
                {d &&
                  [...d.layers].reverse().map((l) => (
                    <div
                      className={`layer ${l.id === d.activeId ? "selected" : ""}`}
                      key={l.id}
                    >
                      <button
                        aria-label={`Видимость ${l.name}`}
                        onClick={() =>
                          safe(() => {
                            l.visible = !l.visible;
                            commit("Видимость изменена");
                          })
                        }
                      >
                        {l.visible ? "◉" : "○"}
                      </button>
                      <button
                        className="layer-name"
                        onClick={() => {
                          d.activeId = l.id;
                          refresh();
                        }}
                      >
                        <span className="layer-thumb">▧</span>
                        <span>
                          {l.name}
                          <small>
                            {l.id === d.activeId
                              ? "Активный слой"
                              : "Растровый слой"}
                          </small>
                        </span>
                      </button>
                    </div>
                  ))}
              </div>
              <div className="layer-actions">
                <button
                  onClick={() =>
                    safe(() => {
                      d!.addLayer(`Слой ${d!.layers.length + 1}`);
                      commit("Слой добавлен");
                    })
                  }
                >
                  ＋ Добавить слой
                </button>
                <button
                  aria-label="Удалить слой"
                  onClick={() =>
                    safe(() => {
                      d!.removeLayer(d!.activeId);
                      commit("Слой удалён");
                    })
                  }
                >
                  ⌫
                </button>
              </div>
              <div className="properties">
                <span className="eyebrow">СВОЙСТВА СЛОЯ</span>
                <label>
                  Название{" "}
                  <input
                    aria-label="Название слоя"
                    key={d?.activeId}
                    defaultValue={d?.active.name ?? ""}
                    maxLength={60}
                    onBlur={(e) =>
                      safe(() => {
                        if (d && e.target.value.trim() !== d.active.name) {
                          d.active.name = e.target.value.trim() || "Слой";
                          commit("Слой переименован");
                        }
                      })
                    }
                  />
                </label>
                <label>
                  Непрозрачность{" "}
                  <output>{Math.round((d?.active.opacity ?? 1) * 100)}%</output>
                  <input
                    aria-label="Непрозрачность"
                    type="range"
                    min="0"
                    max="100"
                    value={(d?.active.opacity ?? 1) * 100}
                    onChange={(e) => {
                      if (d) {
                        d.active.opacity = +e.target.value / 100;
                        refresh();
                      }
                    }}
                    onPointerUp={() => commit("Непрозрачность изменена")}
                    onKeyUp={() => commit("Непрозрачность изменена")}
                  />
                </label>
                <div className="row">
                  <button
                    onClick={() =>
                      safe(() => {
                        d!.moveLayer(d!.activeId, 1);
                        commit("Порядок слоёв изменён");
                      })
                    }
                  >
                    ↑ Выше
                  </button>
                  <button
                    onClick={() =>
                      safe(() => {
                        d!.moveLayer(d!.activeId, -1);
                        commit("Порядок слоёв изменён");
                      })
                    }
                  >
                    ↓ Ниже
                  </button>
                </div>
              </div>
            </>
          ) : (
            <ol className="history-list">
              {history.current.entries.map((s, i) => (
                <li key={i}>
                  <span>↳</span>
                  {s.label}
                </li>
              ))}
            </ol>
          )}
          {tool === "crop" && (
            <div className="properties">
              <span className="eyebrow">ОБРЕЗКА В ПИКСЕЛЯХ</span>
              {(["x", "y", "w", "h"] as const).map((k) => (
                <label key={k}>
                  {{ x: "Слева", y: "Сверху", w: "Ширина", h: "Высота" }[k]}
                  <input
                    type="number"
                    value={cropBox[k]}
                    onChange={(e) =>
                      setCropBox({ ...cropBox, [k]: +e.target.value })
                    }
                  />
                </label>
              ))}
              <button
                className="primary"
                onClick={() =>
                  safe(() => {
                    d!.crop(cropBox.x, cropBox.y, cropBox.w, cropBox.h);
                    commit("Изображение обрезано");
                  })
                }
              >
                Применить обрезку
              </button>
            </div>
          )}
          <div className="tip">
            <span>✦</span>
            <strong>Ваш оригинал в безопасности</strong>
            <p>
              Редактирование происходит в браузере. Фотографии не отправляются
              на сервер.
            </p>
          </div>
        </aside>
      </div>
      <footer>
        <span role="status" aria-live="polite" className={busy ? "busy" : ""}>
          {busy ? "◌" : "●"} {message}
        </span>
        <span>
          WebPhotoShoop <span className="muted">/ учебная версия</span>
        </span>
      </footer>
      <input
        hidden
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(e) => void load(e.target.files?.[0])}
      />
      {modal && (
        <div
          className="overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) setModal(null);
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
            onKeyDown={(e) => {
              if (e.key === "Escape" && !busy) setModal(null);
            }}
          >
            <div className="modal-heading">
              <span className="eyebrow">WEBPHOTOSHOOP</span>
              <button
                aria-label="Закрыть"
                disabled={busy}
                onClick={() => setModal(null)}
              >
                ×
              </button>
            </div>
            <h2 id="dialog-title">
              {modal === "new"
                ? "Начнём с чистого холста"
                : modal === "export"
                  ? "Готово к публикации"
                  : "Свет и цвет"}
            </h2>
            {error && (
              <p role="alert" className="notice">
                {error}
              </p>
            )}
            {modal === "new" ? (
              <>
                <p>Выберите размер. Максимум — 8 миллионов пикселей.</p>
                <label>
                  Ширина, px
                  <input
                    autoFocus
                    type="number"
                    min="1"
                    value={dimensions.w}
                    onChange={(e) =>
                      setDimensions({ ...dimensions, w: +e.target.value })
                    }
                  />
                </label>
                <label>
                  Высота, px
                  <input
                    type="number"
                    min="1"
                    value={dimensions.h}
                    onChange={(e) =>
                      setDimensions({ ...dimensions, h: +e.target.value })
                    }
                  />
                </label>
                <p className="notice">
                  Создание нового холста заменит текущую работу. Сначала
                  экспортируйте нужный результат.
                </p>
                <button
                  className="primary wide"
                  onClick={() =>
                    safe(() => {
                      doc.current = new EditorDocument(
                        dimensions.w,
                        dimensions.h,
                      );
                      history.current.clear();
                      history.current.push(
                        doc.current.snapshot("Холст создан"),
                      );
                      setTitle("Без названия");
                      edited.current = false;
                      refresh();
                      setModal(null);
                    })
                  }
                >
                  Создать холст
                </button>
              </>
            ) : modal === "export" ? (
              <>
                <p>
                  Скачайте результат на устройство. Скрытые слои не попадут в
                  файл.
                </p>
                <label>
                  Имя файла
                  <input
                    autoFocus
                    value={title}
                    maxLength={100}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </label>
                <label>
                  Формат
                  <select
                    value={format}
                    onChange={(e) => setFormat(e.target.value)}
                  >
                    <option value="image/png">PNG — прозрачный фон</option>
                    <option value="image/jpeg">JPEG — белый фон</option>
                    <option value="image/webp">WebP — компактный файл</option>
                  </select>
                </label>
                <label>
                  Качество {quality}%
                  <input
                    disabled={format === "image/png"}
                    type="range"
                    min="10"
                    max="100"
                    value={quality}
                    onChange={(e) => setQuality(+e.target.value)}
                  />
                </label>
                <div className="export-meta">
                  {d?.width} × {d?.height} px ·{" "}
                  {d?.layers.filter((l) => l.visible).length} видимых слоёв
                </div>
                <button
                  className="primary wide"
                  disabled={busy}
                  onClick={() => void exportImage()}
                >
                  {busy ? "Подготавливаем…" : "Скачать изображение ↗"}
                </button>
              </>
            ) : (
              <>
                <p>
                  Коррекция применяется к активному слою. Изменение можно
                  отменить.
                </p>
                {[
                  {
                    name: "Яркость",
                    value: brightness,
                    set: setBrightness,
                    min: -100,
                    max: 100,
                  },
                  {
                    name: "Контраст",
                    value: contrast,
                    set: setContrast,
                    min: -100,
                    max: 100,
                  },
                  {
                    name: "Насыщенность",
                    value: saturation,
                    set: setSaturation,
                    min: 0,
                    max: 200,
                  },
                ].map((s) => (
                  <label key={s.name}>
                    {s.name} <output>{s.value}</output>
                    <input
                      type="range"
                      min={s.min}
                      max={s.max}
                      value={s.value}
                      onChange={(e) => s.set(+e.target.value)}
                    />
                  </label>
                ))}
                <button
                  className="primary wide"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setMessage("Применяем коррекцию…");
                    await new Promise((r) => setTimeout(r, 30));
                    safe(() => {
                      const c = copyCanvas(d!.active.canvas),
                        x = c.getContext("2d")!,
                        pixels = x.getImageData(0, 0, c.width, c.height);
                      adjustPixels(
                        pixels.data,
                        brightness,
                        contrast,
                        saturation,
                      );
                      x.putImageData(pixels, 0, 0);
                      d!.active.canvas = c;
                      commit("Коррекция применена");
                      setModal(null);
                    });
                    setBusy(false);
                  }}
                >
                  Применить
                </button>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

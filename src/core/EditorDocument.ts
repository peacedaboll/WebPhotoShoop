export type Layer = {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  canvas: HTMLCanvasElement;
};
export type Snapshot = {
  width: number;
  height: number;
  activeId: string;
  layers: Layer[];
  label: string;
};
export const MAX_PIXELS = 8_000_000;
export const MAX_DOCUMENT_PIXELS = 16_000_000;
export function validateSize(width: number, height: number) {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width * height > MAX_PIXELS
  )
    throw new Error(
      "Размер холста должен быть положительным и не превышать 8 миллионов пикселей.",
    );
}
export function copyCanvas(source: HTMLCanvasElement) {
  const c = document.createElement("canvas");
  c.width = source.width;
  c.height = source.height;
  c.getContext("2d")!.drawImage(source, 0, 0);
  return c;
}
export class EditorDocument {
  width: number;
  height: number;
  layers: Layer[] = [];
  activeId = "";
  constructor(width = 1200, height = 800) {
    validateSize(width, height);
    this.width = width;
    this.height = height;
    this.addLayer("Фон");
  }
  get active() {
    return this.layers.find((l) => l.id === this.activeId)!;
  }
  addLayer(name = "Новый слой") {
    if (this.layers.length >= 12)
      throw new Error("В этой версии можно создать до 12 слоёв.");
    if (
      (this.layers.length + 1) * this.width * this.height >
      MAX_DOCUMENT_PIXELS
    )
      throw new Error(
        "Для нового слоя недостаточно доступного бюджета памяти. Уменьшите холст или удалите ненужный слой.",
      );
    const c = document.createElement("canvas");
    c.width = this.width;
    c.height = this.height;
    const layer = {
      id: crypto.randomUUID(),
      name,
      visible: true,
      opacity: 1,
      canvas: c,
    };
    this.layers.push(layer);
    this.activeId = layer.id;
    return layer;
  }
  removeLayer(id: string) {
    if (this.layers.length === 1) throw new Error("Нужен хотя бы один слой.");
    this.layers = this.layers.filter((l) => l.id !== id);
    this.activeId = this.layers.at(-1)!.id;
  }
  moveLayer(id: string, delta: number) {
    const i = this.layers.findIndex((l) => l.id === id),
      j = i + delta;
    if (i < 0 || j < 0 || j >= this.layers.length) return;
    [this.layers[i], this.layers[j]] = [this.layers[j], this.layers[i]];
  }
  render(target: HTMLCanvasElement) {
    target.width = this.width;
    target.height = this.height;
    const ctx = target.getContext("2d")!;
    for (const l of this.layers) {
      if (!l.visible) continue;
      ctx.globalAlpha = l.opacity;
      ctx.drawImage(l.canvas, 0, 0);
    }
    ctx.globalAlpha = 1;
  }
  snapshot(label: string): Snapshot {
    return {
      width: this.width,
      height: this.height,
      activeId: this.activeId,
      layers: this.layers.map((l) => ({ ...l, canvas: copyCanvas(l.canvas) })),
      label,
    };
  }
  restore(s: Snapshot) {
    this.width = s.width;
    this.height = s.height;
    this.activeId = s.activeId;
    this.layers = s.layers.map((l) => ({ ...l, canvas: copyCanvas(l.canvas) }));
  }
  rotate() {
    [this.width, this.height] = [this.height, this.width];
    for (const l of this.layers) {
      const c = document.createElement("canvas");
      c.width = this.width;
      c.height = this.height;
      const x = c.getContext("2d")!;
      x.translate(c.width, 0);
      x.rotate(Math.PI / 2);
      x.drawImage(l.canvas, 0, 0);
      l.canvas = c;
    }
  }
  crop(x: number, y: number, w: number, h: number) {
    validateSize(w, h);
    if (x < 0 || y < 0 || x + w > this.width || y + h > this.height)
      throw new Error("Область обрезки должна находиться внутри холста.");
    for (const l of this.layers) {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      c.getContext("2d")!.drawImage(l.canvas, x, y, w, h, 0, 0, w, h);
      l.canvas = c;
    }
    this.width = w;
    this.height = h;
  }
}
export class History<T> {
  private past: T[] = [];
  private future: T[] = [];
  constructor(private limit = 12) {}
  get canUndo() {
    return this.past.length > 1;
  }
  get canRedo() {
    return this.future.length > 0;
  }
  get entries() {
    return [...this.past];
  }
  push(state: T) {
    this.past.push(state);
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
  }
  undo() {
    if (!this.canUndo) return;
    this.future.push(this.past.pop()!);
    return this.past.at(-1);
  }
  redo() {
    const s = this.future.pop();
    if (s !== undefined) this.past.push(s);
    return s;
  }
  clear() {
    this.past = [];
    this.future = [];
  }
  trim(count: number) {
    this.past = this.past.slice(-Math.max(2, count));
    this.future = [];
  }
}

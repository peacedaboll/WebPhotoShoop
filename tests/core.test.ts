import { test } from "node:test";
import assert from "node:assert/strict";
import { History, validateSize } from "../src/core/EditorDocument";
import { adjustPixels } from "../src/core/filters";
test("Отмена, повтор и новая ветка изменений", () => {
  const h = new History<string>();
  h.push("a");
  h.push("b");
  assert.equal(h.undo(), "a");
  assert.equal(h.redo(), "b");
  h.undo();
  h.push("c");
  assert.equal(h.canRedo, false);
  assert.equal(h.undo(), "a");
  assert.equal(h.undo(), undefined);
});
test("История ограничивает число снимков", () => {
  const h = new History<number>(3);
  [1, 2, 3, 4].forEach((x) => h.push(x));
  assert.deepEqual(h.entries, [2, 3, 4]);
});
test("Размеры холста проверяются до выделения памяти", () => {
  for (const [w, h] of [
    [0, 1],
    [-1, 2],
    [1.5, 2],
    [10000, 10000],
    [NaN, 2],
  ])
    assert.throws(() => validateSize(w, h));
  assert.doesNotThrow(() => validateSize(2000, 4000));
});
test("Нейтральная коррекция не меняет изображение и альфа канал", () => {
  const p = new Uint8ClampedArray([12, 100, 220, 54]);
  assert.deepEqual(
    adjustPixels(p, 0, 0, 100),
    new Uint8ClampedArray([12, 100, 220, 54]),
  );
});
test("Нулевая насыщенность даёт серый и сохраняет прозрачность", () => {
  const p = adjustPixels(new Uint8ClampedArray([255, 0, 0, 128]), 0, 0, 0);
  assert.equal(p[0], p[1]);
  assert.equal(p[1], p[2]);
  assert.equal(p[3], 128);
});
test("Яркость ограничивается диапазоном каналов", () => {
  assert.deepEqual(
    adjustPixels(new Uint8ClampedArray([200, 200, 200, 255]), 100, 0, 100),
    new Uint8ClampedArray([255, 255, 255, 255]),
  );
});

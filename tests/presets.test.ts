import { test } from "node:test";
import assert from "node:assert/strict";
import { applyPreset } from "../src/core/presets";

test("Чёрно-белый эффект выравнивает каналы и сохраняет прозрачность", () => {
  assert.deepEqual([...applyPreset(new Uint8ClampedArray([255, 0, 0, 73]), "mono")], [54, 54, 54, 73]);
});
test("Сепия использует исходные каналы и ограничивает пересвет", () => {
  assert.deepEqual([...applyPreset(new Uint8ClampedArray([255, 255, 255, 0]), "sepia")], [255, 255, 239, 0]);
});
test("Холодный свет изменяет цвет без изменения альфа-канала", () => {
  assert.deepEqual([...applyPreset(new Uint8ClampedArray([100, 100, 100, 255]), "cool")], [92, 102, 118, 255]);
});

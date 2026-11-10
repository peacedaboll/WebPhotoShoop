export type Preset = "mono" | "sepia" | "cool";
export const presets: { id: Preset; name: string }[] = [
  { id: "mono", name: "Чёрно-белый" },
  { id: "sepia", name: "Сепия" },
  { id: "cool", name: "Холодный свет" },
];

/** Меняет только RGB; прозрачность и исходный массив сохраняют свою роль. */
export function applyPreset(data: Uint8ClampedArray, preset: Preset) {
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    if (preset === "mono") {
      const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      data[i] = data[i + 1] = data[i + 2] = gray;
    } else if (preset === "sepia") {
      data[i] = 0.393 * r + 0.769 * g + 0.189 * b;
      data[i + 1] = 0.349 * r + 0.686 * g + 0.168 * b;
      data[i + 2] = 0.272 * r + 0.534 * g + 0.131 * b;
    } else {
      data[i] = r * 0.92;
      data[i + 1] = g * 1.02;
      data[i + 2] = b * 1.12 + 6;
    }
  }
  return data;
}

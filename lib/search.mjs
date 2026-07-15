// ─────────────────────────────────────────────
// zvec-tool · search.mjs
// Фильтрация и форматирование результатов поиска.
// ─────────────────────────────────────────────
import path from "path";
import { FIELD } from "./constants.mjs";

/** Нормализует сырой элемент из ZVec в { filePath, text, score } */
function normalizeItem(item) {
    const fields = item.fields || item;
    const score = item.score ?? item.distance ?? 0;
    const filePath = fields.file_path || fields[FIELD.PATH] || "";
    const text = fields.text_content || fields[FIELD.TEXT] || "";
    return { filePath, text, score };
}

/**
 * Фильтрует и сортирует результаты.
 * - excludePaths: пути, которые нужно исключить
 * - includePaths: если задан, показываем только эти пути
 */
export function rankSearchResults(query, results, excludePaths = [], includePaths = []) {
    const exclude = new Set(excludePaths.map((p) => path.resolve(p)));
    const include = includePaths.length
        ? new Set(includePaths.map((p) => path.resolve(p)))
        : null;

    return results
        .map(normalizeItem)
        .filter((r) => r.filePath && r.text)
        .filter((r) => !exclude.has(path.resolve(r.filePath)))
        .filter((r) => !include || include.has(path.resolve(r.filePath)))
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

/** Форматирует результаты в читаемый текст для CLI. */
export function formatSearchResults(results) {
    return results
        .map((r, i) => {
            const preview = r.text.replace(/\s+/g, " ").slice(0, 220);
            return `${i + 1}. ${r.filePath}\n   score=${(r.score ?? 0).toFixed(4)}\n   ${preview}`;
        })
        .join("\n\n");
}
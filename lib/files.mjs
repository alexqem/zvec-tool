// ─────────────────────────────────────────────
// zvec-tool · files.mjs
// Фильтрация файлов при обходе дерева.
// ─────────────────────────────────────────────
import path from "path";
import {
    ALLOWED_EXTENSIONS,
    EXCLUDED_FILE_NAMES,
    IGNORED_DIRS,
    INDEX_ROOT,
    PROJECT_ROOT,
} from "./config.mjs";

/** true, если путь содержит игнорируемую директорию */
export function shouldIgnorePath(filePath) {
    const normalized = filePath.split(path.sep).join("/");
    const parts = normalized.split("/");
    return parts.some((p) => IGNORED_DIRS.includes(p));
}

/** true, если файл нужно индексировать */
export function isSupportedFile(filePath) {
    const base = path.basename(filePath);
    if (EXCLUDED_FILE_NAMES.has(base)) return false;
    if (base.startsWith("_")) return false;

    const ext = path.extname(filePath).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) return false;

    // Файл должен быть внутри INDEX_ROOT
    const relToIndex = path.relative(INDEX_ROOT, filePath);
    if (relToIndex.startsWith("..")) return false;

    // И внутри PROJECT_ROOT
    const relToProject = path.relative(PROJECT_ROOT, filePath);
    return !relToProject.startsWith("..");
}
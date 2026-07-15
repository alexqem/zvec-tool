// ─────────────────────────────────────────────
// zvec-tool · project.mjs
// Единственный "main config" проекта.
// Все пути, модель, параметры индексирования.
// Остальные модули читают только отсюда.
// ─────────────────────────────────────────────
import path from "path";
import { fileURLToPath } from "url";
import { DB, EMBED, INDEX } from "./constants.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Директория самого zvec-tool (где лежит этот файл/../..) */
export const TOOL_DIR = path.resolve(__dirname, "..");

/** Корень проекта — на уровень выше zvec-tool */
export const PROJECT_ROOT_DEFAULT = path.resolve(TOOL_DIR, "..");

/** Вычисляем пути от корня проекта */
export const ZVEC_DIR_DEFAULT = path.join(PROJECT_ROOT_DEFAULT, DB.DIR_NAME);

/**
 * PROJECT — главный конфиг.
 * Все параметры можно переопределить через env-переменные (см. config.mjs),
 * но дефолты живут здесь.
 */
export const PROJECT = {
    /** Корень проекта */
    root: PROJECT_ROOT_DEFAULT,

    /** Директория для индексирования — задаётся явно (env ZVEC_INDEX_ROOT или аргумент CLI). Дефолта нет. */
    indexRoot: null,

    /** Директория .zvec/ */
    zvecDir: ZVEC_DIR_DEFAULT,

    /** Расширения файлов для индексирования */
    extensions: INDEX.EXTENSIONS,

    /** Директории, которые пропускаем при обходе */
    ignoreDirs: INDEX.IGNORE_DIRS,

    /** Файлы, которые пропускаем */
    excludeFiles: INDEX.EXCLUDE_FILES,

    /** Параметры чанкинга */
    chunk: {
        size: INDEX.CHUNK_SIZE,
        overlap: INDEX.CHUNK_OVERLAP,
    },

    /** Настройки модели embedding */
    embedding: {
        model: EMBED.MODEL,
        dimension: EMBED.DIMENSION,
        backend: EMBED.BACKEND,
        queryPrefix: EMBED.QUERY_PREFIX,
        docPrefix: EMBED.DOC_PREFIX,
    },

    /** Python-исполняемый файл */
    python: INDEX.PYTHON_EXE,
};

/** Абсолютные пути к ключевым файлам внутри zvec-tool */
export const PATHS = {
    toolDir: TOOL_DIR,
    embedWorker: path.join(TOOL_DIR, "embed_worker.py"),
    cli: path.join(TOOL_DIR, "zvec.mjs"),
};
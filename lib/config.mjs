// ─────────────────────────────────────────────
// zvec-tool · config.mjs
// Runtime-конфиг: PROJECT + env-overrides.
// Все остальные модули импортируют отсюда.
// ─────────────────────────────────────────────
import { parseEnvList, parseEnvInt } from "./utils/parse-env.mjs";
import { normalizePath, cleanPathString } from "./paths.mjs";
import { PROJECT } from "./project.mjs";
import { TIMEOUT_MS } from "./constants.mjs";
import path from "path";

// ── Пути ──────────────────────────────────────
export const PROJECT_ROOT = normalizePath(process.env.PROJECT_ROOT, PROJECT.root);
// INDEX_ROOT не имеет дефолта: каталог индексации задаётся явно
// (env ZVEC_INDEX_ROOT или аргумент `index <путь>`). См. zvec.mjs → cmdIndex.
export const INDEX_ROOT = cleanPathString(process.env.ZVEC_INDEX_ROOT || "")
    ? normalizePath(process.env.ZVEC_INDEX_ROOT)
    : null;
export const ZVEC_DIR = path.join(PROJECT_ROOT, ".zvec");
export const DB_FILE = path.join(ZVEC_DIR, "knowledge.db");
export const SESSION_LOCK_FILE = path.join(ZVEC_DIR, "session.lock");

// ── Embedding ─────────────────────────────────
export const EMBEDDING_MODEL =
    cleanPathString(process.env.ZVEC_EMBEDDING_MODEL) || PROJECT.embedding.model;

export const EMBEDDING_DIMENSION = parseEnvInt(
    process.env.ZVEC_EMBEDDING_DIMENSION,
    PROJECT.embedding.dimension
);
export const EMBEDDING_QUERY_PREFIX =
    process.env.ZVEC_EMBED_QUERY_PREFIX ?? PROJECT.embedding.queryPrefix;
export const EMBEDDING_DOC_PREFIX =
    process.env.ZVEC_EMBED_DOC_PREFIX ?? PROJECT.embedding.docPrefix;

export const USE_PYTHON_EMBEDDINGS = process.env.ZVEC_EMBEDDING_BACKEND !== "js";
export const PYTHON_EXECUTABLE =
    cleanPathString(process.env.ZVEC_PYTHON) || PROJECT.python;

// ── Чанкинг ───────────────────────────────────
export const CHUNK_SIZE = parseEnvInt(process.env.ZVEC_CHUNK_SIZE, PROJECT.chunk.size);
export const CHUNK_OVERLAP = parseEnvInt(process.env.ZVEC_CHUNK_OVERLAP, PROJECT.chunk.overlap);

// ── Фильтрация файлов ─────────────────────────
export const ALLOWED_EXTENSIONS = process.env.ZVEC_EXTENSIONS
    ? parseEnvList(process.env.ZVEC_EXTENSIONS, PROJECT.extensions)
    : PROJECT.extensions;

export const IGNORED_DIRS = process.env.ZVEC_IGNORE_DIRS
    ? parseEnvList(process.env.ZVEC_IGNORE_DIRS, PROJECT.ignoreDirs)
    : PROJECT.ignoreDirs;

export const EXCLUDED_FILE_NAMES = process.env.ZVEC_EXCLUDE_FILES
    ? new Set(parseEnvList(process.env.ZVEC_EXCLUDE_FILES, [...PROJECT.excludeFiles]))
    : PROJECT.excludeFiles;

// ── Таймауты ──────────────────────────────────
export const LOCK_WAIT_MS = parseEnvInt(
    process.env.ZVEC_LOCK_WAIT_MS,
    TIMEOUT_MS.SESSION_LOCK_DEFAULT
);
export const EMBED_TIMEOUT_MS = parseEnvInt(
    process.env.ZVEC_EMBED_TIMEOUT_MS,
    TIMEOUT_MS.EMBED_DEFAULT
);
export const EMBED_STARTUP_MS = parseEnvInt(
    process.env.ZVEC_EMBED_STARTUP_MS,
    TIMEOUT_MS.EMBED_STARTUP
);
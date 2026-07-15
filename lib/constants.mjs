// ─────────────────────────────────────────────
// zvec-tool · constants.mjs
// Единый источник всех магических значений.
// Ничего не хардкодим в других файлах.
// ─────────────────────────────────────────────

export const LOG_PREFIX = "[zvec]";

// ── Файловая структура ────────────────────────
export const DB = {
    DIR_NAME: ".zvec",
    DB_NAME: "knowledge.db",
    SESSION_LOCK_NAME: "session.lock",
    ACTIVE_MANIFEST: "active.json",
    BACKUPS_DIR: "backups",
    VERSIONS_DIR: "versions",
    VERSION_PREFIX: "v-",
    KEEP_VERSIONS: 3,
    KEEP_BACKUPS: 5,
    /** Максимальное кол-во retries при удалении на Windows */
    RM_MAX_RETRIES: 5,
    RM_RETRY_DELAY_MS: 150,
};

// ── Поля коллекции ────────────────────────────
export const FIELD = {
    VECTOR: "embedding",
    TEXT: "text_content",
    PATH: "file_path",
    LANG: "language",
    COLLECTION_NAME: "project_knowledge",
};

// ── Embedding ─────────────────────────────────
export const EMBED = {
    MODEL: "intfloat/multilingual-e5-small",
    DIMENSION: 384,
    BACKEND: "python",
    QUERY_PREFIX: "query: ",
    DOC_PREFIX: "passage: ",
    READY_MARKER: "Ready, dim=",
    KIND_QUERY: "query",
    KIND_DOC: "document",
};

// ── Индексирование ────────────────────────────
export const INDEX = {
    EXTENSIONS: [".md"],
    CHUNK_SIZE: 1600,
    CHUNK_OVERLAP: 0,
    PYTHON_EXE: "python",
    IGNORE_DIRS: [
        "node_modules", ".git", ".zvec", "dist", "build", ".cache",
        ".vscode", ".idea", "zvec-tool", "zvec-mcp", "terminals", "mcps",
        "agent-tools", ".cursor", "scripts", "tools", "agent-lists",
    ],
    EXCLUDE_FILES: new Set(["package.json", "package-lock.json", "tsconfig.json"]),
};

// ── Поиск ─────────────────────────────────────
export const SEARCH = {
    TOPK_DEFAULT: 8,
    TOPK_MCP: 12,
};

// ── Таймауты (мс) ─────────────────────────────
export const TIMEOUT_MS = {
    SESSION_LOCK_DEFAULT: 30_000,
    INDEX_LOCK: 7_200_000,
    CLI_STATUS_LOCK: 30_000,
    CLI_SEARCH_LOCK: 120_000,
    CLI_SEARCH_EMBED: 120_000,
    MCP_SEARCH_EMBED: 300_000,
    EMBED_DEFAULT: 120_000,
    EMBED_STARTUP: 180_000,
    /** Пауза между попытками захватить lock */
    LOCK_POLL_MS: 250,
    /** setImmediate-пауза при индексировании (даём event loop дышать) */
    INDEX_YIELD_AFTER_CHUNKS: 1,
};

// ── Exit-коды ─────────────────────────────────
export const EXIT = {
    OK: 0,
    ERR: 1,
    BUSY: 2,
};
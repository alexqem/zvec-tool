// ─────────────────────────────────────────────
// zvec-tool · db.mjs
// Безопасная работа с ZVec-коллекцией.
//
// Windows-safe стратегия:
//   withCollection(fn) — открывает, передаёт fn, закрывает.
//   Никогда не держим файл открытым между вызовами.
//   Если активная БД заблочена — пробуем fallback-версию.
// ─────────────────────────────────────────────
import fs from "fs";
import path from "path";
import { ZVecCreateAndOpen, ZVecOpen } from "@zvec/zvec";
import { LOG_PREFIX, FIELD, SEARCH } from "./constants.mjs";
import { createCollectionSchema } from "./schema.mjs";
import { normalizeQueryResults } from "./utils/zvec-response.mjs";
import {
    findFallbackVersion,
    probeDb,
    readActiveManifest,
    resolveDbPath,
    rollbackTo,
} from "./version-store.mjs";

// ── Открытие ──────────────────────────────────

function openAtPath(dbPath, createIfMissing = false) {
    if (fs.existsSync(dbPath)) return ZVecOpen(dbPath);
    if (createIfMissing) {
        fs.mkdirSync(path.dirname(dbPath), { recursive: true });
        return ZVecCreateAndOpen(dbPath, createCollectionSchema());
    }
    throw new Error(`Database not found: ${dbPath}`);
}

/**
 * Пытается авто-откатиться на предыдущую версию, если текущая сломана.
 * Возвращает true, если откат удался.
 */
function tryAutoRollback(brokenVersion) {
    const fallback = findFallbackVersion(brokenVersion);
    if (!fallback) return false;
    const probe = probeDb(fallback.path);
    if (probe.ok && probe.docCount > 0) {
        console.error(`${LOG_PREFIX} Auto-rollback to ${fallback.version}`);
        rollbackTo(fallback.version);
        return true;
    }
    return false;
}

/**
 * Открывает коллекцию по пути.
 * При ошибке: авто-откат, если возможен.
 * createIfMissing — только для staging indexing.
 */
export function openCollection(options = {}) {
    const { createIfMissing = false, _retried = false } = options;
    const dbPath = resolveDbPath();

    try {
        return openAtPath(dbPath, createIfMissing);
    } catch (err) {
        // Файл есть, но не папка — удаляем битый файл и пересоздаём
        const stats = fs.existsSync(dbPath) ? fs.statSync(dbPath) : null;
        if (stats && !stats.isDirectory()) {
            console.error(`${LOG_PREFIX} Corrupt DB file, removing: ${dbPath}`);
            fs.rmSync(dbPath, { force: true });
            return ZVecCreateAndOpen(dbPath, createCollectionSchema());
        }

        const active = readActiveManifest();
        if (!_retried && tryAutoRollback(active?.version)) {
            return openCollection({ ...options, _retried: true });
        }

        throw new Error(
            `Cannot open DB at ${dbPath}: ${err.message}. ` +
            `Active=${active?.version ?? "none"}. ` +
            "Stop other zvec processes. Run: node zvec.mjs doctor"
        );
    }
}

export function closeCollection(col) {
    if (!col) return;
    try { col.closeSync(); } catch (err) {
        console.error(`${LOG_PREFIX} closeSync: ${err.message}`);
    }
}

/**
 * Главный паттерн Windows-safe:
 *   открыть → fn(col) → закрыть (даже при ошибке).
 */
export function withCollection(fn, options = {}) {
    const col = openCollection(options);
    try {
        return fn(col);
    } finally {
        closeCollection(col);
    }
}

export function getDocCount(col) {
    return col?.stats?.docCount ?? 0;
}

export function getDbPath() {
    return resolveDbPath();
}

// ── Query ─────────────────────────────────────

export function queryCollection(vector, topk = SEARCH.TOPK_DEFAULT) {
    return withCollection((col) => {
        const response = col.querySync({ fieldName: FIELD.VECTOR, vector, topk });
        return normalizeQueryResults(response);
    });
}
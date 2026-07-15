// ─────────────────────────────────────────────
// zvec-tool · lock.mjs  (бывший run-with-lock)
// Файловый lock через JSON-файл.
//
// Windows-safe:
//   - проверяем живость PID через process.kill(pid, 0)
//   - протухший lock (мёртвый PID) сбрасываем сразу
//   - нет rename-рейса: tmp → final
// ─────────────────────────────────────────────
import fs from "fs";
import path from "path";
import { LOCK_WAIT_MS, SESSION_LOCK_FILE } from "../config.mjs";
import { LOG_PREFIX, TIMEOUT_MS } from "../constants.mjs";

/** Читает текущий lock-файл без его захвата (для status/doctor). */
export function readLockFile() {
    return readLock();
}

function readLock() {
    try {
        return JSON.parse(fs.readFileSync(SESSION_LOCK_FILE, "utf-8"));
    } catch {
        return null;
    }
}

function isPidAlive(pid) {
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
}

function writeLock(mode) {
    const pid = process.pid;
    fs.mkdirSync(path.dirname(SESSION_LOCK_FILE), { recursive: true });
    const tmp = `${SESSION_LOCK_FILE}.${pid}.tmp`;
    fs.writeFileSync(
        tmp,
        JSON.stringify({ pid, mode, startedAt: new Date().toISOString() }, null, 2),
        "utf-8"
    );
    fs.renameSync(tmp, SESSION_LOCK_FILE);
}

function clearLock() {
    try { fs.unlinkSync(SESSION_LOCK_FILE); } catch {}
}

/**
 * Запускает fn() под lock-файлом.
 *
 * Если lock держит мёртвый PID — сбрасываем немедленно (staleness).
 * Если lock держит живой PID — ждём до waitMs, потом ZVEC_BUSY.
 * Если мы уже держим lock (рекурсия) — просто вызываем fn().
 */
export async function withSessionLock(mode, waitMs, fn) {
    const deadline = Date.now() + (waitMs ?? LOCK_WAIT_MS);

    while (Date.now() < deadline) {
        const existing = readLock();

        // Нет lock-файла — захватываем
        if (!existing) {
            writeLock(mode);
            try {
                return await fn();
            } finally {
                clearLock();
            }
        }

        // Мы сами держим lock (рекурсивный вызов)
        if (existing.pid === process.pid) {
            return await fn();
        }

        // Мёртвый PID — lock протух
        if (!isPidAlive(existing.pid)) {
            console.error(
                `${LOG_PREFIX} Stale lock from PID ${existing.pid} (mode=${existing.mode}), clearing`
            );
            clearLock();
            continue;  // следующая итерация — захватим
        }

        // Живой PID — ждём
        await new Promise((r) => setTimeout(r, TIMEOUT_MS.LOCK_POLL_MS));
    }

    const err = new Error(`Busy: zvec lock held by another process (${SESSION_LOCK_FILE})`);
    err.code = "ZVEC_BUSY";
    console.error(`${LOG_PREFIX} ${err.message}`);
    throw err;
}

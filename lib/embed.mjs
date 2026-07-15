// ─────────────────────────────────────────────
// zvec-tool · embed.mjs
// Управление Python-воркером для embeddings.
//
// Два режима:
//   embedText()    — воркер держится в памяти (для индексирования)
//   embedOneshot() — spawn/kill для одного запроса (для search в CLI)
//
// Oneshot безопаснее на Windows: не оставляет открытых дочерних
// процессов, которые могут блокировать файлы.
// ─────────────────────────────────────────────
import { spawn } from "child_process";
import fs from "fs";
import { EMBED, LOG_PREFIX, TIMEOUT_MS } from "./constants.mjs";
import {
    EMBED_STARTUP_MS,
    EMBED_TIMEOUT_MS,
    EMBEDDING_DOC_PREFIX,
    EMBEDDING_MODEL,
    EMBEDDING_QUERY_PREFIX,
    PYTHON_EXECUTABLE,
} from "./config.mjs";
import { PATHS } from "./project.mjs";

// ── Worker state ──────────────────────────────
let worker = null;
let workerReady = false;
let workerStarting = null;
let reqId = 0;
const pending = new Map();
let stdoutBuf = "";

function workerEnv() {
    return {
        ...process.env,
        ZVEC_EMBEDDING_MODEL: EMBEDDING_MODEL,
        ZVEC_EMBED_QUERY_PREFIX: EMBEDDING_QUERY_PREFIX,
        ZVEC_EMBED_DOC_PREFIX: EMBEDDING_DOC_PREFIX,
    };
}

function rejectAllPending(err) {
    for (const [, entry] of pending) {
        if (entry.timer) clearTimeout(entry.timer);
        entry.reject(err);
    }
    pending.clear();
}

function onStdout(chunk) {
    stdoutBuf += chunk.toString();
    const lines = stdoutBuf.split("\n");
    stdoutBuf = lines.pop() || "";
    for (const line of lines) {
        if (!line.trim()) continue;
        let msg;
        try { msg = JSON.parse(line); } catch { continue; }
        const entry = pending.get(msg.id);
        if (!entry) continue;
        pending.delete(msg.id);
        if (entry.timer) clearTimeout(entry.timer);
        if (msg.error) entry.reject(new Error(msg.error));
        else entry.resolve(msg.vector);
    }
}

async function ensureWorker() {
    if (workerReady && worker) return;
    if (workerStarting) return workerStarting;

    workerStarting = new Promise((resolve, reject) => {
        if (!fs.existsSync(PATHS.embedWorker)) {
            reject(new Error(`Embed worker not found: ${PATHS.embedWorker}`));
            return;
        }

        const child = spawn(PYTHON_EXECUTABLE, [PATHS.embedWorker], {
            stdio: ["pipe", "pipe", "pipe"],
            windowsHide: true,
            env: workerEnv(),
        });
        worker = child;
        stdoutBuf = "";

        const startupTimer = setTimeout(() => {
            if (!workerReady)
                reject(new Error(`Embed worker startup timeout (${EMBED_STARTUP_MS}ms)`));
        }, EMBED_STARTUP_MS);

        child.stderr.on("data", (data) => {
            const text = data.toString();
            if (text.includes(EMBED.READY_MARKER)) {
                workerReady = true;
                clearTimeout(startupTimer);
                resolve();
            }
            const trimmed = text.trim();
            if (trimmed) console.error(`${LOG_PREFIX} ${trimmed}`);
        });

        child.stdout.on("data", onStdout);

        child.on("error", (err) => {
            worker = null; workerReady = false; workerStarting = null;
            rejectAllPending(err); reject(err);
        });
        child.on("exit", (code) => {
            worker = null; workerReady = false; workerStarting = null;
            rejectAllPending(new Error(`Embed worker exited (${code})`));
        });
    });

    try { await workerStarting; } finally { if (workerReady) workerStarting = null; }
}

/** Embed через долгоживущий воркер (для индексирования). */
export async function embedText(text, kind = EMBED.KIND_QUERY, timeoutMs = EMBED_TIMEOUT_MS) {
    await ensureWorker();
    const id = ++reqId;
    return new Promise((resolve, reject) => {
        const entry = { resolve, reject, timer: null };
        if (timeoutMs > 0) {
            entry.timer = setTimeout(
                () => { pending.delete(id); reject(new Error(`Embedding timeout (${timeoutMs}ms)`)); },
                timeoutMs
            );
        }
        pending.set(id, entry);
        try {
            worker.stdin.write(`${JSON.stringify({ id, text, kind })}\n`);
        } catch (err) {
            pending.delete(id);
            if (entry.timer) clearTimeout(entry.timer);
            reject(err);
        }
    });
}

/**
 * Embed через одноразовый spawn.
 * Безопасно на Windows: сразу kill после получения ответа.
 * Используется в CLI search (oneshot).
 */
export function embedOneshot(text, kind = EMBED.KIND_QUERY, timeoutMs = TIMEOUT_MS.CLI_SEARCH_EMBED) {
    return new Promise((resolve, reject) => {
        const child = spawn(PYTHON_EXECUTABLE, [PATHS.embedWorker], {
            stdio: ["pipe", "pipe", "pipe"],
            windowsHide: true,
            env: workerEnv(),
        });

        let out = "";
        const timer = setTimeout(() => {
            try { child.kill(); } catch {}
            reject(new Error(`Oneshot embed timeout (${timeoutMs}ms)`));
        }, timeoutMs);

        const finish = (fn) => {
            clearTimeout(timer);
            try { child.kill(); } catch {}
            fn();
        };

        child.stderr.on("data", (data) => {
            const trimmed = data.toString().trim();
            if (trimmed) console.error(`${LOG_PREFIX} ${trimmed}`);
        });

        child.stdout.on("data", (chunk) => {
            out += chunk.toString();
            const line = out.split("\n").find((l) => l.trim().startsWith("{"));
            if (!line) return;
            try {
                const msg = JSON.parse(line);
                if (msg.error) finish(() => reject(new Error(msg.error)));
                else finish(() => resolve(msg.vector));
            } catch (err) { finish(() => reject(err)); }
        });

        child.on("error", (err) => finish(() => reject(err)));
        child.stdin.write(`${JSON.stringify({ id: 1, text, kind })}\n`);
        child.stdin.end();
    });
}

/** Останавливает воркер (при завершении индексирования). */
export function shutdownEmbedWorker() {
    rejectAllPending(new Error("Embed worker shutdown"));
    if (worker) { try { worker.stdin.end(); worker.kill(); } catch {} }
    worker = null;
    workerReady = false;
    workerStarting = null;
}
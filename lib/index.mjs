// ─────────────────────────────────────────────
// zvec-tool · index.mjs
// Индексирование файлов в ZVec-коллекцию.
// ─────────────────────────────────────────────
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { FIELD, LOG_PREFIX, TIMEOUT_MS } from "./constants.mjs";
import { CHUNK_OVERLAP, CHUNK_SIZE, PROJECT_ROOT } from "./config.mjs";
import { chunkText } from "./chunk.mjs";

import { embedText } from "./embed.mjs";
import { isSupportedFile, shouldIgnorePath } from "./files.mjs";
import { escapeFilterValue } from "./utils/escape-filter.mjs";

let totalIndexedFiles = 0;

export function getTotalIndexedFiles() {
    return totalIndexedFiles;
}

/**
 * Индексирует один файл: удаляет старые чанки, добавляет новые.
 * Открывает/закрывает коллекцию на каждый файл (Windows-safe).
 */
export async function indexFile(filePath, col, indexRoot) {
    const resolvedPath = path.resolve(filePath);

    // Удаляем предыдущие чанки этого файла
    try {
        col.deleteSync(`${FIELD.PATH} == "${escapeFilterValue(resolvedPath)}"`);
    } catch {}

    try { await fs.promises.access(resolvedPath); } catch { return; }
    if (!isSupportedFile(resolvedPath)) return;

    const content = await fs.promises.readFile(resolvedPath, "utf-8");
    if (!content.trim()) return;

    const chunks = chunkText(content, CHUNK_SIZE, CHUNK_OVERLAP);
    const ext = path.extname(resolvedPath).replace(".", "").toLowerCase() || "txt";
    const relativePath = path.relative(indexRoot, resolvedPath) || path.basename(resolvedPath);

    for (let i = 0; i < chunks.length; i++) {
        let vector;
        try {
            vector = await embedText(chunks[i], "document");
        } catch (err) {
            console.error(
                `${LOG_PREFIX} Skip chunk ${i + 1}/${chunks.length} ${relativePath}: ${err.message}`
            );
            continue;
        }

        const doc = {
            id: crypto.createHash("md5").update(`${relativePath}_${i}`).digest("hex"),
            vectors: { [FIELD.VECTOR]: vector },
            fields: {
                [FIELD.TEXT]: chunks[i],
                [FIELD.PATH]: resolvedPath,
                [FIELD.LANG]: ext,
            },
        };

        const status = col.insertSync?.(doc);
        if (status?.ok === false) {
            console.error(`${LOG_PREFIX} insertSync failed: ${relativePath} chunk ${i + 1}`);
        }

        // Уступаем event-loop каждые N чанков
        if (i % TIMEOUT_MS.INDEX_YIELD_AFTER_CHUNKS === 0) {
            await new Promise((r) => setImmediate(r));
        }
    }

    totalIndexedFiles += 1;
}

async function walk(dirPath, col, indexRoot) {
    for (const entry of await fs.promises.readdir(dirPath, { withFileTypes: true })) {
        const entryPath = path.join(dirPath, entry.name);
        if (shouldIgnorePath(entryPath)) continue;
        if (entry.isDirectory()) await walk(entryPath, col, indexRoot);
        else if (entry.isFile() && isSupportedFile(entryPath)) await indexFile(entryPath, col, indexRoot);
    }
}

/** Обходит каталог индексации и индексирует все подходящие файлы. */
export async function indexProject(col, indexRoot) {
    if (!indexRoot) throw new Error("indexRoot не задан");
    totalIndexedFiles = 0;
    try { await fs.promises.access(indexRoot); } catch { return; }
    await walk(indexRoot, col, indexRoot);
}

/**
 * Инициализирует/пересоздаёт индекс.
 * Принимает уже открытую коллекцию (staging или обычную).
 */
export async function buildIndex(col, forceRebuild = false, indexRoot = null) {
    if (forceRebuild) {
        try { col.deleteByFilterSync("1=1"); } catch (err) {
            console.error(`${LOG_PREFIX} Could not clear index: ${err.message}`);
        }
    }
    console.error(`${LOG_PREFIX} Indexing started (root=${indexRoot})...`);
    await indexProject(col, indexRoot);
    console.error(`${LOG_PREFIX} Indexing done. Files: ${totalIndexedFiles}`);
    return { ok: true, projectRoot: PROJECT_ROOT, indexRoot, filesIndexed: totalIndexedFiles };
}
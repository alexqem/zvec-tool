// ─────────────────────────────────────────────
// zvec-tool · index-runner.mjs
// Полная переиндексация с версионированием:
//   1. backup текущей активной версии
//   2. создание staging-БД
//   3. buildIndex(stagingCol)
//   4. закрыть staging
//   5. probeDb → promote
//   6. pruneOldVersions
//
// Windows-safe: staging открыт только пока идёт индексирование.
// После closeSync staging — другие процессы могут открывать активную БД.
// ─────────────────────────────────────────────
import fs from "fs";
import path from "path";
import { LOG_PREFIX } from "./constants.mjs";

import { openCollection, closeCollection } from "./db.mjs";
import { buildIndex } from "./index.mjs";
import { shutdownEmbedWorker } from "./embed.mjs";
import { createBackup, pruneBackups } from "./backup.mjs";
import {
    clearDbPathOverride,
    createStagingVersionId,
    getStagingDbPath,
    probeDb,
    promoteVersion,
    pruneOldVersions,
    setDbPathOverride,
} from "./version-store.mjs";

export async function runFullReindex() {
    // 1. Резервная копия текущей активной версии
    try {
        createBackup("pre-index");
        pruneBackups();
    } catch (err) {
        console.error(`${LOG_PREFIX} Pre-index backup skipped: ${err.message}`);
    }

    const versionId = createStagingVersionId();
    const stagingDb = getStagingDbPath(versionId);
    fs.mkdirSync(path.dirname(stagingDb), { recursive: true });

    // 2. Направляем все write-операции в staging
    setDbPathOverride(stagingDb);
    console.error(`${LOG_PREFIX} Building version ${versionId}...`);

    let stagingCol = null;
    try {
        // 3. Открываем staging, индексируем, закрываем
        stagingCol = openCollection({ createIfMissing: true });
        const start = Date.now();
        const result = await buildIndex(stagingCol, false);

        // 3б. Строим HNSW-индекс (без этого querySync возвращает пустой результат)
        console.error(`${LOG_PREFIX} Building HNSW index...`);
        try { stagingCol.optimizeSync(); } catch (err) {
            console.error(`${LOG_PREFIX} optimizeSync warning: ${err.message}`);
        }

        // 4. Обязательно закрываем до probe
        closeCollection(stagingCol);
        stagingCol = null;

        // Останавливаем Python-воркер (освобождаем память)
        shutdownEmbedWorker();

        // 5. Проверяем и продвигаем
        const probe = probeDb(stagingDb);
        if (!probe.ok) throw new Error(`Staging index invalid: ${probe.error}`);
        if (probe.docCount === 0) throw new Error("Staging index is empty (docCount=0)");

        const manifest = promoteVersion(versionId, stagingDb, probe.docCount, result.filesIndexed);

        // 6. Чистим старые версии
        pruneOldVersions();

        const elapsedSec = ((Date.now() - start) / 1000).toFixed(1);
        return {
            ...result,
            version: manifest.version,
            docCount: manifest.docCount,
            elapsedSec,
        };
    } catch (err) {
        // Закрываем staging при ошибке, не трогаем активную БД
        if (stagingCol) { try { closeCollection(stagingCol); } catch {} }
        shutdownEmbedWorker();
        throw err;
    } finally {
        clearDbPathOverride();
    }
}
#!/usr/bin/env node
// ─────────────────────────────────────────────
// zvec — CLI инструмент семантического поиска
//
// Команды:
//   index              — полная переиндексация (staging → promote)
//   search <query>     — поиск по индексу [--top N] [--json]
//   status             — краткий статус индекса
//   doctor             — детальная диагностика
//   versions           — список версий БД
//   rollback <ver-id>  — откат на предыдущую версию
//   backups            — список резервных копий
//   backup             — создать резервную копию вручную
// ─────────────────────────────────────────────

// Применяем дефолты до любых импортов config.mjs
import { applyProjectEnv } from "./lib/env.mjs";
applyProjectEnv();

import fs from "fs";
import { EXIT, LOG_PREFIX, SEARCH, TIMEOUT_MS } from "./lib/constants.mjs";
import { getDbPath, getDocCount, withCollection } from "./lib/db.mjs";
import { parseCommand, parseSearchArgs } from "./lib/cli/parse-args.mjs";
import { withSessionLock, readLockFile } from "./lib/cli/lock.mjs";
import { runFullReindex } from "./lib/index-runner.mjs";
import { runCliSearch } from "./lib/search-service.mjs";
import { createBackup, listBackups } from "./lib/backup.mjs";
import {
    listVersions,
    probeDb,
    readActiveManifest,
    rollbackTo,
} from "./lib/version-store.mjs";

// ── USAGE ─────────────────────────────────────
const USAGE = `
zvec — semantic search CLI for 1C project knowledge base

Usage:
  node zvec.mjs <command> [options]

Commands:
  index                Build / rebuild the vector index (staging → promote)
  search <query>       Search the index
    --top <N>          Return top N results (default: ${SEARCH.TOPK_DEFAULT})
    --json             Output JSON instead of text
  status               Show index status
  doctor               Detailed diagnostics (probe DB)
  versions             List all DB versions
  rollback <ver-id>    Rollback active DB to a specific version
  backups              List backups
  backup               Create a manual backup

Environment:
  PROJECT_ROOT         Project root directory (default: parent of zvec-tool)
  ZVEC_INDEX_ROOT      Directory to index (default: PROJECT_ROOT/summaries)
  ZVEC_EMBEDDING_MODEL Hugging Face model (default: intfloat/multilingual-e5-small)
  ZVEC_PYTHON          Python executable (default: python)
  ZVEC_CHUNK_SIZE      Chunk size in chars (default: 1600)
`.trim();

// ── Commands ──────────────────────────────────

// Нет lock — probeDb открывает/закрывает мгновенно, active.json атомарный
async function cmdDoctor() {
    const dbPath = getDbPath();
    const active = readActiveManifest();
    const exists = fs.existsSync(dbPath);
    const probe = exists ? probeDb(dbPath) : { ok: false, error: "missing" };
    // Показываем, кто держит lock прямо сейчас
    const lock = readLockFile();
    return { ok: probe.ok, dbPath, active, exists, docCount: probe.docCount ?? 0, error: probe.error ?? null, lock };
}

// Нет lock — только чтение active.json + быстрый withCollection
async function cmdStatus() {
    const active = readActiveManifest();
    const dbPath = getDbPath();
    const exists = fs.existsSync(dbPath);
    let docCount = 0;
    if (exists) {
        try { docCount = withCollection((col) => getDocCount(col)); } catch {}
    }
    const lock = readLockFile();
    return { ok: true, dbPath, active, exists, docCount, lock };
}

async function cmdVersions() {
    return { versions: listVersions(), active: readActiveManifest() };
}

async function cmdRollback(versionId) {
    if (!versionId) throw new Error("Usage: node zvec.mjs rollback <version-id>");
    return withSessionLock("rollback", TIMEOUT_MS.INDEX_LOCK, async () => {
        const manifest = rollbackTo(versionId);
        return { ok: true, active: manifest };
    });
}

// Нет lock — withCollection открывает/закрывает мгновенно, embedOneshot — отдельный process
async function cmdSearch(query, topk, asJson) {
    const t0 = Date.now();
    const output = await runCliSearch(query, topk ?? SEARCH.TOPK_DEFAULT, asJson);
    console.error(`${LOG_PREFIX} search done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    return output;
}

async function cmdIndex() {
    return withSessionLock("index", TIMEOUT_MS.INDEX_LOCK, () => runFullReindex());
}

// ── Entry point ───────────────────────────────

const { cmd, rest } = parseCommand(process.argv);

try {
    if (cmd === "doctor") {
        console.log(JSON.stringify(await cmdDoctor(), null, 2));

    } else if (cmd === "status") {
        console.log(JSON.stringify(await cmdStatus(), null, 2));

    } else if (cmd === "versions") {
        console.log(JSON.stringify(await cmdVersions(), null, 2));

    } else if (cmd === "backups") {
        console.log(JSON.stringify({ backups: listBackups() }, null, 2));

    } else if (cmd === "backup") {
        console.log(JSON.stringify(createBackup("manual"), null, 2));

    } else if (cmd === "rollback") {
        console.log(JSON.stringify(await cmdRollback(rest[0]), null, 2));

    } else if (cmd === "search") {
        const { query, topk, json } = parseSearchArgs(["", "", ...rest]);
        if (!query) {
            console.error(USAGE);
            process.exit(EXIT.ERR);
        }
        console.log(await cmdSearch(query, topk, json));

    } else if (cmd === "index") {
        console.log(JSON.stringify(await cmdIndex(), null, 2));

    } else {
        console.error(USAGE);
        process.exit(cmd === "help" ? EXIT.OK : EXIT.ERR);
    }

} catch (err) {
    console.error(`${LOG_PREFIX} ${err.message}`);
    process.exit(err.code === "ZVEC_BUSY" ? EXIT.BUSY : EXIT.ERR);
}
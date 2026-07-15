// ─────────────────────────────────────────────
// zvec-tool · version-store.mjs
// Управление версиями БД:
//   - staging → promote (атомарно)
//   - rollback, list, probe
//   - Windows-safe: open/close немедленно,
//     не держим файлы открытыми
// ─────────────────────────────────────────────
import fs from "fs";
import path from "path";
import { ZVecOpen } from "@zvec/zvec";
import { DB, LOG_PREFIX } from "./constants.mjs";
import { normalizePath } from "./paths.mjs";
import { PROJECT } from "./project.mjs";

// ── Helpers ───────────────────────────────────

function projectRoot() {
    return normalizePath(process.env.PROJECT_ROOT, PROJECT.root);
}

function zvecDir() {
    return path.join(projectRoot(), DB.DIR_NAME);
}

function versionsDir() {
    return path.join(zvecDir(), DB.VERSIONS_DIR);
}

function activeFile() {
    return path.join(zvecDir(), DB.ACTIVE_MANIFEST);
}

function legacyDb() {
    return path.join(zvecDir(), DB.DB_NAME);
}

/** Атомарная запись JSON через tmp-файл (Windows-safe) */
function writeJsonAtomic(filePath, data) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const tmp = `${filePath}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
    fs.renameSync(tmp, filePath);
}

// ── Override (для staging indexing) ──────────
let _dbPathOverride = null;

export function setDbPathOverride(target) { _dbPathOverride = target; }
export function clearDbPathOverride()     { _dbPathOverride = null; }

// ── Public API ────────────────────────────────

export function getVersionsDir() {
    return versionsDir();
}

/** Читает active.json → манифест активной версии или null */
export function readActiveManifest() {
    try {
        const data = JSON.parse(fs.readFileSync(activeFile(), "utf-8"));
        if (data?.path && data?.version) return data;
    } catch {}
    return null;
}

/** Возвращает путь к активной БД (override > active.json > legacy) */
export function resolveDbPath() {
    if (_dbPathOverride) return _dbPathOverride;
    const active = readActiveManifest();
    if (active?.path && fs.existsSync(active.path)) return active.path;
    return legacyDb();
}

/** Создаёт уникальный ID версии на основе текущего времени */
export function createStagingVersionId() {
    return `${DB.VERSION_PREFIX}${new Date().toISOString().replace(/[:.]/g, "-")}`;
}

/** Путь к БД staging-версии */
export function getStagingDbPath(versionId) {
    return path.join(versionsDir(), versionId, DB.DB_NAME);
}

/** Список всех версий (отсортирован по убыванию) */
export function listVersions() {
    const vdir = versionsDir();
    if (!fs.existsSync(vdir)) return [];
    const active = readActiveManifest();
    return fs
        .readdirSync(vdir, { withFileTypes: true })
        .filter((e) => e.isDirectory() && e.name.startsWith(DB.VERSION_PREFIX))
        .map((e) => ({
            version: e.name,
            path: path.join(vdir, e.name, DB.DB_NAME),
            exists: fs.existsSync(path.join(vdir, e.name, DB.DB_NAME)),
            active: active?.version === e.name,
        }))
        .sort((a, b) => b.version.localeCompare(a.version));
}

/**
 * Пробует открыть БД, прочитать docCount и сразу закрыть.
 * Windows-safe: никогда не держит файл открытым.
 * Возвращает { ok, docCount } или { ok: false, error }.
 */
export function probeDb(dbPath) {
    let col;
    try {
        if (!fs.existsSync(dbPath)) return { ok: false, error: "path missing" };
        col = ZVecOpen(dbPath);
        const docCount = col.stats?.docCount ?? 0;
        col.closeSync();
        col = null;
        return { ok: true, docCount };
    } catch (err) {
        try { col?.closeSync?.(); } catch {}
        return { ok: false, error: err.message };
    }
}

/**
 * Проверяет staging и делает его активным (active.json).
 * Вызывается только после закрытия staging-коллекции.
 */
export function promoteVersion(versionId, dbPath, docCount, filesIndexed = 0) {
    const probe = probeDb(dbPath);
    if (!probe.ok) throw new Error(`Cannot promote ${versionId}: ${probe.error}`);
    if (probe.docCount === 0) throw new Error(`Cannot promote ${versionId}: docCount is 0`);

    const manifest = {
        version: versionId,
        path: dbPath,
        docCount: probe.docCount,
        filesIndexed: filesIndexed || docCount,
        promotedAt: new Date().toISOString(),
    };
    writeJsonAtomic(activeFile(), manifest);
    console.error(`${LOG_PREFIX} Active version: ${versionId} (docs=${probe.docCount})`);
    return manifest;
}

/** Откатывает active.json на указанную версию */
export function rollbackTo(versionId) {
    const dbPath = getStagingDbPath(versionId);
    return promoteVersion(versionId, dbPath, 0);
}

/**
 * Удаляет старые версии (оставляет keep штук + активную).
 * Windows-safe: retry при ошибке блокировки файла.
 */
export function pruneOldVersions(keep = DB.KEEP_VERSIONS) {
    const active = readActiveManifest();
    const stale = listVersions()
        .filter((v) => v.exists && v.version !== active?.version)
        .sort((a, b) => b.version.localeCompare(a.version))
        .slice(keep);

    for (const v of stale) {
        const dir = path.join(versionsDir(), v.version);
        try {
            fs.rmSync(dir, {
                recursive: true,
                force: true,
                maxRetries: DB.RM_MAX_RETRIES,
                retryDelay: DB.RM_RETRY_DELAY_MS,
            });
            console.error(`${LOG_PREFIX} Pruned version ${v.version}`);
        } catch (err) {
            console.error(`${LOG_PREFIX} Prune failed ${v.version}: ${err.message}`);
        }
    }
}

/**
 * Проверяет: есть ли другая версия, которую можно использовать,
 * если активная заблочена/сломана?
 * Возвращает versionId или null.
 */
export function findFallbackVersion(excludeVersion) {
    return listVersions().find(
        (v) => v.exists && v.version !== excludeVersion
    ) ?? null;
}
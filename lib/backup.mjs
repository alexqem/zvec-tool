// ─────────────────────────────────────────────
// zvec-tool · backup.mjs
// Резервные копии активной версии БД.
// ─────────────────────────────────────────────
import fs from "fs";
import path from "path";
import { DB, LOG_PREFIX } from "./constants.mjs";
import { PROJECT_ROOT, ZVEC_DIR } from "./config.mjs";
import { ensureDir } from "./paths.mjs";
import { readActiveManifest } from "./version-store.mjs";

function backupsDir() {
    return path.join(ZVEC_DIR, DB.BACKUPS_DIR);
}

function copyTree(src, dest) {
    if (!fs.existsSync(src)) return false;
    fs.cpSync(src, dest, { recursive: true, force: true });
    return true;
}

export function createBackup(label = "manual") {
    const active = readActiveManifest();
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const dir = path.join(backupsDir(), `backup-${stamp}-${label}`);
    ensureDir(dir);

    if (active?.path && fs.existsSync(active.path)) {
        copyTree(active.path, path.join(dir, DB.DB_NAME));
    }
    const activeFilePath = path.join(ZVEC_DIR, DB.ACTIVE_MANIFEST);
    if (fs.existsSync(activeFilePath)) {
        fs.copyFileSync(activeFilePath, path.join(dir, DB.ACTIVE_MANIFEST));
    }

    const manifest = {
        createdAt: new Date().toISOString(),
        label,
        projectRoot: PROJECT_ROOT,
        active,
    };
    fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf-8");
    console.error(`${LOG_PREFIX} Backup created: ${dir}`);
    return { ok: true, path: dir, manifest };
}

export function listBackups() {
    const root = backupsDir();
    if (!fs.existsSync(root)) return [];
    return fs
        .readdirSync(root, { withFileTypes: true })
        .filter((e) => e.isDirectory() && e.name.startsWith("backup-"))
        .map((e) => {
            const dir = path.join(root, e.name);
            let manifest = null;
            try { manifest = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf-8")); }
            catch {}
            return { name: e.name, path: dir, manifest };
        })
        .sort((a, b) => b.name.localeCompare(a.name));
}

export function pruneBackups(keep = DB.KEEP_BACKUPS) {
    const all = listBackups();
    for (const b of all.slice(keep)) {
        try {
            fs.rmSync(b.path, {
                recursive: true,
                force: true,
                maxRetries: DB.RM_MAX_RETRIES,
                retryDelay: DB.RM_RETRY_DELAY_MS,
            });
            console.error(`${LOG_PREFIX} Pruned backup ${b.name}`);
        } catch (err) {
            console.error(`${LOG_PREFIX} Backup prune failed: ${err.message}`);
        }
    }
}
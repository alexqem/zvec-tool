import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const files = [];

function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "node_modules" || entry.name === "tests") continue;
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(p);
        else if (/\.(mjs|js)$/.test(entry.name)) files.push(p);
    }
}

walk(root);
walk(path.join(root, "scripts"));

let failed = 0;
for (const file of files) {
    try {
        execSync(`node --check "${file}"`, { stdio: "pipe" });
        console.log("OK", path.relative(root, file));
    } catch (err) {
        failed++;
        console.error("FAIL", path.relative(root, file), err.stderr?.toString() || err.message);
    }
}

if (failed) process.exit(1);
console.log(`Lint OK: ${files.length - failed}/${files.length}`);
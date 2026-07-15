import fs from "fs";
import path from "path";

/** Strip trailing/leading whitespace — fixes Windows phantom folder names. */
export function cleanPathString(value) {
    if (typeof value !== "string") return "";
    return value.trim().replace(/^["']|["']$/g, "");
}

/** Resolve and normalize; never leave trailing spaces in path segments from env. */
export function normalizePath(input, fallback = process.cwd()) {
    const raw = cleanPathString(input || "") || fallback;
    return path.resolve(raw);
}

export function ensureDir(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
}
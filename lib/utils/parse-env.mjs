export function parseEnvList(raw, fallback = []) {
    if (!raw) return fallback;
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
        return raw.split(",").map((s) => s.trim()).filter(Boolean);
    }
    return fallback;
}

export function parseEnvInt(raw, fallback) {
    const n = Number.parseInt(raw ?? "", 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
}
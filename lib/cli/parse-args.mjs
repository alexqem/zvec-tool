// ─────────────────────────────────────────────
// zvec-tool · cli/parse-args.mjs
// Парсинг аргументов командной строки.
// ─────────────────────────────────────────────

/** Возвращает { cmd, rest } из process.argv */
export function parseCommand(argv) {
    const args = argv.slice(2);
    const cmd = args[0] || "help";
    return { cmd, rest: args.slice(1) };
}

/**
 * Парсит аргументы команды search:
 *   search <query words> [--top N] [--json]
 * Возвращает { query, topk, json }
 */
export function parseSearchArgs(argv) {
    const parts = argv.slice(2);
    let topk;
    let asJson = false;
    const cleaned = [];

    for (let i = 0; i < parts.length; i++) {
        if (parts[i] === "--top" && parts[i + 1]) {
            topk = Number.parseInt(parts[++i], 10);
        } else if (parts[i] === "--json") {
            asJson = true;
        } else {
            cleaned.push(parts[i]);
        }
    }

    return {
        query: cleaned.join(" ").trim(),
        topk: Number.isFinite(topk) ? topk : undefined,
        json: asJson,
    };
}
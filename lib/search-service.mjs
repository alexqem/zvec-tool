// ─────────────────────────────────────────────
// zvec-tool · search-service.mjs
// Семантический поиск по индексу.
// ─────────────────────────────────────────────
import { EMBED, SEARCH, TIMEOUT_MS } from "./constants.mjs";
import { getDocCount, queryCollection, withCollection } from "./db.mjs";
import { embedOneshot, embedText } from "./embed.mjs";
import { formatSearchResults, rankSearchResults } from "./search.mjs";

/**
 * Выполняет поиск по вектору.
 *
 * @param {object} opts
 * @param {string}   opts.query
 * @param {number}   [opts.topk]
 * @param {string[]} [opts.excludePaths]
 * @param {string[]} [opts.includePaths]
 * @param {boolean}  [opts.oneshot=true]  — true: spawn/kill (CLI), false: persistent worker (MCP)
 * @returns {{ ranked: object[], docCount: number }}
 */
export async function searchKnowledge({
    query,
    topk = SEARCH.TOPK_DEFAULT,
    excludePaths = [],
    includePaths = [],
    oneshot = true,
}) {
    const docCount = withCollection((col) => getDocCount(col));
    if (docCount === 0) {
        const err = new Error("Index is empty. Run: node zvec.mjs index");
        err.code = "ZVEC_EMPTY";
        throw err;
    }

    const embed = oneshot ? embedOneshot : embedText;
    const timeout = oneshot ? TIMEOUT_MS.CLI_SEARCH_EMBED : TIMEOUT_MS.MCP_SEARCH_EMBED;
    const vector = await embed(query, EMBED.KIND_QUERY, timeout);
    const results = queryCollection(vector, topk);
    const ranked = rankSearchResults(query, results, excludePaths, includePaths);
    return { ranked, docCount };
}

/** Возвращает форматированный текст для CLI. */
export async function runCliSearch(query, topk, asJson = false) {
    const { ranked, docCount } = await searchKnowledge({ query, topk, oneshot: true });
    if (asJson) return JSON.stringify({ query, docCount, results: ranked }, null, 2);
    return ranked.length === 0 ? "Nothing found." : formatSearchResults(ranked.slice(0, topk));
}
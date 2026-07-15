// ─────────────────────────────────────────────
// zvec-tool · env.mjs
// Применяет дефолты из PROJECT в process.env
// до первого импорта config.mjs.
// Вызывать в самом начале точки входа.
// ─────────────────────────────────────────────
import { PROJECT } from "./project.mjs";
import { cleanPathString } from "./paths.mjs";

export function applyProjectEnv() {
    const e = process.env;

    if (!cleanPathString(e.PROJECT_ROOT ?? ""))
        e.PROJECT_ROOT = PROJECT.root;
    else
        e.PROJECT_ROOT = cleanPathString(e.PROJECT_ROOT);

    // Каталог индексации задаётся явно (env или аргумент CLI `index <путь>`); дефолта нет.
    if (cleanPathString(e.ZVEC_INDEX_ROOT ?? ""))
        e.ZVEC_INDEX_ROOT = cleanPathString(e.ZVEC_INDEX_ROOT);

    if (!e.ZVEC_EMBEDDING_MODEL)
        e.ZVEC_EMBEDDING_MODEL = PROJECT.embedding.model;
    if (!e.ZVEC_EMBEDDING_BACKEND)
        e.ZVEC_EMBEDDING_BACKEND = PROJECT.embedding.backend;
    if (!e.ZVEC_EMBEDDING_DIMENSION)
        e.ZVEC_EMBEDDING_DIMENSION = String(PROJECT.embedding.dimension);
    if (!e.ZVEC_EMBED_QUERY_PREFIX)
        e.ZVEC_EMBED_QUERY_PREFIX = PROJECT.embedding.queryPrefix;
    if (!e.ZVEC_EMBED_DOC_PREFIX)
        e.ZVEC_EMBED_DOC_PREFIX = PROJECT.embedding.docPrefix;
    if (!e.ZVEC_EXTENSIONS)
        e.ZVEC_EXTENSIONS = JSON.stringify(PROJECT.extensions);
    if (!e.ZVEC_IGNORE_DIRS)
        e.ZVEC_IGNORE_DIRS = JSON.stringify(PROJECT.ignoreDirs);
}
# Agent Instructions

`zvec-tool` is a **CLI** for semantic search over a project knowledge base.
It vectorizes documents (regulations, process docs, notes) into a local vector DB so that
LLM assistants can retrieve relevant context **by meaning**, not by keywords.

## What gets indexed

You must tell zvec **which directory** to index — there is no hardcoded default.
Pass the path to the `index` command, or set `ZVEC_INDEX_ROOT`:

```bash
node zvec-tool/zvec.mjs index ./docs
node zvec-tool/zvec.mjs index --root ./docs
# or: ZVEC_INDEX_ROOT=./docs node zvec-tool/zvec.mjs index
```

By default only `*.md` files are indexed (`ZVEC_EXTENSIONS`). Source code, configs
(`package.json`, `tsconfig.json`, …) are not indexed unless you add their extensions.
To search source code or configs, **do not use zvec** — run a normal grep instead.

## How to search

From the project root (the parent of `zvec-tool/`):

```bash
node zvec-tool/zvec.mjs search "<query in RU or EN>" --top 8
```

Each result contains: the file path, a `score` (cosine similarity), and a 220-char preview.
Scores `> 0.7` are strong. Results are sorted by descending `score`.

## Workflow

1. For questions about business processes, regulations, or project documentation, start with `zvec search`.
2. Treat a match as useful only if it directly relates to the query; if hits are only tangential, treat the result as insufficient and refine the query.
3. If `zvec` errors or returns 0 results, say so explicitly, then do a focused grep over the relevant directories.
4. For source code, symbol names, and configs, use grep directly — zvec only indexes the configured document folder.
5. If both zvec and grep find nothing, tell the user explicitly and ask for clarification (file, symbol, module).

## CLI commands

| Command | Purpose |
|---------|---------|
| `node zvec-tool/zvec.mjs index <path>` | Build / rebuild the index of the given directory (staging → atomic promote) |
| `node zvec-tool/zvec.mjs search "<q>" [--top N] [--json]` | Semantic search (default `--top 8`) |
| `node zvec-tool/zvec.mjs status` | Index status (`docCount`, active version) |
| `node zvec-tool/zvec.mjs doctor` | Diagnostics (probes DB, shows lock holder) |
| `node zvec-tool/zvec.mjs versions` | List DB versions |
| `node zvec-tool/zvec.mjs rollback <ver-id>` | Roll back the active version |
| `node zvec-tool/zvec.mjs backups` / `backup` | List / create a backup |

## Status & diagnostics

```bash
node zvec-tool/zvec.mjs status   # docCount, active version
node zvec-tool/zvec.mjs doctor   # probe DB + lock info
```

- `docCount: 0` → index is empty: run `index <path>`.
- `exists: false` / no active version → run `index <path>`.
- Exit code `2` (`ZVEC_BUSY`) → another process holds the session lock; wait or stop it.

## Architecture (brief)

- **CLI-first.** Entry point is `zvec.mjs`. No long-running server processes, no global DB lock.
- **Windows-safe.** `withCollection(fn)` opens the collection, calls `fn`, and **closes immediately** — the DB file is never held open between calls, so `search` never blocks `index`.
- **Versioned DB.** `index` writes to a **staging** version (`versions/v-<timestamp>/`); the active DB is untouched until completion. After a successful `probeDb`, the `active.json` manifest is switched atomically (promote). An interrupted index never breaks the working DB.
- **Auto-rollback.** If the active version fails to open or is corrupt, `db.mjs` finds and switches to a previous working version (`findFallbackVersion` → `rollbackTo`).
- **Stale lock.** A dead PID in `session.lock` is detected via `kill(pid, 0)` and cleared automatically; `rmSync` retries up to 5 times to work around transient Windows locks.
- **Embeddings.** Python worker `embed_worker.py` (model `intfloat/multilingual-e5-small`, 384-dim, ~120 MB). During `index` the worker stays in memory; during CLI `search` a one-shot process is spawned and killed right after. Alternative: `embed_rubert_worker.py` for `sergeyzh/rubert-large-uncased-sts` (wired manually).

## Configuration (environment variables)

| Variable | Default | Description |
|----------|---------|-------------|
| `ZVEC_INDEX_ROOT` | _(none — required)_ | Directory to index (or pass `<path>` to `index`) |
| `PROJECT_ROOT` | parent of `zvec-tool/` | Project root |
| `ZVEC_EMBEDDING_MODEL` | `intfloat/multilingual-e5-small` | HuggingFace model |
| `ZVEC_EMBEDDING_DIMENSION` | `384` | Vector dimension |
| `ZVEC_EMBED_QUERY_PREFIX` | `query: ` | Query prefix (e5) |
| `ZVEC_EMBED_DOC_PREFIX` | `passage: ` | Document prefix (e5) |
| `ZVEC_PYTHON` | `python` | Python executable |
| `ZVEC_CHUNK_SIZE` | `1600` | Chunk size (chars) |
| `ZVEC_CHUNK_OVERLAP` | `0` | Chunk overlap |
| `ZVEC_EXTENSIONS` | `[".md"]` | Indexed file extensions |
| `ZVEC_IGNORE_DIRS` | see `lib/constants.mjs` | Ignored directories |
| `ZVEC_EXCLUDE_FILES` | see `lib/constants.mjs` | Excluded file names |
| `ZVEC_LOCK_WAIT_MS` | `30000` | Session lock wait (ms) |
| `ZVEC_EMBED_TIMEOUT_MS` | `120000` | Per-embedding timeout (ms) |
| `ZVEC_EMBED_STARTUP_MS` | `180000` | Python worker startup timeout (ms) |

All defaults live in `lib/constants.mjs` (single source of truth); env overrides are applied in `lib/config.mjs`.

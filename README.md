# zvec — CLI семантического поиска

Индексирует документы проекта (`summaries/`) в локальную векторную БД и ищет по ним по смыслу.

- **Модель:** `intfloat/multilingual-e5-small` (384 dim, ~120 МБ, через `sentence-transformers`)
- **БД:** [ZVec](https://www.npmjs.com/package/@zvec/zvec) — локальная встраиваемая векторная БД
- **Без глобальных блокировок:** БД открывается/закрывается на каждый запрос (`withCollection`), `search` не мешает `index`
- **Версионирование:** `index` пишет в staging, активная БД переключается атомарно через `active.json`; при сбое — авто-откат на предыдущую версию
- **Что индексирует:** по умолчанию `*.md` из `PROJECT_ROOT/summaries/`

---

## Требования

**Node.js ≥ 18**, **Python ≥ 3.9**, `pip install sentence-transformers`.
При первом запуске модель скачивается с HuggingFace (~120 МБ) и кешируется.

```bash
cd zvec-tool
npm install
```

---

## Быстрый старт

```bash
node zvec.mjs index                      # построить индекс по summaries/
node zvec.mjs search "учёт товаров" --top 8
node zvec.mjs status                     # docCount + активная версия
```

---

## Команды

`node zvec.mjs <command>`

| Команда | Описание |
|---------|----------|
| `index` | Полная переиндексация (`summaries/`) |
| `search <запрос>` | Семантический поиск |
| `status` | Статус индекса |
| `doctor` | Диагностика (probe DB + кто держит lock) |
| `versions` | Список версий БД |
| `rollback <ver-id>` | Откат на версию |
| `backups` / `backup` | Список / создание резервной копии |

**Поиск:** `--top N` (по умолчанию 8), `--json`. Результат: путь, `score` (косинус, `> 0.7` — сильно), превью 220 символов.

---

## Переменные окружения

Основные (дефолты — в `lib/constants.mjs`, переопределения — в `lib/config.mjs`):

- `PROJECT_ROOT` — корень проекта (по умолчанию родитель `zvec-tool/`)
- `ZVEC_INDEX_ROOT` — каталог для индексирования (по умолчанию `PROJECT_ROOT/summaries`)
- `ZVEC_EMBEDDING_MODEL` — модель (по умолчанию `intfloat/multilingual-e5-small`)
- `ZVEC_EXTENSIONS` — расширения (по умолчанию `[".md"]`)
- `ZVEC_IGNORE_DIRS` / `ZVEC_EXCLUDE_FILES` — что пропускать
- `ZVEC_CHUNK_SIZE` / `ZVEC_CHUNK_OVERLAP` — чанкинг (1600 / 0)
- `ZVEC_PYTHON` — Python-исполняемый файл

Таймауты и префиксы эмбеддингов (`ZVEC_EMBED_TIMEOUT_MS`, `ZVEC_EMBED_STARTUP_MS`, `ZVEC_EMBED_QUERY_PREFIX`, `ZVEC_EMBED_DOC_PREFIX`, `ZVEC_LOCK_WAIT_MS` и др.) — см. `lib/config.mjs`.

---

## Как устроено индексирование

1. `index` создаёт **staging**-версию в `.zvec/versions/v-<timestamp>/` — активная БД не трогается.
2. После завершения `probeDb` проверяет результат, `active.json` **атомарно** переключается (promote).
3. Хранятся 3 последние версии; при прерывании `index` рабочая БД остаётся прежней.

**Windows-safe:** файл БД не держится открытым между вызовами; мёртвый PID в `session.lock` определяется через `kill(pid, 0)` и сбрасывается; `rmSync` ретраится до 5 раз.

---

## Диагностика

```bash
node zvec.mjs doctor     # открывает БД, показывает docCount и держателя lock
```

| Симптом | Решение |
|---------|---------|
| `ZVEC_BUSY` (exit 2) | Другой процесс держит lock — подождать или завершить |
| `docCount: 0` | Запустить `node zvec.mjs index` |
| `Embed worker not found` | Проверить наличие `embed_worker.py` |
| `sentence-transformers not found` | `pip install sentence-transformers` |
| Lock не сбрасывается | Удалить `.zvec/session.lock` вручную |

---

## Cursor и AI-агенты

- **Cursor:** правило `.cursor/rules/zvec.mdc` — скопируйте в `<project>/.cursor/rules/`.
- **Прочие агенты** (Claude Code, opencode и т.п.): инструкции в `AGENTS.md` — описывают CLI и процесс поиска без MCP.

> `embed_rubert_worker.py` — опциональный воркер под `sergeyzh/rubert-large-uncased-sts`; по умолчанию не подключается, модель берётся из `ZVEC_EMBEDDING_MODEL`.

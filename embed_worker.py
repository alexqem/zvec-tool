#!/usr/bin/env python3
"""
zvec embed_worker.py — долгоживущий воркер для получения векторных эмбеддингов.

Модель: intfloat/multilingual-e5-small (384 dim, ~120 MB)
Протокол: JSON Lines через stdin/stdout

  IN:  {"id": 1, "text": "...", "kind": "query"|"document"}
  OUT: {"id": 1, "vector": [float, ...], "dim": 384}
  ERR: {"id": 1, "error": "message"}

Готовность сигнализируется строкой в stderr: "Ready, dim=384"

Окружение:
  ZVEC_EMBEDDING_MODEL       — HuggingFace model id
  ZVEC_EMBED_QUERY_PREFIX    — префикс для query ("query: ")
  ZVEC_EMBED_DOC_PREFIX      — префикс для document ("passage: ")
"""
import json
import os
import sys

MODEL_NAME = os.environ.get("ZVEC_EMBEDDING_MODEL", "intfloat/multilingual-e5-small")
QUERY_PREFIX = os.environ.get("ZVEC_EMBED_QUERY_PREFIX", "query: ")
DOC_PREFIX = os.environ.get("ZVEC_EMBED_DOC_PREFIX", "passage: ")

# Сигнализируем Node.js о готовности этой строкой
READY_MARKER = "Ready, dim="


def apply_prefix(text: str, kind: str) -> str:
    if kind == "query":
        return f"{QUERY_PREFIX}{text}" if QUERY_PREFIX else text
    return f"{DOC_PREFIX}{text}" if DOC_PREFIX else text


def main() -> None:
    sys.stderr.write(f"[embed-worker] Loading {MODEL_NAME}...\n")
    sys.stderr.flush()

    try:
        from sentence_transformers import SentenceTransformer
    except ImportError:
        sys.stderr.write(
            "[embed-worker] ERROR: sentence-transformers not found.\n"
            "[embed-worker] Install: pip install sentence-transformers\n"
        )
        sys.stderr.flush()
        sys.exit(1)

    model = SentenceTransformer(MODEL_NAME)
    dim = model.get_embedding_dimension()

    # Node.js ждёт эту строку (EMBED.READY_MARKER в constants.mjs)
    sys.stderr.write(f"[embed-worker] {READY_MARKER}{dim}\n")
    sys.stderr.flush()

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        req_id = None
        try:
            req = json.loads(line)
            req_id = req.get("id")
            text = req.get("text", "")
            kind = req.get("kind", "document")

            if not isinstance(text, str) or not text.strip():
                raise ValueError("empty or non-string text")

            prepared = apply_prefix(text, kind)
            vector = model.encode(prepared, normalize_embeddings=True).tolist()

            out = {"id": req_id, "vector": vector, "dim": dim}
            sys.stdout.write(json.dumps(out, ensure_ascii=False) + "\n")
            sys.stdout.flush()

        except Exception as exc:  # noqa: BLE001
            err = {"id": req_id, "error": str(exc)}
            sys.stdout.write(json.dumps(err, ensure_ascii=False) + "\n")
            sys.stdout.flush()


if __name__ == "__main__":
    main()
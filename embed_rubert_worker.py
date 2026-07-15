#!/usr/bin/env python3
"""Long-running embedding worker for sergeyzh/rubert-large-uncased-sts.

Protocol (stdin/stdout, one JSON object per line):
  IN:  {"id": 1, "text": "..."}
  OUT: {"id": 1, "vector": [float, ...]}
  ERR: {"id": 1, "error": "message"}
"""
import json
import sys

MODEL_NAME = "sergeyzh/rubert-large-uncased-sts"


def main() -> None:
    sys.stderr.write(f"[rubert-worker] Loading {MODEL_NAME}...\n")
    sys.stderr.flush()
    from sentence_transformers import SentenceTransformer

    model = SentenceTransformer(MODEL_NAME)
    dim = model.get_embedding_dimension()
    sys.stderr.write(f"[rubert-worker] Ready, dim={dim}\n")
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
            if not isinstance(text, str) or not text.strip():
                raise ValueError("empty text")
            vector = model.encode(text, normalize_embeddings=True).tolist()
            out = {"id": req_id, "vector": vector, "dim": dim}
            sys.stdout.write(json.dumps(out, ensure_ascii=False) + "\n")
            sys.stdout.flush()
        except Exception as exc:  # noqa: BLE001
            err = {"id": req_id, "error": str(exc)}
            sys.stdout.write(json.dumps(err, ensure_ascii=False) + "\n")
            sys.stdout.flush()


if __name__ == "__main__":
    main()
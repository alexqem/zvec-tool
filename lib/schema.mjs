// ─────────────────────────────────────────────
// zvec-tool · schema.mjs
// Схема ZVec-коллекции.
// ─────────────────────────────────────────────
import {
    ZVecCollectionSchema,
    ZVecDataType,
    ZVecIndexType,
    ZVecMetricType,
} from "@zvec/zvec";
import { FIELD } from "./constants.mjs";
import { EMBEDDING_DIMENSION } from "./config.mjs";

export function createCollectionSchema() {
    return new ZVecCollectionSchema({
        name: FIELD.COLLECTION_NAME,
        fields: [
            { name: FIELD.TEXT, dataType: ZVecDataType.STRING },
            { name: FIELD.PATH, dataType: ZVecDataType.STRING },
            { name: FIELD.LANG, dataType: ZVecDataType.STRING },
        ],
        vectors: [
            {
                name: FIELD.VECTOR,
                dataType: ZVecDataType.VECTOR_FP32,
                dimension: EMBEDDING_DIMENSION,
                indexParams: {
                    indexType: ZVecIndexType.HNSW,
                    metricType: ZVecMetricType.COSINE,
                },
            },
        ],
    });
}
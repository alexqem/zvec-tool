export function normalizeQueryResults(response) {
    if (!response) return [];
    if (Array.isArray(response)) return response;
    if (Array.isArray(response.results)) return response.results;
    if (Array.isArray(response.documents)) return response.documents;
    return [];
}
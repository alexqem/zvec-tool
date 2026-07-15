export function chunkText(text, size, overlap) {
    if (!text || text.length <= size) return [text];
    const chunks = [];
    let start = 0;
    while (start < text.length) {
        const end = Math.min(start + size, text.length);
        chunks.push(text.slice(start, end));
        if (end >= text.length) break;
        start = Math.max(0, end - overlap);
        if (start === end) start = end;
    }
    return chunks;
}
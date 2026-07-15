export function escapeFilterValue(value) {
    return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
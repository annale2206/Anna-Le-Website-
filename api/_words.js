// api/_words.js  (files starting with "_" are helpers, not routes)
//
// The visitor's own words from the identity machine page. Kept short and
// plain so they shape the portrait and videos without replacing the
// instructions that protect the visitor's likeness.
export function cleanVisitorWords(text) {
  return String(text || '')
    .replace(/[\u0000-\u001f\u007f<>"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

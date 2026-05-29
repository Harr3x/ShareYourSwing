import { getScoreClass } from '../utils/golf.js';

// Returns an HTML string for a score cell.
// strokes: number | null, par: number
export function scoreCellHTML(strokes, par) {
  if (strokes == null) return '<span class="golf-par" style="color:#bbb">—</span>';
  const cls = getScoreClass(strokes, par);
  return `<span class="${cls}">${strokes}</span>`;
}

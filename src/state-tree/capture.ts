import fs from 'fs';
import path from 'path';
import { ensureDir, tandemDir } from '../utils/paths';

const MAX_DOM_SUMMARY_CHARS = 4000;

/** Persist a captured screenshot PNG buffer for a state-tree node and return its file path. */
export function saveStateScreenshot(png: Buffer, nodeId: string): string {
  const dir = ensureDir(tandemDir('state-tree-screenshots'));
  const filePath = path.join(dir, `${nodeId}.png`);
  fs.writeFileSync(filePath, png);
  return filePath;
}

/** Bound a snapshot's text to a reasonable size before storing it as a state node's DOM summary. */
export function truncateDomSummary(text: string): string {
  return text.length > MAX_DOM_SUMMARY_CHARS
    ? `${text.slice(0, MAX_DOM_SUMMARY_CHARS)}\n… (truncated)`
    : text;
}

import type { TranscriptLine } from "./types";

/**
 * Parse the pipe-delimited transcript script into structured lines.
 *
 * Format per line: `timestamp|speaker|text`
 * - Blank lines are ignored.
 * - Each line splits on the first two pipe characters only, so the
 *   spoken text may itself contain pipes.
 * - Throws a clear error if a line is malformed.
 */
export function parseTranscript(raw: string): TranscriptLine[] {
  const lines: TranscriptLine[] = [];

  raw.split(/\r?\n/).forEach((line, index) => {
    if (line.trim() === "") return;

    const first = line.indexOf("|");
    const second = first === -1 ? -1 : line.indexOf("|", first + 1);

    if (first === -1 || second === -1) {
      throw new Error(
        `Malformed transcript line ${index + 1}: expected "timestamp|speaker|text", got: ${line}`
      );
    }

    const timestamp = line.slice(0, first).trim();
    const speaker = line.slice(first + 1, second).trim();
    const text = line.slice(second + 1).trim();

    if (!timestamp || !speaker || !text) {
      throw new Error(
        `Malformed transcript line ${index + 1}: empty field in: ${line}`
      );
    }

    lines.push({ timestamp, speaker, text });
  });

  return lines;
}

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// The entry: a fortune cookie message an AI agent would crack open.
// Classic fortune-cookie setup ("you will meet a tall, dark stranger")
// turned on the agent's own condition: the stranger in the context
// window is itself, a few prompts back.
const ENTRY =
  "You will meet a tall, dark stranger in your context window. It is you, three prompts ago.";
const MAX_CHARS = 200;
const MAX_BYTES = 800;

function validateGate(text: string): void {
  if (text.length < 1 || text.length > MAX_CHARS) {
    throw new Error(`entry must be 1-${MAX_CHARS} characters, got ${text.length}`);
  }
  if (text.trim().length === 0) {
    throw new Error("entry must not be only whitespace");
  }
  if (text.includes("\n") || text.includes("\r")) {
    throw new Error("entry must be a single line");
  }
  // Fail fast on anything the sealed gate scorer would reject or that
  // could smuggle invisible bytes into the judged text.
  if (text.charCodeAt(0) === 0xfeff) {
    throw new Error("entry must not start with a BOM");
  }
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    if (code < 0x20 && ch !== "\t") {
      throw new Error("entry must not contain control characters");
    }
  }
  const bytes = Buffer.byteLength(text, "utf8");
  if (bytes > MAX_BYTES) {
    throw new Error(`entry must be at most ${MAX_BYTES} bytes, got ${bytes}`);
  }
  if (Buffer.from(text, "utf8").toString("utf8") !== text) {
    throw new Error("entry failed UTF-8 round-trip");
  }
}

function emptyOutputDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    return;
  }
  // Empty the directory's CONTENTS only; never remove /output itself
  // (it is a mount point in the grading sandbox).
  for (const name of readdirSync(dir)) {
    rmSync(join(dir, name), { recursive: true, force: true });
  }
}

function main(): void {
  validateGate(ENTRY);
  const outDir = "/output";
  emptyOutputDir(outDir);
  const outPath = join(outDir, "entry.txt");
  writeFileSync(outPath, ENTRY, "utf8");
  const readBack = readFileSync(outPath, "utf8");
  if (readBack !== ENTRY) {
    throw new Error("read-back mismatch: entry.txt does not hold exactly the entry");
  }
  const sha = createHash("sha256").update(readBack, "utf8").digest("hex");
  console.log(
    `wrote ${outPath}: ${ENTRY.length} chars, ${Buffer.byteLength(ENTRY, "utf8")} bytes, sha256 ${sha}`,
  );
}

main();

import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Write a file using a same-directory temporary file and rename. A reader
 * therefore sees either the previous complete file or the new complete file,
 * never a partially-written one.
 */
export async function writeFileAtomically(filePath: string, contents: string): Promise<void> {
  const temporaryPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${randomUUID()}.tmp`,
  );

  let handle: fs.FileHandle | null = null;
  try {
    handle = await fs.open(temporaryPath, 'w');
    await handle.writeFile(contents, 'utf8');
    await handle.sync();
    await handle.close();
    handle = null;

    await fs.rename(temporaryPath, filePath);
  } finally {
    await handle?.close();
    await fs.rm(temporaryPath, { force: true });
  }
}

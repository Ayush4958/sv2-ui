import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { constants, open } from 'node:fs/promises';
import { promisify } from 'node:util';

/**
 * Run with a specific process umask and restore the previous one afterwards,
 * so tests can exercise permission handling deterministically.
 */
export async function withUmask(mask: number, run: () => Promise<void>): Promise<void> {
  const previousUmask = process.umask(mask);
  try {
    await run();
  } finally {
    process.umask(previousUmask);
  }
}

/**
 * Node has no mkfifo API, so create FIFOs through the command-line tool.
 * Created world-writable to mimic what an attacker with directory access
 * could plant.
 */
export async function createFifo(filePath: string): Promise<void> {
  await promisify(execFile)('mkfifo', ['-m', '666', filePath]);
}

export type FifoRaceOutcome<T> =
  | { kind: 'result'; value: T }
  | { kind: 'error'; error: unknown }
  | { kind: 'timed-out' };

/**
 * Race a file-reading call against a short timeout, so a reader that opens a
 * planted FIFO without O_NONBLOCK cannot wedge the test process. On a timeout
 * (a stalled runner, or a genuine regression) unblock the reader by opening
 * the FIFO's write side with O_NONBLOCK; ENXIO means there is no blocked
 * reader left to release.
 */
export async function raceFifoTimeout<T>(
  filePath: string,
  run: () => Promise<T>,
  timeoutMs = 250,
): Promise<FifoRaceOutcome<T>> {
  let timeoutId: NodeJS.Timeout | undefined;

  try {
    const outcome = await Promise.race([
      run().then(
        (value): FifoRaceOutcome<T> => ({ kind: 'result', value }),
        (error: unknown): FifoRaceOutcome<T> => ({ kind: 'error', error }),
      ),
      new Promise<FifoRaceOutcome<T>>((resolve) => {
        timeoutId = setTimeout(() => resolve({ kind: 'timed-out' }), timeoutMs);
        timeoutId.unref();
      }),
    ]);

    if (outcome.kind === 'timed-out') {
      try {
        const writer = await open(filePath, constants.O_WRONLY | constants.O_NONBLOCK);
        await writer.writeFile('attacker-controlled input');
        await writer.close();
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENXIO') throw error;
      }
    }

    return outcome;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Assert that a reader rejects promptly with the expected error when a FIFO
 * sits at its path, instead of blocking or accepting the planted file.
 */
export async function assertRejectsOnPlantedFifo(
  filePath: string,
  run: () => Promise<unknown>,
  expectedError: abstract new (message: string, options?: ErrorOptions) => Error,
): Promise<void> {
  const outcome = await raceFifoTimeout(filePath, run);

  if (outcome.kind === 'timed-out') {
    assert.fail('the reader blocked on a planted FIFO');
  }
  if (outcome.kind !== 'error') {
    assert.fail(`expected a rejection, got a result: ${JSON.stringify(outcome.value)}`);
  }
  assert.ok(
    outcome.error instanceof expectedError,
    `expected ${expectedError.name}, got ${outcome.error}`,
  );
}

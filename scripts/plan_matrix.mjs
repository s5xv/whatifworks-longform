#!/usr/bin/env node
/**
 * Reads total durationInFrames for a Remotion composition and splits 0..(totalFrames-1)
 * into N equal `--frames=start-end` chunks (clamped to 1..20 workers) for GitHub Actions matrix.
 */
import fs from 'node:fs';
import path from 'node:path';
import { bundle } from '@remotion/bundler';
import { selectComposition } from '@remotion/renderer';

const compositionId = process.env.COMPOSITION || process.argv[2] || 'LongFormMain';
const requestedWorkers = parseInt(process.env.WORKERS || process.argv[3] || '15', 10);
const workersCap = Math.max(1, Math.min(20, Number.isFinite(requestedWorkers) ? requestedWorkers : 15));

const entryPoint = path.resolve('longform/index.ts');
const serveUrl = await bundle({ entryPoint });
const comp = await selectComposition({ serveUrl, id: compositionId });

const totalFrames = comp.durationInFrames;
if (!Number.isInteger(totalFrames) || totalFrames <= 0) {
  throw new Error(`Invalid durationInFrames (${totalFrames}) for composition "${compositionId}"`);
}

const actualWorkers = Math.min(workersCap, totalFrames);
const baseChunk = Math.floor(totalFrames / actualWorkers);
const remainder = totalFrames % actualWorkers;

const matrix = [];
let cursor = 0;
for (let i = 0; i < actualWorkers; i++) {
  const count = baseChunk + (i < remainder ? 1 : 0);
  const start = cursor;
  const end = cursor + count - 1;
  cursor = end + 1;
  matrix.push({
    index: i,
    padded: String(i).padStart(3, '0'),
    start,
    end,
    frames: count,
  });
}

const payload = JSON.stringify(matrix);
console.error(`[plan] composition=${compositionId} totalFrames=${totalFrames} workers=${actualWorkers}`);
console.log(payload);

if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `matrix=${payload}\n`);
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `total_frames=${totalFrames}\n`);
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `worker_count=${actualWorkers}\n`);
}

#!/usr/bin/env node
/**
 * Pre-flight QA gate for whatifworks-longform.
 * Fails fast before git push / cloud render if:
 *  1. `tsc --noEmit` fails
 *  2. Any chapter's manifest `durationSec` mismatches its actual audio length by > 1.5s
 *  3. Any chapter is missing `words.json` or has 0 aligned words
 *  4. Any chapter's 1-frame luma check drops below mean brightness >= 55
 *
 * Usage:
 *   node scripts/qa_longform.mjs [--chapter ch01] [--skip-luma]
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';

const ROOT_DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
process.chdir(ROOT_DIR);

const args = process.argv.slice(2);
let filterChapter = null;
let skipLuma = false;

for (let i = 0; i < args.length; i++) {
  if ((args[i] === '--chapter' || args[i] === '-c') && args[i + 1]) {
    filterChapter = args[++i];
  } else if (args[i] === '--skip-luma') {
    skipLuma = true;
  }
}
if (filterChapter === 'LongFormMain') {
  filterChapter = null;
}

const errors = [];
const fail = (msg) => {
  errors.push(msg);
  console.error(`[QA FAIL] ${msg}`);
};

console.log('[qa_longform] 1/3 Running TypeScript check (tsc --noEmit)...');
try {
  execFileSync('npx', ['tsc', '--noEmit'], { stdio: 'inherit' });
} catch {
  fail('TypeScript compilation failed (`npx tsc --noEmit`).');
  process.exit(1);
}

const manifestPath = path.join(ROOT_DIR, 'longform', 'manifest.json');
if (!fs.existsSync(manifestPath)) {
  fail(`Missing manifest: ${manifestPath}`);
  process.exit(1);
}
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const minMeanBrightness = manifest.daylightRules?.minMeanBrightness ?? 55;
const chapters = (manifest.chapters || []).filter(
  (ch) => !filterChapter || ch.id === filterChapter
);

if (chapters.length === 0) {
  fail(`No matching chapters found in manifest.json (filter=${filterChapter ?? 'ALL'}).`);
  process.exit(1);
}

console.log(`[qa_longform] 2/3 Checking audio duration & words.json for ${chapters.length} chapter(s)...`);
for (const ch of chapters) {
  if (!ch.audio) {
    fail(`Chapter "${ch.id}": manifest.json audio is null/missing.`);
  } else {
    const audioFile = path.join(ROOT_DIR, 'public', ch.audio);
    if (!fs.existsSync(audioFile)) {
      fail(`Chapter "${ch.id}": missing audio file public/${ch.audio}.`);
    } else {
      try {
        const out = execFileSync(
          'ffprobe',
          ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', audioFile],
          { encoding: 'utf8' }
        ).trim();
        const actualDur = parseFloat(out);
        const manifestDur = Number(ch.durationSec);
        const diff = Math.abs(manifestDur - actualDur);
        if (!Number.isFinite(actualDur)) {
          fail(`Chapter "${ch.id}": could not parse ffprobe duration for public/${ch.audio}.`);
        } else if (diff > 1.5) {
          fail(
            `Chapter "${ch.id}": durationSec (${manifestDur}s) mismatches public/${ch.audio} (${actualDur.toFixed(2)}s) by ${diff.toFixed(2)}s (> 1.5s limit).`
          );
        } else {
          console.log(
            `  [ok] ${ch.id}: audio=${actualDur.toFixed(2)}s vs manifest=${manifestDur}s (diff=${diff.toFixed(2)}s)`
          );
        }
      } catch (err) {
        fail(`Chapter "${ch.id}": ffprobe failed on public/${ch.audio}: ${err.message}`);
      }
    }
  }

  if (!ch.words) {
    fail(`Chapter "${ch.id}": manifest.json words is null/missing.`);
  } else {
    const wordsFile = path.join(ROOT_DIR, 'public', ch.words);
    if (!fs.existsSync(wordsFile)) {
      fail(`Chapter "${ch.id}": missing words file public/${ch.words}.`);
    } else {
      try {
        const parsed = JSON.parse(fs.readFileSync(wordsFile, 'utf8'));
        if (!Array.isArray(parsed) || parsed.length === 0) {
          fail(`Chapter "${ch.id}": public/${ch.words} has 0 aligned words.`);
        } else {
          console.log(`  [ok] ${ch.id}: ${parsed.length} aligned words in public/${ch.words}`);
        }
      } catch (err) {
        fail(`Chapter "${ch.id}": invalid JSON in public/${ch.words}: ${err.message}`);
      }
    }
  }
}

if (errors.length > 0) {
  console.error(`\n[qa_longform] Aborted with ${errors.length} error(s) before luma render.`);
  process.exit(1);
}

if (!skipLuma) {
  console.log(`[qa_longform] 3/3 Running 1-frame-per-chapter luma check (min mean brightness >= ${minMeanBrightness})...`);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qa_longform_'));
  try {
    const entryPoint = path.join(ROOT_DIR, 'longform', 'index.ts');
    const serveUrl = await bundle({ entryPoint });

    for (const ch of chapters) {
      const comp = await selectComposition({ serveUrl, id: ch.id });
      const sampleFrame = Math.min(
        Math.max(0, comp.durationInFrames - 1),
        Math.max(15, Math.round(comp.durationInFrames * 0.35))
      );
      const outPng = path.join(tmpDir, `${ch.id}.png`);
      await renderStill({
        composition: comp,
        serveUrl,
        frame: sampleFrame,
        output: outPng,
        chromiumOptions: { gl: 'swangle' },
      });

      const rawRgb = execFileSync(
        'ffmpeg',
        ['-v', 'error', '-i', outPng, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
        { maxBuffer: 64 * 1024 * 1024 }
      );
      const pixelCount = Math.floor(rawRgb.length / 3);
      let lumaSum = 0;
      for (let i = 0; i < pixelCount * 3; i += 3) {
        lumaSum += 0.299 * rawRgb[i] + 0.587 * rawRgb[i + 1] + 0.114 * rawRgb[i + 2];
      }
      const meanLuma = pixelCount > 0 ? lumaSum / pixelCount : 0;
      if (meanLuma < minMeanBrightness) {
        fail(
          `Chapter "${ch.id}" frame ${sampleFrame}: mean brightness ${meanLuma.toFixed(1)} < ${minMeanBrightness} (crushed/dark scene).`
        );
      } else {
        console.log(`  [ok] ${ch.id} frame ${sampleFrame}: mean brightness = ${meanLuma.toFixed(1)} / 255`);
      }
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

if (errors.length > 0) {
  console.error(`\n[qa_longform] FAILED with ${errors.length} error(s).`);
  process.exit(1);
}

console.log('\n[qa_longform] ALL CHECKS PASSED.');

#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { inspectMp4 } from './demo-evidence-core.mjs';
import { parseGuidedDemoPayload } from './guided-demo-core.mjs';

const options = parseArgs(process.argv.slice(2));
for (const field of ['input', 'output', 'log', 'result-frame']) {
  if (!options[field]) throw new Error(`--${field} is required`);
}

const input = path.resolve(options.input);
const output = path.resolve(options.output);
const resultFrame = path.resolve(options['result-frame']);
if (input === output) throw new Error('--input and --output must be different files');

const rawReport = inspectMp4(readFileSync(input));
if (rawReport.status !== 'passed') {
  throw new Error(`raw recording is not a valid timed MP4: ${rawReport.error}`);
}
const trimStartSeconds = options['trim-start-seconds']
  ? Number(options['trim-start-seconds'])
  : 0;
if (
  !Number.isFinite(trimStartSeconds) ||
  trimStartSeconds < 0 ||
  trimStartSeconds >= rawReport.durationSeconds
) {
  throw new Error('--trim-start-seconds must be within the raw recording');
}
const walkthrough = parseGuidedDemoPayload(readFileSync(path.resolve(options.log), 'utf8'));
const targetDurationSeconds = walkthrough.durationMs / 1_000;
if (
  !Number.isInteger(walkthrough.durationMs) ||
  targetDurationSeconds < 18 ||
  targetDurationSeconds > 30
) {
  throw new Error('guided walkthrough duration must be between 18 and 30 seconds');
}

// Both simctl recordVideo and adb screenrecord can omit repeated frames while
// the UI is static. Rescale the recorded walkthrough to the independently
// logged wall-clock duration, then hold the exact final native screenshot long
// enough to make the before/after result useful to a viewer.
const resultFrameHoldSeconds = 6;
const movingDurationSeconds = targetDurationSeconds - resultFrameHoldSeconds;
const trimmedDurationSeconds = rawReport.durationSeconds - trimStartSeconds;
const timestampScale = movingDurationSeconds / trimmedDurationSeconds;
const result = spawnSync(
  'ffmpeg',
  [
    '-hide_banner',
    '-loglevel', 'error',
    '-y',
    '-i', input,
    '-loop', '1',
    '-framerate', '15',
    '-t', String(resultFrameHoldSeconds),
    '-i', resultFrame,
    '-filter_complex',
    `[0:v]trim=start=${trimStartSeconds},setpts=${timestampScale.toFixed(9)}*(PTS-STARTPTS),` +
      'fps=15,format=yuv420p,setsar=1[walkthrough];' +
      `[1:v]scale=${rawReport.width}:${rawReport.height}:flags=lanczos,` +
      'fps=15,format=yuv420p,setsar=1,setpts=PTS-STARTPTS[result];' +
      '[walkthrough][result]concat=n=2:v=1:a=0[video]',
    '-map', '[video]',
    '-an',
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '23',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    output,
  ],
  { encoding: 'utf8' }
);
if (result.status !== 0) {
  const failure = result.error?.message ?? result.stderr?.trim() ?? 'unknown ffmpeg failure';
  throw new Error(`ffmpeg timestamp normalization failed: ${failure}`);
}

const versionResult = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
const ffmpegVersion = versionResult.stdout?.split('\n')[0]?.trim() ?? 'ffmpeg version unknown';

const normalizedReport = inspectMp4(readFileSync(output));
if (normalizedReport.status !== 'passed') {
  throw new Error(`normalized recording is not a valid timed MP4: ${normalizedReport.error}`);
}
if (
  normalizedReport.durationSeconds < 18 ||
  normalizedReport.durationSeconds > 30 ||
  Math.abs(normalizedReport.durationSeconds - targetDurationSeconds) > 0.5
) {
  throw new Error('normalized recording duration does not match the guided walkthrough');
}

process.stdout.write(`${JSON.stringify({
  rawDurationSeconds: rawReport.durationSeconds,
  width: rawReport.width,
  height: rawReport.height,
  trimStartSeconds,
  trimmedDurationSeconds,
  targetDurationSeconds,
  normalizedDurationSeconds: normalizedReport.durationSeconds,
  timestampScale,
  resultFrameHoldSeconds,
  ffmpegVersion,
})}\n`);

function parseArgs(values) {
  const parsed = {};
  const normalizedValues = values.filter((value) => value !== '--');
  for (let index = 0; index < normalizedValues.length; index += 2) {
    const flag = normalizedValues[index];
    const value = normalizedValues[index + 1];
    if (!flag?.startsWith('--') || !value) {
      throw new Error(`invalid argument: ${flag ?? ''}`);
    }
    parsed[flag.slice(2)] = value;
  }
  return parsed;
}

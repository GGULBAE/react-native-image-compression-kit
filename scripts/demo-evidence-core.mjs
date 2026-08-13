import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { inspectGuidedDemoPayload } from './guided-demo-core.mjs';
import { inspectDemoVisualAgreement } from './demo-visual-agreement-core.mjs';

export function inspectDemoEvidence(root, manifest) {
  const errors = [];
  const schemaVersion = manifest?.schemaVersion;
  if (schemaVersion !== 1 && schemaVersion !== 2 && schemaVersion !== 3) {
    errors.push('schemaVersion must be 1, 2, or 3');
  }
  if (!/^\d+\.\d+\.\d+$/.test(manifest?.packageVersion ?? '')) {
    errors.push('packageVersion must be an exact semantic version');
  }
  if (!/^[0-9a-f]{40}$/.test(manifest?.sourceCommit ?? '')) {
    errors.push('sourceCommit must be a lowercase full commit SHA');
  }
  if (manifest?.sourceProvenance !== undefined) {
    if (
      manifest.sourceProvenance?.kind !== 'post-release' ||
      !/^[0-9a-f]{40}$/.test(
        manifest.sourceProvenance?.releaseSourceCommit ?? ''
      ) ||
      manifest.sourceProvenance.releaseSourceCommit === manifest.sourceCommit
    ) {
      errors.push('sourceProvenance must disclose a distinct post-release capture source');
    }
  }
  const cases = Array.isArray(manifest?.cases) ? manifest.cases : [];
  const platforms = cases.map(({ platform }) => platform).sort();
  if (JSON.stringify(platforms) !== JSON.stringify(['android', 'ios'])) {
    errors.push('evidence must contain exactly one Android and one iOS case');
  }
  const derivedEvidenceStatus = schemaVersion === 3
    ? deriveEvidenceStatus(cases)
    : 'passed';
  if (
    !['passed', 'affected'].includes(manifest?.status) ||
    (schemaVersion === 3 && manifest?.status !== derivedEvidenceStatus) ||
    (schemaVersion !== 3 && manifest?.status !== 'passed')
  ) {
    errors.push('status does not match the derived case outcomes');
  }

  for (const evidence of cases) {
    const label = evidence?.platform ?? 'unknown';
    if (evidence?.schemaVersion !== schemaVersion) {
      errors.push(`${label}: schemaVersion does not match the manifest`);
    }
    const allowedStatuses = schemaVersion === 3
      ? ['passed', 'affected']
      : ['passed'];
    if (!allowedStatuses.includes(evidence?.status)) {
      errors.push(`${label}: status must be ${allowedStatuses.join(' or ')}`);
    }
    if (evidence?.packageVersion !== manifest.packageVersion) {
      errors.push(`${label}: packageVersion does not match the manifest`);
    }
    if (evidence?.sourceCommit !== manifest.sourceCommit) {
      errors.push(`${label}: sourceCommit does not match the manifest`);
    }
    if (!Number.isFinite(Date.parse(evidence?.capturedAt ?? ''))) {
      errors.push(`${label}: capturedAt must be an ISO timestamp`);
    }
    if (!/^https:\/\/github\.com\/GGULBAE\/react-native-image-compression-kit\/actions\/runs\/\d+$/.test(evidence?.runUrl ?? '')) {
      errors.push(`${label}: runUrl must identify the capture workflow run`);
    }
    if (!evidence?.runtime || !evidence?.device) {
      errors.push(`${label}: runtime and device are required`);
    }
    if (
      evidence?.options?.output?.format !== 'jpeg' ||
      evidence?.options?.output?.maxBytes !== 8_000 ||
      evidence?.options?.metadata !== 'safe'
    ) {
      errors.push(`${label}: deterministic JPEG options drifted`);
    }
    if (
      evidence?.result?.format !== 'jpeg' ||
      !positiveInteger(evidence?.result?.width) ||
      !positiveInteger(evidence?.result?.height) ||
      !positiveInteger(evidence?.result?.byteSize) ||
      !positiveInteger(evidence?.result?.originalByteSize) ||
      typeof evidence?.result?.compressionRatio !== 'number' ||
      evidence.result.compressionRatio <= 0
    ) {
      errors.push(`${label}: native result metrics are invalid`);
    }
    if (
      evidence?.result?.byteSize >= evidence?.result?.originalByteSize ||
      evidence?.result?.compressionRatio >= 1
    ) {
      errors.push(`${label}: demo output must be smaller than its source`);
    }

    const expectedAssets = [
      ['source', 'jpeg'],
      ['output', 'jpeg'],
      ['screenshot', 'png'],
      ...(schemaVersion >= 2 ? [['recording', 'mp4']] : []),
    ];
    for (const [assetName, magic] of expectedAssets) {
      const asset = evidence?.assets?.[assetName];
      const relativePath = asset?.file;
      if (
        typeof relativePath !== 'string' ||
        relativePath.startsWith('/') ||
        relativePath.includes('..')
      ) {
        errors.push(`${label}: ${assetName} file path is invalid`);
        continue;
      }
      const filePath = path.resolve(root, relativePath);
      if (!filePath.startsWith(`${path.resolve(root)}${path.sep}`) || !existsSync(filePath)) {
        errors.push(`${label}: ${assetName} file is missing`);
        continue;
      }
      const bytes = readFileSync(filePath);
      if (statSync(filePath).size !== asset.byteSize) {
        errors.push(`${label}: ${assetName} byte size mismatch`);
      }
      if (sha256(bytes) !== asset.sha256) {
        errors.push(`${label}: ${assetName} SHA-256 mismatch`);
      }
      if (magic === 'jpeg' && !(bytes[0] === 0xff && bytes[1] === 0xd8)) {
        errors.push(`${label}: ${assetName} is not JPEG`);
      }
      if (magic === 'png' && !isPng(bytes)) {
        errors.push(`${label}: ${assetName} is not PNG`);
      }
      if (magic === 'mp4') {
        const mp4 = inspectMp4(bytes);
        if (mp4.status !== 'passed') {
          errors.push(`${label}: recording is not a valid timed MP4`);
        } else if (
          typeof asset.durationSeconds !== 'number' ||
          Math.abs(asset.durationSeconds - mp4.durationSeconds) > 0.01
        ) {
          errors.push(`${label}: recording duration does not match MP4 metadata`);
        }
        if (
          typeof asset.durationSeconds !== 'number' ||
          asset.durationSeconds < 18 ||
          asset.durationSeconds > 30
        ) {
          errors.push(`${label}: recording duration must be between 18 and 30 seconds`);
        }
        if (
          typeof asset.captureMethod !== 'string' ||
          !asset.captureMethod.toLowerCase().includes(label)
        ) {
          errors.push(`${label}: recording capture method must identify its platform`);
        }
      }
    }

    if (evidence?.assets?.source?.byteSize !== evidence?.result?.originalByteSize) {
      errors.push(`${label}: source bytes do not match originalByteSize`);
    }
    if (evidence?.assets?.output?.byteSize !== evidence?.result?.byteSize) {
      errors.push(`${label}: output bytes do not match byteSize`);
    }
    if (schemaVersion >= 2) {
      const walkthrough = inspectGuidedDemoPayload(evidence?.walkthrough, {
        platform: label,
        options: evidence?.options,
        result: evidence?.result,
      });
      if (walkthrough.status !== 'passed') {
        errors.push(`${label}: ${walkthrough.error}`);
      }
      const visualAgreementRequired =
        schemaVersion === 3 ||
        evidence?.sourceCommit !== '11b91af66322d7b98b46481739c54825b406ef0c';
      if (evidence?.visualAgreement !== undefined) {
        const sourcePath = path.resolve(
          root,
          evidence?.assets?.source?.file ?? ''
        );
        const outputPath = path.resolve(
          root,
          evidence?.assets?.output?.file ?? ''
        );
        if (existsSync(sourcePath) && existsSync(outputPath)) {
          const visual = inspectDemoVisualAgreement(evidence.visualAgreement, {
            sourceBytes: readFileSync(sourcePath),
            outputBytes: readFileSync(outputPath),
            resizeOptions: evidence?.options?.resize,
          });
          if (visual.status !== 'passed') {
            errors.push(`${label}: ${visual.error}`);
          }
          if (
            schemaVersion === 3 &&
            evidence.visualAgreement?.schemaVersion !== 2
          ) {
            errors.push(`${label}: schemaVersion 3 requires visual agreement schemaVersion 2`);
          }
          if (
            visual.status === 'passed' &&
            visualOutcomeToEvidenceStatus(visual.agreementStatus) !== evidence?.status
          ) {
            errors.push(`${label}: status does not match visual agreement outcome`);
          }
          if (
            evidence.visualAgreement.width !== evidence?.result?.width ||
            evidence.visualAgreement.height !== evidence?.result?.height
          ) {
            errors.push(`${label}: visual agreement dimensions do not match the native result`);
          }
        }
      } else if (visualAgreementRequired) {
        errors.push(`${label}: visual agreement report is required`);
      }
    }
  }

  if (schemaVersion === 1) {
    const video = manifest?.presentation?.video;
    if (
      typeof video?.file !== 'string' ||
      video.file.startsWith('/') ||
      video.file.includes('..')
    ) {
      errors.push('presentation video file path is invalid');
    } else {
      const videoPath = path.resolve(root, video.file);
      if (!videoPath.startsWith(`${path.resolve(root)}${path.sep}`) || !existsSync(videoPath)) {
        errors.push('presentation video is missing');
      } else {
        const bytes = readFileSync(videoPath);
        if (statSync(videoPath).size !== video.byteSize) {
          errors.push('presentation video byte size mismatch');
        }
        if (sha256(bytes) !== video.sha256) {
          errors.push('presentation video SHA-256 mismatch');
        }
        if (bytes.subarray(4, 8).toString('ascii') !== 'ftyp') {
          errors.push('presentation video is not MP4');
        }
      }
    }
    if (
      typeof video?.durationSeconds !== 'number' ||
      video.durationSeconds <= 0 ||
      video.durationSeconds > 30
    ) {
      errors.push('presentation video duration must be between 0 and 30 seconds');
    }
    if (typeof video?.generator !== 'string' || !video.generator.includes('ffmpeg')) {
      errors.push('presentation video must record its ffmpeg generator');
    }
  } else if (manifest?.presentation !== undefined) {
    errors.push('schemaVersion 2 or 3 stores recordings with their native cases');
  }

  return {
    schemaVersion: 1,
    status: errors.length === 0 ? 'passed' : 'failed',
    evidenceStatus: errors.length === 0 ? derivedEvidenceStatus : null,
    packageVersion: manifest?.packageVersion ?? null,
    sourceCommit: manifest?.sourceCommit ?? null,
    platforms,
    error: errors.length > 0 ? errors.join(' | ') : null,
  };
}

function deriveEvidenceStatus(cases) {
  if (!Array.isArray(cases) || cases.length === 0) return null;
  const statuses = cases.map(({ status }) => status);
  if (statuses.every((status) => status === 'passed')) return 'passed';
  if (
    statuses.every((status) => status === 'passed' || status === 'affected') &&
    statuses.some((status) => status === 'affected')
  ) {
    return 'affected';
  }
  return null;
}

function visualOutcomeToEvidenceStatus(outcome) {
  if (outcome === 'passed') return 'passed';
  if (outcome === 'failed') return 'affected';
  return null;
}

export function inspectMp4(bytes) {
  try {
    const topLevel = readBoxes(bytes, 0, bytes.length);
    if (!topLevel.some(({ type }) => type === 'ftyp')) {
      throw new Error('ftyp box is missing');
    }
    const moov = topLevel.find(({ type }) => type === 'moov');
    if (!moov) throw new Error('moov box is missing');
    const mvhd = readBoxes(bytes, moov.payloadStart, moov.end).find(
      ({ type }) => type === 'mvhd'
    );
    if (!mvhd) throw new Error('mvhd box is missing');
    readFullBoxDuration(bytes, mvhd, 'mvhd');

    const videoTracks = readBoxes(bytes, moov.payloadStart, moov.end)
      .filter(({ type }) => type === 'trak')
      .flatMap((trak) => {
        const trackBoxes = readBoxes(bytes, trak.payloadStart, trak.end);
        const mdia = trackBoxes.find(
          ({ type }) => type === 'mdia'
        );
        if (!mdia) return [];
        const mediaBoxes = readBoxes(bytes, mdia.payloadStart, mdia.end);
        const handler = mediaBoxes.find(({ type }) => type === 'hdlr');
        if (!handler || readHandlerType(bytes, handler) !== 'vide') return [];
        const mdhd = mediaBoxes.find(({ type }) => type === 'mdhd');
        if (!mdhd) throw new Error('video mdhd box is missing');
        const tkhd = trackBoxes.find(({ type }) => type === 'tkhd');
        if (!tkhd) throw new Error('video tkhd box is missing');
        return [{
          durationSeconds: readFullBoxDuration(bytes, mdhd, 'video mdhd'),
          ...readTrackDimensions(bytes, tkhd),
        }];
      });
    if (videoTracks.length !== 1) {
      throw new Error('MP4 must contain exactly one timed video track');
    }
    return {
      status: 'passed',
      ...videoTracks[0],
      error: null,
    };
  } catch (error) {
    return {
      status: 'failed',
      durationSeconds: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function readTrackDimensions(bytes, box) {
  if (box.end - 8 < box.payloadStart) throw new Error('tkhd box is truncated');
  const width = bytes.readUInt32BE(box.end - 8) / 65_536;
  const height = bytes.readUInt32BE(box.end - 4) / 65_536;
  if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
    throw new Error('video track dimensions are invalid');
  }
  return { width, height };
}

function readFullBoxDuration(bytes, box, label) {
  const version = bytes[box.payloadStart];
  if (version !== 0 && version !== 1) {
    throw new Error(`${label} version is unsupported`);
  }
  const timescaleOffset = box.payloadStart + (version === 1 ? 20 : 12);
  const durationOffset = box.payloadStart + (version === 1 ? 24 : 16);
  const durationSize = version === 1 ? 8 : 4;
  if (durationOffset + durationSize > box.end) {
    throw new Error(`${label} box is truncated`);
  }
  const timescale = bytes.readUInt32BE(timescaleOffset);
  const duration = version === 1
    ? Number(bytes.readBigUInt64BE(durationOffset))
    : bytes.readUInt32BE(durationOffset);
  if (timescale <= 0 || duration <= 0) {
    throw new Error(`${label} duration is invalid`);
  }
  return duration / timescale;
}

function readHandlerType(bytes, box) {
  const handlerTypeOffset = box.payloadStart + 8;
  if (handlerTypeOffset + 4 > box.end) {
    throw new Error('hdlr box is truncated');
  }
  return bytes.subarray(handlerTypeOffset, handlerTypeOffset + 4).toString('ascii');
}

function positiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function isPng(bytes) {
  return bytes.subarray(0, 8).equals(
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  );
}

function readBoxes(bytes, start, end) {
  const boxes = [];
  let offset = start;
  while (offset + 8 <= end) {
    let size = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString('ascii');
    let headerSize = 8;
    if (size === 1) {
      if (offset + 16 > end) throw new Error(`${type} extended size is truncated`);
      size = Number(bytes.readBigUInt64BE(offset + 8));
      headerSize = 16;
    } else if (size === 0) {
      size = end - offset;
    }
    if (size < headerSize || offset + size > end) {
      throw new Error(`${type} box size is invalid`);
    }
    boxes.push({
      type,
      payloadStart: offset + headerSize,
      end: offset + size,
    });
    offset += size;
  }
  if (offset !== end) throw new Error('MP4 box table is truncated');
  return boxes;
}

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

export function inspectDemoEvidence(root, manifest) {
  const errors = [];
  if (manifest?.schemaVersion !== 1) errors.push('schemaVersion must be 1');
  if (manifest?.status !== 'passed') errors.push('status must be passed');
  if (!/^\d+\.\d+\.\d+$/.test(manifest?.packageVersion ?? '')) {
    errors.push('packageVersion must be an exact semantic version');
  }
  if (!/^[0-9a-f]{40}$/.test(manifest?.sourceCommit ?? '')) {
    errors.push('sourceCommit must be a lowercase full commit SHA');
  }
  const cases = Array.isArray(manifest?.cases) ? manifest.cases : [];
  const platforms = cases.map(({ platform }) => platform).sort();
  if (JSON.stringify(platforms) !== JSON.stringify(['android', 'ios'])) {
    errors.push('evidence must contain exactly one Android and one iOS case');
  }

  for (const evidence of cases) {
    const label = evidence?.platform ?? 'unknown';
    if (evidence?.status !== 'passed') errors.push(`${label}: status must be passed`);
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

    for (const [assetName, magic] of [
      ['source', 'jpeg'],
      ['output', 'jpeg'],
      ['screenshot', 'png'],
    ]) {
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
    }

    if (evidence?.assets?.source?.byteSize !== evidence?.result?.originalByteSize) {
      errors.push(`${label}: source bytes do not match originalByteSize`);
    }
    if (evidence?.assets?.output?.byteSize !== evidence?.result?.byteSize) {
      errors.push(`${label}: output bytes do not match byteSize`);
    }
  }

  return {
    schemaVersion: 1,
    status: errors.length === 0 ? 'passed' : 'failed',
    packageVersion: manifest?.packageVersion ?? null,
    sourceCommit: manifest?.sourceCommit ?? null,
    platforms,
    error: errors.length > 0 ? errors.join(' | ') : null,
  };
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

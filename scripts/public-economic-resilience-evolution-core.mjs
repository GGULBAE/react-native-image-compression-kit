import { isDeepStrictEqual } from 'node:util';
import {
  inspectPublicEconomicResilienceIndex,
} from './public-economic-resilience-evidence-core.mjs';

export function inspectPublicEconomicResilienceEvolution({
  baseArchivePresent,
  currentArchivePresent,
  baseIndex,
  currentIndex,
  baseFiles,
  currentFiles,
}) {
  const errors = [];
  if (baseArchivePresent && !currentArchivePresent) {
    errors.push('public economic resilience archive was removed after publication');
    return errors;
  }
  if (!baseArchivePresent) return errors;
  errors.push(
    ...inspectPublicEconomicResilienceIndex(baseIndex).map(
      (error) => `base archive: ${error}`
    ),
    ...inspectPublicEconomicResilienceIndex(currentIndex).map(
      (error) => `current archive: ${error}`
    )
  );
  if (errors.length > 0) return errors;
  if (currentIndex.captures.length < baseIndex.captures.length) {
    errors.push('public economic resilience capture history was truncated');
  } else if (
    !isDeepStrictEqual(
      currentIndex.captures.slice(0, baseIndex.captures.length),
      baseIndex.captures
    )
  ) {
    errors.push('public economic resilience capture history is not an exact ordered prefix');
  }
  for (const [relativePath, baseBytes] of baseFiles) {
    if (relativePath === 'index.json') continue;
    const currentBytes = currentFiles.get(relativePath);
    if (!Buffer.isBuffer(currentBytes)) {
      errors.push(`published public economic resilience file was removed: ${relativePath}`);
    } else if (!Buffer.from(baseBytes).equals(currentBytes)) {
      errors.push(`published public economic resilience file changed: ${relativePath}`);
    }
  }
  return errors;
}

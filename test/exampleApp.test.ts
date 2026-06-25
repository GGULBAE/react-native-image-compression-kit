import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readProjectFile(filePath: string): string {
  return readFileSync(path.join(ROOT, filePath), 'utf8');
}

describe('example app', () => {
  it('lets Android users select and inspect JPEG metadata policy behavior', () => {
    const appSource = readProjectFile('example/src/App.tsx');

    expect(appSource).toContain('METADATA_POLICIES');
    expect(appSource).toContain("useState<MetadataPolicy>('safe')");
    expect(appSource).toContain('metadata: metadataPolicy');
    expect(appSource).toContain('setResultMetadataPolicy(metadataPolicy)');
    expect(appSource).toContain('supportedMetadataPolicies.includes(policy)');
    expect(appSource).toContain('label="selected metadata"');
    expect(appSource).toContain('label="metadataPolicies"');
    expect(appSource).toContain('label="metadata"');
  });
});

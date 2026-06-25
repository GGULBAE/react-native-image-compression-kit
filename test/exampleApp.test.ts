import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readProjectFile(filePath: string): string {
  return readFileSync(path.join(ROOT, filePath), 'utf8');
}

describe('example app', () => {
  it('lets Android users select JPEG, PNG, or WebP output formats', () => {
    const appSource = readProjectFile('example/src/App.tsx');

    expect(appSource).toContain(
      "const EXAMPLE_OUTPUT_FORMATS: OutputFormat[] = ['jpeg', 'png', 'webp'];"
    );
    expect(appSource).toContain("useState<OutputFormat>('jpeg')");
    expect(appSource).toContain('format: outputFormat');
    expect(appSource).toContain('supportsSelectedTargetSize');
    expect(appSource).toContain('editable={supportsSelectedTargetSize}');
    expect(appSource).toContain('label="selected output"');
    expect(appSource).toContain('label="output formats"');
    expect(appSource).toContain('label="format"');
  });

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

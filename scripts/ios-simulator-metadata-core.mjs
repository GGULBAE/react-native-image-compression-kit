const IOS_RUNTIME_PREFIX = 'com.apple.CoreSimulator.SimRuntime.iOS-';
const CANONICAL_UDID =
  /^[0-9A-Fa-f]{8}(?:-[0-9A-Fa-f]{4}){3}-[0-9A-Fa-f]{12}$/;

export function inspectBootedIosSimulatorMetadata({
  devices,
  runtimes,
  udid = null,
}) {
  const errors = [];
  if (udid !== null && !CANONICAL_UDID.test(udid)) {
    errors.push('udid must be a canonical simulator identifier');
  }
  if (!plainObject(devices?.devices)) {
    errors.push('devices payload must contain a devices object');
  }
  if (!Array.isArray(runtimes?.runtimes)) {
    errors.push('runtimes payload must contain a runtimes array');
  }

  const matches = [];
  if (plainObject(devices?.devices)) {
    for (const [runtimeIdentifier, candidates] of Object.entries(
      devices.devices
    )) {
      if (!runtimeIdentifier.startsWith(IOS_RUNTIME_PREFIX)) continue;
      if (!Array.isArray(candidates)) {
        errors.push(`device list must be an array: ${runtimeIdentifier}`);
        continue;
      }
      for (const candidate of candidates) {
        if (udid === null || candidate?.udid === udid) {
          matches.push({ runtimeIdentifier, candidate });
        }
      }
    }
  }
  if (matches.length !== 1) {
    errors.push('selection must identify exactly one iOS simulator device');
  }
  const match = matches[0];
  if (match?.candidate?.state !== 'Booted') {
    errors.push('selected simulator must be booted');
  }
  if (match?.candidate?.isAvailable === false) {
    errors.push('selected simulator device must be available');
  }
  if (!CANONICAL_UDID.test(match?.candidate?.udid ?? '')) {
    errors.push('selected simulator udid must be canonical');
  }
  if (!safeLabel(match?.candidate?.name)) {
    errors.push('selected simulator name is required');
  }

  const runtimeMatches = Array.isArray(runtimes?.runtimes)
    ? runtimes.runtimes.filter(
        (runtime) => runtime?.identifier === match?.runtimeIdentifier
      )
    : [];
  if (runtimeMatches.length !== 1) {
    errors.push('device runtime must identify exactly one installed runtime');
  }
  const runtime = runtimeMatches[0];
  if (runtime?.isAvailable !== true) {
    errors.push('selected simulator runtime must be available');
  }
  if (!safeLabel(runtime?.name) || !runtime.name.startsWith('iOS ')) {
    errors.push('selected simulator runtime name must identify iOS');
  }
  if (!safeLabel(runtime?.buildversion)) {
    errors.push('selected simulator runtime buildversion is required');
  }

  if (errors.length > 0) {
    return failed(errors);
  }
  return {
    status: 'passed',
    udid: match.candidate.udid,
    runtimeIdentifier: match.runtimeIdentifier,
    runtime: runtime.name,
    osBuild: runtime.buildversion,
    device: match.candidate.name,
    error: null,
  };
}

function failed(errors) {
  return {
    status: 'failed',
    udid: null,
    runtimeIdentifier: null,
    runtime: null,
    osBuild: null,
    device: null,
    error: errors.join(' | '),
  };
}

function plainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function safeLabel(value) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value === value.trim() &&
    !/[\u0000-\u001f\u007f]/.test(value)
  );
}

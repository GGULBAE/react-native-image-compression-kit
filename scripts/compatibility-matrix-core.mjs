const LANE_IDS = [
  'rn-floor-legacy',
  'rn-current-legacy',
  'rn-current-new',
  'expo-current-new',
];
const PLATFORMS = ['android', 'ios'];
const ARCHITECTURES = ['legacy', 'new'];
const KINDS = ['bare', 'expo'];

export function validateCompatibilityMatrix(manifest, packageJson) {
  const errors = [];
  if (!isRecord(manifest)) {
    return { ok: false, errors: ['compatibility matrix must be an object'] };
  }
  if (manifest.schemaVersion !== 1) {
    errors.push(`schemaVersion expected 1, received ${describe(manifest.schemaVersion)}`);
  }
  if (manifest.packageVersion !== packageJson.version) {
    errors.push(
      `packageVersion expected ${packageJson.version}, received ${describe(manifest.packageVersion)}`
    );
  }
  if (manifest.workflow !== '.github/workflows/compatibility.yml') {
    errors.push(`unexpected workflow authority: ${describe(manifest.workflow)}`);
  }
  if (!Array.isArray(manifest.lanes)) {
    errors.push('lanes must be an array');
    return { ok: false, errors };
  }

  const ids = manifest.lanes.map((lane) => lane?.id);
  for (const id of LANE_IDS) {
    if (ids.filter((candidate) => candidate === id).length !== 1) {
      errors.push(`expected exactly one compatibility lane: ${id}`);
    }
  }
  for (const lane of manifest.lanes) {
    validateLane(lane, errors);
  }

  const peerRange = packageJson.peerDependencies?.['react-native'];
  const floor = manifest.lanes.find((lane) => lane.id === 'rn-floor-legacy');
  const currentNew = manifest.lanes.find((lane) => lane.id === 'rn-current-new');
  const expo = manifest.lanes.find((lane) => lane.id === 'expo-current-new');
  if (peerRange !== '>=0.73 <1.0') {
    errors.push(`React Native peer range expected >=0.73 <1.0, received ${describe(peerRange)}`);
  }
  if (floor?.reactNative !== '0.73.11' || floor?.node !== '18') {
    errors.push('floor lane must exercise React Native 0.73.11 on Node 18');
  }
  if (currentNew?.reactNative !== '0.86.0' || currentNew?.architecture !== 'new') {
    errors.push('current lane must exercise React Native 0.86.0 New Architecture');
  }
  if (expo?.expo !== '57.0.7' || expo?.reactNative !== '0.86.0') {
    errors.push('Expo lane must pin Expo 57.0.7 with React Native 0.86.0');
  }

  return { ok: errors.length === 0, errors, lanes: manifest.lanes };
}

export function selectCompatibilityLane(manifest, laneId, platform) {
  const lane = manifest.lanes.find((candidate) => candidate.id === laneId);
  if (!lane) throw new Error(`unknown compatibility lane: ${laneId}`);
  if (!PLATFORMS.includes(platform) || !lane.platforms.includes(platform)) {
    throw new Error(`lane ${laneId} does not include platform ${platform}`);
  }
  return lane;
}

function validateLane(lane, errors) {
  if (!isRecord(lane)) {
    errors.push('compatibility lane must be an object');
    return;
  }
  if (!LANE_IDS.includes(lane.id)) errors.push(`unexpected lane id: ${describe(lane.id)}`);
  if (!KINDS.includes(lane.kind)) errors.push(`${lane.id}: invalid kind ${describe(lane.kind)}`);
  if (!/^\d+\.\d+\.\d+$/.test(lane.reactNative ?? '')) {
    errors.push(`${lane.id}: reactNative must be an exact semantic version`);
  }
  if (!/^\d+\.\d+\.\d+$/.test(lane.react ?? '')) {
    errors.push(`${lane.id}: react must be an exact semantic version`);
  }
  if (!['18', '24'].includes(lane.node)) {
    errors.push(`${lane.id}: node must be an exact supported matrix major`);
  }
  if (!ARCHITECTURES.includes(lane.architecture)) {
    errors.push(`${lane.id}: invalid architecture ${describe(lane.architecture)}`);
  }
  if (
    !Array.isArray(lane.platforms) ||
    lane.platforms.length !== 2 ||
    !PLATFORMS.every((platform) => lane.platforms.includes(platform))
  ) {
    errors.push(`${lane.id}: platforms must contain android and ios exactly once`);
  }
  if (lane.releaseRequired !== true) {
    errors.push(`${lane.id}: releaseRequired must be true`);
  }
  if (lane.kind === 'bare' && !/^\d+\.\d+\.\d+$/.test(lane.cli ?? '')) {
    errors.push(`${lane.id}: bare lane CLI must be exact`);
  }
  if (lane.kind === 'expo' && !/^\d+\.\d+\.\d+$/.test(lane.expo ?? '')) {
    errors.push(`${lane.id}: Expo version must be exact`);
  }
  if (JSON.stringify(lane).toLowerCase().includes('latest')) {
    errors.push(`${lane.id}: latest selection is forbidden`);
  }
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function describe(value) {
  return JSON.stringify(value);
}

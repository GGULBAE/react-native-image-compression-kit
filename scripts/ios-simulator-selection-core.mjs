export function selectIOSSimulatorForSDK(devices, sdkVersion) {
  const version = /^(\d+)\.(\d+)(?:\.\d+)?$/.exec(sdkVersion);
  if (!version) throw new Error(`Invalid iOS Simulator SDK version: ${sdkVersion}`);
  const runtimePrefix = `com.apple.CoreSimulator.SimRuntime.iOS-${version[1]}-${version[2]}`;
  const candidates = Object.entries(devices ?? {}).flatMap(([runtime, entries]) => {
    if (runtime !== runtimePrefix && !runtime.startsWith(`${runtimePrefix}-`)) return [];
    if (!Array.isArray(entries)) return [];
    return entries
      .filter(device => device.isAvailable === true &&
        typeof device.name === 'string' && device.name.includes('iPhone') &&
        typeof device.udid === 'string' && device.udid.length > 0)
      .map(device => ({ ...device, runtime }));
  });
  const simulator = candidates.find(device => device.state === 'Booted') ?? candidates[0];
  if (!simulator) {
    throw new Error(
      `No available iPhone simulator matches iOS Simulator SDK ${sdkVersion}. ` +
      'Install a matching simulator runtime in the selected Xcode before running validation.'
    );
  }
  return simulator;
}

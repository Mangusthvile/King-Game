// This computer's world file settings (Settings tab > This computer).
// They belong to the computer, not to the world (each computer has its own
// device name), so they live in localStorage, not in the world data, and
// changing them is not a command.

const KEY = 'kingsGame.device';

const DEFAULTS = {
  deviceName: '', // shown to other computers: "changed on [device]"
  autosave: true,
  autosaveSeconds: 5, // save to the file after this many seconds without changes
  backupsKept: 10, // 0 = no backups
  backupMinutes: 10, // at most one backup per this many minutes (plus one per day)
};

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? {};
  } catch {
    return {};
  }
}

function write(settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Storage blocked: the settings still work until the page is closed.
  }
}

let cache = null;

export function getDeviceSettings() {
  if (!cache) {
    cache = { ...DEFAULTS, ...read() };
    // A computer always has a name, so two computers never look the same.
    if (!cache.deviceName) {
      cache.deviceName = defaultDeviceName();
      write(cache);
    }
  }
  return cache;
}

export function setDeviceSetting(key, value) {
  cache = { ...getDeviceSettings(), [key]: value };
  write(cache);
}

// For example "Windows 4F2": the platform plus a short random code.
function defaultDeviceName() {
  const platform = navigator.userAgentData?.platform || navigator.platform || 'Computer';
  const code = Math.floor(Math.random() * 0x1000).toString(16).toUpperCase().padStart(3, '0');
  return `${platform} ${code}`;
}

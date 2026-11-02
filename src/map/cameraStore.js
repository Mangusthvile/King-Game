// Remembers each container's camera between visits and page reloads.
// Cameras are view state, not world data, so they live in localStorage,
// outside the world and its undo log.

const CAMERA_STORAGE_KEY = 'kingsGame.cameras';
const cameras = new Map(Object.entries(readStoredCameras())); // containerId -> { x, y, zoom }
let saveTimer = 0;

function readStoredCameras() {
  try {
    return JSON.parse(localStorage.getItem(CAMERA_STORAGE_KEY)) ?? {};
  } catch {
    return {}; // storage blocked or broken: just start with fresh cameras
  }
}

export function getCamera(containerId) {
  return cameras.get(containerId);
}

export function setCamera(containerId, cam) {
  cameras.set(containerId, cam);
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(CAMERA_STORAGE_KEY, JSON.stringify(Object.fromEntries(cameras)));
    } catch {
      // Not being able to remember a camera is harmless.
    }
  }, 500);
}

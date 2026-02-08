// frontend/src/lib/device.ts

const DEVICE_KEY = "device_id_v1";

export function getDeviceId(): string {
  // Important: must be stable per browser
  let id = localStorage.getItem(DEVICE_KEY);

  if (!id) {
    // crypto.randomUUID is supported in modern browsers
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
  }

  return id;
}

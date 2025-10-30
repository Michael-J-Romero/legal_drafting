export function base64ToUint8Array(base64) {
  if (!base64 || typeof base64 !== 'string' || base64.length === 0) return null;
  if (typeof window === 'undefined' || typeof window.atob !== 'function') return null;
  try {
    const binary = window.atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch (error) {
    return null;
  }
}

export function arrayBufferToBase64(buffer) {
  if (typeof window === 'undefined' || typeof window.btoa !== 'function') return '';
  try {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer || []);
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      const sub = bytes.subarray(i, i + chunk);
      binary += String.fromCharCode.apply(null, sub);
    }
    return window.btoa(binary);
  } catch (error) {
    return '';
  }
}

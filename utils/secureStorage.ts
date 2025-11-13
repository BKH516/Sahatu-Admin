/**
 * Secure Storage Utilities
 * تشفير البيانات الحساسة قبل تخزينها في localStorage
 */

export const SECURE_STORAGE_PREFIX = 'sahtee_secure_';
const SESSION_KEY_STORAGE = `${SECURE_STORAGE_PREFIX}session_key`;
const KEY_LENGTH = 32; // 256-bit key
const IV_LENGTH = 12; // 96-bit IV for AES-GCM

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const isCryptoAvailable = typeof window !== 'undefined' && !!window.crypto?.subtle;

const bufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
};

const base64ToBuffer = (base64: string): ArrayBuffer => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

const getSessionKey = async (): Promise<CryptoKey | null> => {
  if (!isCryptoAvailable) return null;

  let storedKey = sessionStorage.getItem(SESSION_KEY_STORAGE);

  if (!storedKey) {
    const randomKey = window.crypto.getRandomValues(new Uint8Array(KEY_LENGTH));
    storedKey = bufferToBase64(randomKey.buffer);
    sessionStorage.setItem(SESSION_KEY_STORAGE, storedKey);
  }

  const keyBuffer = base64ToBuffer(storedKey);
  return window.crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
};

const encrypt = async (plainText: string): Promise<string> => {
  if (!isCryptoAvailable) {
    return plainText;
  }

  const key = await getSessionKey();
  if (!key) {
    return plainText;
  }

  const iv = window.crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const cipherBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plainText)
  );

  const combinedBuffer = new Uint8Array(iv.byteLength + cipherBuffer.byteLength);
  combinedBuffer.set(iv, 0);
  combinedBuffer.set(new Uint8Array(cipherBuffer), iv.byteLength);

  return bufferToBase64(combinedBuffer.buffer);
};

const decrypt = async (cipherText: string): Promise<string | null> => {
  if (!isCryptoAvailable) {
    return cipherText;
  }

  const key = await getSessionKey();
  if (!key) {
    return cipherText;
  }

  try {
    const combinedBuffer = new Uint8Array(base64ToBuffer(cipherText));
    const iv = combinedBuffer.slice(0, IV_LENGTH);
    const data = combinedBuffer.slice(IV_LENGTH);

    const plainBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );

    return decoder.decode(plainBuffer);
  } catch {
    return null;
  }
};

export const secureStorage = {
  async setItem(key: string, value: string): Promise<void> {
    if (typeof value !== 'string') {
      throw new Error('secureStorage expects string values only');
    }
    const encrypted = await encrypt(value);
    try {
      localStorage.setItem(`${SECURE_STORAGE_PREFIX}${key}`, encrypted);
    } catch {
      // fallback: attempt to store unencrypted value if storage is limited
      try {
        localStorage.setItem(`${SECURE_STORAGE_PREFIX}${key}`, value);
      } catch {
        // ignore storage errors silently to avoid breaking auth flow
      }
    }
  },

  async getItem(key: string): Promise<string | null> {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(`${SECURE_STORAGE_PREFIX}${key}`);
    } catch {
      return null;
    }

    if (!stored) return null;

    const decrypted = await decrypt(stored);
    return decrypted ?? null;
  },

  removeItem(key: string): void {
    try {
      localStorage.removeItem(`${SECURE_STORAGE_PREFIX}${key}`);
    } catch {
      // ignore removal errors
    }
  },

  clearSecureNamespace(): void {
    try {
      Object.keys(localStorage)
        .filter((storageKey) => storageKey.startsWith(SECURE_STORAGE_PREFIX))
        .forEach((storageKey) => {
          try {
            localStorage.removeItem(storageKey);
          } catch {
            // ignore removal errors
          }
        });
    } catch {
      // ignore iteration errors
    }
  },

  clearSessionKey(): void {
    try {
      sessionStorage.removeItem(SESSION_KEY_STORAGE);
    } catch {
      // ignore session storage errors
    }
  },
};



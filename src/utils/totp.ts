import QRCode from 'qrcode';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Decode a base32 string into a Uint8Array
 */
export function base32Decode(base32: string): Uint8Array {
  const cleaned = base32.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (let i = 0; i < cleaned.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(cleaned[i]);
    if (idx === -1) {
      continue;
    }
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return new Uint8Array(output);
}

/**
 * Generate a random Base32 secret key (16 chars = 80 bits, standard TOTP)
 */
export function generateTotpSecret(length = 16): string {
  const randomBytes = new Uint8Array(length);
  crypto.getRandomValues(randomBytes);
  let secret = '';
  for (let i = 0; i < length; i++) {
    secret += BASE32_ALPHABET[randomBytes[i] % 32];
  }
  return secret;
}

/**
 * Generate an emergency recovery code (format: XXXX-XXXX-XXXX)
 */
export function generateRecoveryCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No O, 0, 1, I for readability
  const randomBytes = new Uint8Array(12);
  crypto.getRandomValues(randomBytes);
  let code = '';
  for (let i = 0; i < 12; i++) {
    code += chars[randomBytes[i] % chars.length];
    if (i === 3 || i === 7) {
      code += '-';
    }
  }
  return code;
}

/**
 * Generate standard OTPAuth URI for Google Authenticator QR Code
 */
export function generateOtpAuthUri(
  accountName: string,
  issuer: string,
  secret: string
): string {
  const encodedAccount = encodeURIComponent(accountName);
  const encodedIssuer = encodeURIComponent(issuer);
  return `otpauth://totp/${encodedIssuer}:${encodedAccount}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Generate QR code Data URL (PNG)
 */
export async function generateQrDataUrl(otpAuthUri: string): Promise<string> {
  return QRCode.toDataURL(otpAuthUri, {
    width: 240,
    margin: 2,
    color: {
      dark: '#111827',
      light: '#FFFFFF',
    },
  });
}

/**
 * Generate TOTP code for a given timestamp and secret
 */
export async function generateTotpCode(
  secret: string,
  timestampMs = Date.now(),
  stepSec = 30
): Promise<string> {
  const counter = Math.floor(timestampMs / 1000 / stepSec);
  const keyBytes = base32Decode(secret);

  const counterBuffer = new ArrayBuffer(8);
  const counterView = new DataView(counterBuffer);
  // High 32 bits, Low 32 bits
  counterView.setUint32(0, Math.floor(counter / 0x100000000));
  counterView.setUint32(4, counter & 0xffffffff);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, counterBuffer);
  const hmacBytes = new Uint8Array(signature);

  // Dynamic truncation (RFC 4226)
  const offset = hmacBytes[hmacBytes.length - 1] & 0x0f;
  const binary =
    ((hmacBytes[offset] & 0x7f) << 24) |
    ((hmacBytes[offset + 1] & 0xff) << 16) |
    ((hmacBytes[offset + 2] & 0xff) << 8) |
    (hmacBytes[offset + 3] & 0xff);

  const otp = binary % 1000000;
  return otp.toString().padStart(6, '0');
}

/**
 * Verify TOTP code with +/- 1 time step drift window
 */
export async function verifyTotpCode(
  secret: string,
  token: string,
  window = 1
): Promise<boolean> {
  const sanitizedToken = token.trim().replace(/\s+/g, '');
  if (!/^\d{6}$/.test(sanitizedToken)) {
    return false;
  }

  const now = Date.now();
  const step = 30 * 1000;

  for (let i = -window; i <= window; i++) {
    const candidateTime = now + i * step;
    const generated = await generateTotpCode(secret, candidateTime, 30);
    if (generated === sanitizedToken) {
      return true;
    }
  }

  return false;
}

export const DEFAULT_CIPHER_WORD = 'BLACKHORSE';

/**
 * Validates a cipher keyword.
 * Requirements:
 * - Exactly 10 characters
 * - All characters must be unique
 * - Alphabetic characters only (A-Z)
 */
export function validateCipherWord(word: string): {
  valid: boolean;
  error?: string;
} {
  if (!word || typeof word !== 'string') {
    return { valid: false, error: 'Cipher keyword cannot be empty' };
  }

  const clean = word.trim().toUpperCase();

  if (clean.length !== 10) {
    return {
      valid: false,
      error: `Cipher keyword must be exactly 10 letters (current length: ${clean.length})`,
    };
  }

  if (!/^[A-Z]{10}$/.test(clean)) {
    return {
      valid: false,
      error: 'Cipher keyword must contain only letters (A-Z)',
    };
  }

  const uniqueChars = new Set(clean.split(''));
  if (uniqueChars.size !== 10) {
    return {
      valid: false,
      error: 'All 10 letters in cipher keyword must be unique',
    };
  }

  return { valid: true };
}

/**
 * Builds a mapping from digits 1-9 and 0 to cipher letters.
 * 1 -> index 0
 * 2 -> index 1
 * ...
 * 9 -> index 8
 * 0 -> index 9
 */
export function getCipherMap(
  cipherWord = DEFAULT_CIPHER_WORD
): Record<string, string> {
  const validation = validateCipherWord(cipherWord);
  const word = validation.valid
    ? cipherWord.trim().toUpperCase()
    : DEFAULT_CIPHER_WORD;

  return {
    '1': word[0],
    '2': word[1],
    '3': word[2],
    '4': word[3],
    '5': word[4],
    '6': word[5],
    '7': word[6],
    '8': word[7],
    '9': word[8],
    '0': word[9],
  };
}

/**
 * Returns a human-readable string of the digit mapping.
 * E.g., '1:B  2:L  3:A  4:C  5:K  6:H  7:O  8:R  9:S  0:E'
 */
export function getCipherMapString(cipherWord = DEFAULT_CIPHER_WORD): string {
  const map = getCipherMap(cipherWord);
  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
  return digits.map((d) => `${d}:${map[d]}`).join('  ');
}

/**
 * Encodes a numeric value or numeric string using the cipher keyword.
 * Preserves decimal points and negative signs.
 * E.g., with 'BLACKHORSE':
 *   12.50 -> 'BL.KE'
 *   0.00  -> 'E.EE'
 *   23500 -> 'LAKEE.EE'
 */
export function encodeNumberToCipher(
  val: number | string | null | undefined,
  cipherWord = DEFAULT_CIPHER_WORD
): string {
  if (val === null || val === undefined || val === '') {
    return '-';
  }

  const map = getCipherMap(cipherWord);

  let strVal: string;
  if (typeof val === 'number') {
    if (isNaN(val)) return '-';
    strVal = val.toFixed(2);
  } else {
    const cleanStr = String(val).replace(/,/g, '').trim();
    const num = parseFloat(cleanStr);
    if (isNaN(num)) {
      strVal = String(val);
    } else {
      strVal = num.toFixed(2);
    }
  }

  return strVal
    .split('')
    .map((char) => map[char] ?? char)
    .join('');
}

/**
 * Decodes a cipher string back to a numeric string using the cipher keyword.
 */
export function decodeCipherToNumber(
  cipherStr: string,
  cipherWord = DEFAULT_CIPHER_WORD
): string {
  if (!cipherStr || cipherStr === '-') return '';

  const map = getCipherMap(cipherWord);
  const reverseMap: Record<string, string> = {};
  for (const [digit, char] of Object.entries(map)) {
    reverseMap[char] = digit;
  }

  return cipherStr
    .toUpperCase()
    .split('')
    .map((char) => reverseMap[char] ?? char)
    .join('');
}

/**
 * High-precision vector Code-128 barcode generator.
 * Produces crisp SVG output optimized for thermal label printers (e.g. TVS LP 46 Dlite).
 */

const PATTERNS: readonly string[] = [
  '212222',
  '222122',
  '222221',
  '121223',
  '121322',
  '131222',
  '122213',
  '122312',
  '132212',
  '221213',
  '221312',
  '231212',
  '112232',
  '122132',
  '122231',
  '113222',
  '123122',
  '123221',
  '223211',
  '221132',
  '221231',
  '213212',
  '223112',
  '312131',
  '311222',
  '321122',
  '321221',
  '312212',
  '322112',
  '322211',
  '212123',
  '212321',
  '232121',
  '111323',
  '131123',
  '131321',
  '112313',
  '132113',
  '132311',
  '211313',
  '231113',
  '231311',
  '112133',
  '112331',
  '132131',
  '113123',
  '113321',
  '133121',
  '313121',
  '211331',
  '231131',
  '213113',
  '213311',
  '213131',
  '311123',
  '311321',
  '331121',
  '312113',
  '312311',
  '332111',
  '314111',
  '221411',
  '431111',
  '111224',
  '111422',
  '121124',
  '121421',
  '141122',
  '141221',
  '112214',
  '112412',
  '122114',
  '122411',
  '142112',
  '142211',
  '241211',
  '221114',
  '413111',
  '241112',
  '134111',
  '111242',
  '121142',
  '121241',
  '114212',
  '124112',
  '124211',
  '411212',
  '421112',
  '421211',
  '212141',
  '214121',
  '412121',
  '111143',
  '111341',
  '131141',
  '114113',
  '114311',
  '411113',
  '411311',
  '113141',
  '114131',
  '311141',
  '411131',
  '211412',
  '211214',
  '211232',
  '2331112',
];

const START_B = 104;
const STOP = 106;

export interface BarcodeSVGOptions {
  height?: number; // Bar height in pixels, default 50
  barWidth?: number; // Single module width, default 2
  includeText?: boolean; // Whether to render human readable text below bars
  fontSize?: number; // Text font size, default 12
  quietZone?: number; // Quiet zone modules on left and right, default 10
}

/**
 * Encodes ASCII string into Code-128B symbol values and calculates checksum
 */
export function encodeCode128B(text: string): number[] {
  const codes: number[] = [START_B];
  let checkSum = START_B;

  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    // Code 128B supports ASCII 32 through 127
    const value = charCode >= 32 && charCode <= 126 ? charCode - 32 : 0;
    codes.push(value);
    checkSum += value * (i + 1);
  }

  const checkDigit = checkSum % 103;
  codes.push(checkDigit);
  codes.push(STOP);
  return codes;
}

/**
 * Generates an SVG string representation of a Code-128 barcode
 */
export function generateBarcode128SVG(
  text: string,
  options: BarcodeSVGOptions = {}
): string {
  const cleanText = String(text || '').trim();
  if (!cleanText) {
    return '';
  }

  const height = options.height ?? 48;
  const barWidth = options.barWidth ?? 2;
  const quietZone = options.quietZone ?? 10;
  const includeText = options.includeText ?? true;
  const fontSize = options.fontSize ?? 12;

  const codes = encodeCode128B(cleanText);

  // Build binary modules string (1 = bar, 0 = space)
  let modules = '0'.repeat(quietZone);
  for (const code of codes) {
    const pattern = PATTERNS[code];
    if (!pattern) continue;
    let isBar = true;
    for (const lenStr of pattern) {
      const len = parseInt(lenStr, 10);
      modules += (isBar ? '1' : '0').repeat(len);
      isBar = !isBar;
    }
  }
  modules += '0'.repeat(quietZone);

  // Group continuous bars into SVG rects
  const rects: string[] = [];
  let currentStart = -1;

  for (let i = 0; i < modules.length; i++) {
    if (modules[i] === '1') {
      if (currentStart === -1) {
        currentStart = i;
      }
    } else {
      if (currentStart !== -1) {
        const x = currentStart * barWidth;
        const width = (i - currentStart) * barWidth;
        rects.push(
          `<rect x="${x}" y="0" width="${width}" height="${height}" fill="#000000"/>`
        );
        currentStart = -1;
      }
    }
  }

  if (currentStart !== -1) {
    const x = currentStart * barWidth;
    const width = (modules.length - currentStart) * barWidth;
    rects.push(
      `<rect x="${x}" y="0" width="${width}" height="${height}" fill="#000000"/>`
    );
  }

  const totalWidth = modules.length * barWidth;
  const totalHeight = includeText ? height + fontSize + 6 : height;

  const textElement = includeText
    ? `<text x="${totalWidth / 2}" y="${
        height + fontSize + 2
      }" text-anchor="middle" font-family="monospace, monospace" font-size="${fontSize}" font-weight="600" fill="#000000">${cleanText}</text>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" width="100%" height="auto" style="max-width:${totalWidth}px;display:block;margin:auto;">
    ${rects.join('')}
    ${textElement}
  </svg>`;
}

import test from 'tape';
import {
  DEFAULT_CIPHER_WORD,
  decodeCipherToNumber,
  encodeNumberToCipher,
  getCipherMap,
  getCipherMapString,
  validateCipherWord,
} from '../src/utils/cipher';

test('validateCipherWord', (t) => {
  t.equal(validateCipherWord('BLACKHORSE').valid, true, 'BLACKHORSE is valid');
  t.equal(validateCipherWord('blackhorse').valid, true, 'lowercase is valid');
  t.equal(validateCipherWord('PATHFINDER').valid, true, 'PATHFINDER is valid');

  t.equal(
    validateCipherWord('SHORT').valid,
    false,
    'Fails when less than 10 letters'
  );
  t.equal(
    validateCipherWord('LONGERTHAN10').valid,
    false,
    'Fails when more than 10 letters'
  );
  t.equal(
    validateCipherWord('BLACKHEART').valid,
    false,
    'Fails when duplicate letters exist (A is repeated)'
  );
  t.equal(
    validateCipherWord('BLACK12345').valid,
    false,
    'Fails when non-letters exist'
  );
  t.end();
});

test('getCipherMap default BLACKHORSE', (t) => {
  const map = getCipherMap();
  t.equal(map['1'], 'B');
  t.equal(map['2'], 'L');
  t.equal(map['3'], 'A');
  t.equal(map['4'], 'C');
  t.equal(map['5'], 'K');
  t.equal(map['6'], 'H');
  t.equal(map['7'], 'O');
  t.equal(map['8'], 'R');
  t.equal(map['9'], 'S');
  t.equal(map['0'], 'E');
  t.end();
});

test('encodeNumberToCipher with BLACKHORSE', (t) => {
  t.equal(encodeNumberToCipher(12.5), 'BL.KE', '12.50 encodes to BL.KE');
  t.equal(encodeNumberToCipher('12.50'), 'BL.KE', '"12.50" encodes to BL.KE');
  t.equal(encodeNumberToCipher(0), 'E.EE', '0 encodes to E.EE');
  t.equal(encodeNumberToCipher(1234567890), 'BLACKHORSE.EE', '1234567890 encodes properly');
  t.equal(encodeNumberToCipher(null), '-', 'null returns -');
  t.equal(encodeNumberToCipher(undefined), '-', 'undefined returns -');
  t.equal(encodeNumberToCipher(''), '-', 'empty string returns -');
  t.end();
});

test('decodeCipherToNumber with BLACKHORSE', (t) => {
  t.equal(decodeCipherToNumber('BL.KE'), '12.50', 'BL.KE decodes to 12.50');
  t.equal(decodeCipherToNumber('E.EE'), '0.00', 'E.EE decodes to 0.00');
  t.equal(decodeCipherToNumber('-'), '', '- decodes to empty');
  t.end();
});

test('getCipherMapString', (t) => {
  t.equal(
    getCipherMapString('BLACKHORSE'),
    '1:B  2:L  3:A  4:C  5:K  6:H  7:O  8:R  9:S  0:E',
    'Maps digits 1-9 and 0'
  );
  t.end();
});

test('encodeNumberToCipher with large values and commas', (t) => {
  t.equal(
    encodeNumberToCipher(23500),
    'LAKEE.EE',
    '23500 encodes to LAKEE.EE'
  );
  t.equal(
    encodeNumberToCipher('23,500.00'),
    'LAKEE.EE',
    '"23,500.00" with commas encodes to LAKEE.EE'
  );
  t.end();
});

test('encodeNumberToCipher with custom keyword PATHFINDER', (t) => {
  // P=1, A=2, T=3, H=4, F=5, I=6, N=7, D=8, E=9, R=0
  t.equal(
    encodeNumberToCipher(12.5, 'PATHFINDER'),
    'PA.FR',
    'Custom keyword encodes correctly'
  );
  t.end();
});

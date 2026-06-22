const fs = require('fs');
const src = fs.readFileSync('js/app.js', 'utf8');

const win1252ToByte = {
  '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87,
  'ˆ': 0x88, '‰': 0x89, 'Š': 0x8A, '‹': 0x8B, 'Œ': 0x8C, 'Ž': 0x8E,
  '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97,
  '˜': 0x98, '™': 0x99, 'š': 0x9A, '›': 0x9B, 'œ': 0x9C, 'ž': 0x9E, 'Ÿ': 0x9F
};

const bytes = new Uint8Array(src.length);
let len = 0;
for (let i = 0; i < src.length; i++) {
  const char = src[i];
  if (win1252ToByte[char] !== undefined) {
    bytes[len++] = win1252ToByte[char];
  } else {
    const code = char.charCodeAt(0);
    if (code > 255) {
      console.log('Unexpected high char at ' + i + ': ' + char);
      bytes[len++] = code & 0xFF; // Fallback, shouldn't happen for true 1252->UTF8 corruption
    } else {
      bytes[len++] = code;
    }
  }
}

const restoredBuf = Buffer.from(bytes.buffer, 0, len);
const restoredStr = restoredBuf.toString('utf8');
fs.writeFileSync('js/app.js', restoredStr, 'utf8');
console.log('Restoration complete!');

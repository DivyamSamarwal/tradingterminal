const fs = require('fs');
const src = fs.readFileSync('js/app.js', 'utf8');
const buf = Buffer.from(src, 'latin1');
const restored = buf.toString('utf8');
if (restored.includes('₹') || restored.includes('🔔')) {
  fs.writeFileSync('js/app.js', restored, 'utf8');
  console.log('Successfully restored UTF-8 symbols.');
} else {
  console.log('Restoration failed.');
}

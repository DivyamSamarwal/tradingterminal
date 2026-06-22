const fs = require('fs');
const src = fs.readFileSync('js/app.js');
// Read the raw bytes. Note: fs.readFileSync without encoding returns a Buffer.
// Wait, PowerShell already corrupted it by reading it as Windows-1252 and saving as UTF-8!
// Let's verify what bytes are physically in the file right now.
// If the file is now UTF-8 but contains "₹", the bytes are: E2 80 9A E2 80 9A ...
// We need to decode the UTF-8 to a string ("₹"), then map each character's charCode back to a byte (0-255).
// BUT wait, Windows-1252 uses 0x82 for '�'. 
// So charCodeAt(i) won't be 0x82! It will be 0x201A!
// I need a map from Windows-1252 characters back to their original byte values!

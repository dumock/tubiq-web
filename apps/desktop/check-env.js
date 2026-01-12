const fs = require('fs');
const path = require('path');
const dotenvPath = path.join(__dirname, '.env');
try {
    if (fs.existsSync(dotenvPath)) {
        console.log('.env content:');
        console.log(fs.readFileSync(dotenvPath, 'utf8'));
    } else {
        console.log('.env does not exist');
    }
} catch (e) {
    console.error('Error reading .env:', e);
}

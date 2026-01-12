
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env.local');

try {
    let content = fs.readFileSync(envPath, 'utf8');

    // Check if YOUTUBE_API_KEY_1 is attached to previous line
    // Only fix if it doesn't start with a newline or isn't on its own line
    if (content.includes('YOUTUBE_API_KEY_1=') && !content.includes('\nYOUTUBE_API_KEY_1=')) {
        console.log('Detected inline YOUTUBE_API_KEY_1. Fixing...');
        content = content.replace(/YOUTUBE_API_KEY_1=/g, '\nYOUTUBE_API_KEY_1=');
        fs.writeFileSync(envPath, content, 'utf8');
        console.log('Fixed .env.local');
    } else {
        console.log('.env.local seems okay or key is already on new line.');
    }

} catch (e) {
    console.error('Error fixing .env.local:', e);
}

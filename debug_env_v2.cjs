require('dotenv').config({ path: '.env.local' });
console.log('--- START ENV DEBUG ---');
const relevantKeys = Object.keys(process.env).filter(k =>
    k.includes('SUPABASE') ||
    k.includes('YOUTUBE') ||
    k.includes('NEXT') ||
    k.includes('ROLE')
);

relevantKeys.forEach(k => {
    console.log(`${k}: ${process.env[k] ? 'EXISTS (length: ' + process.env[k].length + ')' : 'MISSING'}`);
});

if (process.env.SUPABASE_URL) console.log('SUPABASE_URL detected');
if (process.env.SUPABASE_SERVICE_ROLE_KEY) console.log('SUPABASE_SERVICE_ROLE_KEY detected');

console.log('--- END ENV DEBUG ---');

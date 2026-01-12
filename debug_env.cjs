require('dotenv').config({ path: '.env.local' });
console.log('--- Env Status ---');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'EXISTS' : 'MISSING');
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'EXISTS' : 'MISSING');
console.log('YOUTUBE_API_KEY_1:', process.env.YOUTUBE_API_KEY_1 ? 'EXISTS' : 'MISSING');
console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'EXISTS' : 'MISSING');
console.log('------------------');
console.log('Keys in process.env:', Object.keys(process.env).filter(k => k.includes('SUPABASE') || k.includes('YOUTUBE') || k.includes('NEXT')));

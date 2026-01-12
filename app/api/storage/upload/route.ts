import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const bucket = formData.get('bucket') as string || 'videos';
        const pathPrefix = formData.get('path') as string || 'uploads';

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        // 1. Initialize Supabase Client with Service Role (Admin)
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json({ error: 'Missing Supabase credentials' }, { status: 500 });
        }

        // 2. Authenticate User (Security Step)
        // Check for Authorization header (Bearer Token)
        const authHeader = request.headers.get('Authorization');
        let userId = 'anonymous'; // Default if no auth

        if (authHeader) {
            const token = authHeader.replace('Bearer ', '');
            // Create a client to verify the token
            const authClient = createClient(supabaseUrl, supabaseServiceKey);
            const { data: { user }, error: authError } = await authClient.auth.getUser(token);

            if (!authError && user) {
                userId = user.id;
            } else {
                console.warn('[Upload API] Invalid token:', authError?.message);
                // Depending on policy, we could reject here:
                // return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // 3. Namespace by User ID (Isolation Step)
        // Path becomes: videos/storyboard-images/{USER_ID}/{TIMESTAMP}_filename
        const fileName = `${pathPrefix}/${userId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;

        // Convert File to Buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Upload
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from(bucket)
            .upload(fileName, buffer, {
                contentType: file.type,
                upsert: true
            });

        if (uploadError) {
            console.error('Server upload error:', uploadError);
            return NextResponse.json({ error: uploadError.message }, { status: 500 });
        }

        // Get Signed URL
        const { data: signedData, error: signedError } = await supabase.storage
            .from(bucket)
            .createSignedUrl(fileName, 60 * 60 * 24 * 30); // 30 days

        if (signedError) {
            console.error('Signed URL error:', signedError);
            return NextResponse.json({ error: signedError.message }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            url: signedData.signedUrl,
            path: fileName,
            userId: userId // Return ID for debugging
        });

    } catch (error: any) {
        console.error('Upload handler error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase-server';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export async function POST(request: NextRequest) {
    try {
        const supabase = getSupabaseServer();

        // Get authenticated user
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json(
                { ok: false, message: 'Unauthorized' },
                { status: 401 }
            );
        }

        const token = authHeader.split(' ')[1];
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return NextResponse.json(
                { ok: false, message: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Get file from form data
        const formData = await request.formData();
        const file = formData.get('avatar') as File;

        if (!file) {
            return NextResponse.json(
                { ok: false, message: 'No file provided' },
                { status: 400 }
            );
        }

        // Validate file type
        if (!ALLOWED_TYPES.includes(file.type)) {
            return NextResponse.json(
                { ok: false, message: 'Invalid file type. Only JPG, PNG, and WebP are allowed.' },
                { status: 400 }
            );
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json(
                { ok: false, message: 'File too large. Maximum size is 2MB.' },
                { status: 400 }
            );
        }

        // Convert file to buffer
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Generate unique filename
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}-${Date.now()}.${fileExt}`;
        const filePath = `avatars/${fileName}`;

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase
            .storage
            .from('avatars')
            .upload(filePath, buffer, {
                contentType: file.type,
                upsert: true
            });

        if (uploadError) {
            console.error('Upload error:', uploadError);
            return NextResponse.json(
                { ok: false, message: 'Failed to upload file', error: uploadError.message },
                { status: 500 }
            );
        }

        // Get public URL
        const { data: { publicUrl } } = supabase
            .storage
            .from('avatars')
            .getPublicUrl(filePath);

        // Update user metadata with avatar URL
        const { error: updateError } = await supabase.auth.admin.updateUserById(
            user.id,
            {
                user_metadata: {
                    ...user.user_metadata,
                    avatar_url: publicUrl
                }
            }
        );

        if (updateError) {
            console.error('Metadata update error:', updateError);
            // Don't fail the request if metadata update fails
        }

        return NextResponse.json({
            ok: true,
            data: {
                avatar_url: publicUrl,
                message: 'Avatar uploaded successfully'
            }
        });

    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json(
            { ok: false, message: 'Internal server error', error: error.message },
            { status: 500 }
        );
    }
}

// GET endpoint to retrieve current avatar
export async function GET(request: NextRequest) {
    try {
        const supabase = getSupabaseServer();

        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json(
                { ok: false, message: 'Unauthorized' },
                { status: 401 }
            );
        }

        const token = authHeader.split(' ')[1];
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return NextResponse.json(
                { ok: false, message: 'Unauthorized' },
                { status: 401 }
            );
        }

        const avatarUrl = user.user_metadata?.avatar_url || null;

        return NextResponse.json({
            ok: true,
            data: {
                avatar_url: avatarUrl
            }
        });

    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json(
            { ok: false, message: 'Internal server error', error: error.message },
            { status: 500 }
        );
    }
}

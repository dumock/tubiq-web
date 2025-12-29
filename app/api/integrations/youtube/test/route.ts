import { NextResponse } from 'next/server';

const TEST_CHANNEL_ID = 'UC_x5XG1OV2P6uZZ5FSM9Ttw';

export async function GET() {
    const apiKey = process.env.YOUTUBE_API_KEY;

    if (!apiKey) {
        return NextResponse.json({ ok: false, message: "missing api key" }, { status: 400 });
    }

    try {
        const res = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${TEST_CHANNEL_ID}&key=${apiKey}`);

        if (!res.ok) {
            const errorData = await res.json();
            return NextResponse.json({ ok: false, message: errorData.error?.message || "YouTube API Error" }, { status: 500 });
        }

        const data = await res.json();

        if (!data.items || data.items.length === 0) {
            return NextResponse.json({ ok: false, message: "Channel not found" }, { status: 404 });
        }

        const title = data.items[0].snippet.title;
        return NextResponse.json({ ok: true, message: "youtube api connected", title });

    } catch (error: any) {
        return NextResponse.json({ ok: false, message: error.message || "Internal Server Error" }, { status: 500 });
    }
}

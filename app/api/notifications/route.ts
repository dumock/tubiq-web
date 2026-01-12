import { NextRequest, NextResponse } from 'next/server';

// Mock notifications - in production, this would come from database
// Start with empty array - notifications will be added by admin dashboard
let notifications: Array<{
    id: string;
    title: string;
    message: string;
    type: string;
    target: string;
    sentAt: string;
    status: string;
    isVisible: boolean;
    displayFrom?: string;
    displayUntil?: string;
}> = [];

export async function GET(request: NextRequest) {
    try {
        // Calculate relative time for each notification and filter by visibility
        const now = new Date();
        const visibleNotifications = notifications.filter(notif => {
            // Check if notification is set to visible
            if (!notif.isVisible) return false;

            // Check date range if specified
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (notif.displayFrom) {
                const fromDate = new Date(notif.displayFrom);
                fromDate.setHours(0, 0, 0, 0);
                if (today < fromDate) return false;
            }

            if (notif.displayUntil) {
                const untilDate = new Date(notif.displayUntil);
                untilDate.setHours(23, 59, 59, 999);
                if (new Date() > untilDate) return false;
            }

            return true;
        });

        const notificationsWithTime = visibleNotifications.map(notif => {
            const sentDate = new Date(notif.sentAt);
            const diffMs = now.getTime() - sentDate.getTime();
            const diffHours = Math.floor(diffMs / 3600000);
            const diffDays = Math.floor(diffMs / 86400000);

            let timeAgo = '';
            if (diffHours < 1) timeAgo = '방금 전';
            else if (diffHours < 24) timeAgo = `${diffHours}시간 전`;
            else timeAgo = `${diffDays}일 전`;

            return {
                id: notif.id,
                title: notif.title,
                message: notif.message,
                type: notif.type,
                time: timeAgo,
                isRead: false
            };
        });

        return NextResponse.json({
            ok: true,
            data: notificationsWithTime
        });
    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json(
            { ok: false, message: 'Internal server error', error: error.message },
            { status: 500 }
        );
    }
}

// POST endpoint to add new notification from admin dashboard
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { title, message, type, target } = body;

        if (!title || !message || !type) {
            return NextResponse.json(
                { ok: false, message: 'Missing required fields' },
                { status: 400 }
            );
        }

        const newNotification = {
            id: `n${Date.now()}`,
            title,
            message,
            type,
            target: target || 'All',
            sentAt: new Date().toLocaleString('ko-KR', { hour12: false }).slice(0, 16),
            status: 'Sent',
            isVisible: true, // Default to visible
            displayFrom: undefined,
            displayUntil: undefined
        };

        notifications.unshift(newNotification);

        return NextResponse.json({
            ok: true,
            data: newNotification,
            message: 'Notification created successfully'
        });
    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json(
            { ok: false, message: 'Internal server error', error: error.message },
            { status: 500 }
        );
    }
}

// DELETE endpoint to remove notification
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json(
                { ok: false, message: 'Missing notification ID' },
                { status: 400 }
            );
        }

        const initialLength = notifications.length;
        notifications = notifications.filter(n => n.id !== id);

        if (notifications.length === initialLength) {
            return NextResponse.json(
                { ok: false, message: 'Notification not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            ok: true,
            message: 'Notification deleted successfully'
        });
    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json(
            { ok: false, message: 'Internal server error', error: error.message },
            { status: 500 }
        );
    }
}

// PATCH endpoint to update notification
export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, title, message, isVisible, displayFrom, displayUntil } = body;

        if (!id) {
            return NextResponse.json(
                { ok: false, message: 'Missing notification ID' },
                { status: 400 }
            );
        }

        const notifIndex = notifications.findIndex(n => n.id === id);
        if (notifIndex === -1) {
            return NextResponse.json(
                { ok: false, message: 'Notification not found' },
                { status: 404 }
            );
        }

        // Update only provided fields
        notifications[notifIndex] = {
            ...notifications[notifIndex],
            ...(title !== undefined && { title }),
            ...(message !== undefined && { message }),
            ...(isVisible !== undefined && { isVisible }),
            ...(displayFrom !== undefined && { displayFrom }),
            ...(displayUntil !== undefined && { displayUntil })
        };

        return NextResponse.json({
            ok: true,
            data: notifications[notifIndex],
            message: 'Notification updated successfully'
        });
    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json(
            { ok: false, message: 'Internal server error', error: error.message },
            { status: 500 }
        );
    }
}

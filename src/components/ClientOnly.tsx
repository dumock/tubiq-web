'use client';

import { useEffect, useState } from 'react';

// Wrapper component to ensure children are only rendered on the client side
// This resolves hydration mismatch errors caused by libraries like dnd-kit that generate dynamic IDs
export default function ClientOnly({ children }: { children: React.ReactNode }) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return null;
    }

    return <>{children}</>;
}

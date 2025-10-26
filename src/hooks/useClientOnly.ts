'use client';

import { useEffect, useState } from 'react';

/**
 * Hook to ensure code only runs on the client side
 * Helps prevent hydration mismatches
 */
export function useClientOnly() {
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    return isClient;
}

/**
 * Hook to safely access window object
 * Returns null during SSR to prevent hydration issues
 */
export function useWindow() {
    const isClient = useClientOnly();
    return isClient ? window : null;
}
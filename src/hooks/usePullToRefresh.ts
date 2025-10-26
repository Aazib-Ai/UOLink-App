'use client';

import { useEffect, useRef, useState } from 'react';
import { isMobileDevice } from '@/lib/pwa';

interface PullToRefreshOptions {
    onRefresh: () => Promise<void> | void;
    threshold?: number;
    resistance?: number;
    enabled?: boolean;
}

export function usePullToRefresh({
    onRefresh,
    threshold = 80,
    resistance = 2.5,
    enabled = true
}: PullToRefreshOptions) {
    const [isPulling, setIsPulling] = useState(false);
    const [pullDistance, setPullDistance] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const startY = useRef(0);
    const currentY = useRef(0);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!enabled || !isMobileDevice()) return;

        const container = containerRef.current;
        if (!container) return;

        let isAtTop = true;

        const handleTouchStart = (e: TouchEvent) => {
            // Check if we're at the top of the page
            isAtTop = window.scrollY === 0;
            if (!isAtTop) return;

            startY.current = e.touches[0].clientY;
            setIsPulling(true);
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (!isPulling || !isAtTop) return;

            currentY.current = e.touches[0].clientY;
            const deltaY = currentY.current - startY.current;

            if (deltaY > 0) {
                e.preventDefault();
                const distance = Math.min(deltaY / resistance, threshold * 1.5);
                setPullDistance(distance);
            }
        };

        const handleTouchEnd = async () => {
            if (!isPulling) return;

            setIsPulling(false);

            if (pullDistance >= threshold && !isRefreshing) {
                setIsRefreshing(true);
                try {
                    await onRefresh();
                } finally {
                    setIsRefreshing(false);
                }
            }

            setPullDistance(0);
        };

        container.addEventListener('touchstart', handleTouchStart, { passive: false });
        container.addEventListener('touchmove', handleTouchMove, { passive: false });
        container.addEventListener('touchend', handleTouchEnd);

        return () => {
            container.removeEventListener('touchstart', handleTouchStart);
            container.removeEventListener('touchmove', handleTouchMove);
            container.removeEventListener('touchend', handleTouchEnd);
        };
    }, [enabled, isPulling, pullDistance, threshold, resistance, onRefresh, isRefreshing]);

    const shouldShowIndicator = isPulling && pullDistance > 20;
    const shouldTrigger = pullDistance >= threshold;

    return {
        containerRef,
        isPulling,
        pullDistance,
        isRefreshing,
        shouldShowIndicator,
        shouldTrigger
    };
}
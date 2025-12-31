/**
 * useNavigationState - Hook for managing component state persistence during navigation
 * Implements Requirements 7.3, 7.5
 * - Consistent component lifecycle
 * - Browser navigation state restoration
 */

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { usePageCache } from '../page-cache-context';

export interface UseNavigationStateOptions {
    /** 
     * Specific selectors to satisfy granular state requirements 
     * If omitted, default selectors from state-manager are used
     */
    selectors?: {
        filters?: string[];
        expandedSections?: string[];
        search?: string;
        forms?: string;
    };
    /** Whether to restore state automatically on mount (default: true) */
    restoreOnMount?: boolean;
    /** Whether to capture state automatically on unmount (default: true) */
    captureOnUnmount?: boolean;
}

export function useNavigationState(options: UseNavigationStateOptions = {}) {
    const pathname = usePathname();
    const { stateManager } = usePageCache();

    // Use refs to prevent effect re-running on option object reference change
    const optionsRef = useRef(options);
    optionsRef.current = options;

    useEffect(() => {
        const currentPath = pathname;
        if (!currentPath) return;

        const { restoreOnMount = true, captureOnUnmount = true, selectors } = optionsRef.current;

        // Restore state on mount/navigation to this page
        if (restoreOnMount) {
            // Use requestAnimationFrame to ensure DOM is fully rendered
            requestAnimationFrame(() => {
                // If specific selectors provided, we might want to pass them to restore?
                // stateManager.restoreState restores EVERYTHING stored for the route.
                // It iterates over stored data and tries to find elements.
                // So selectors are only needed for capture.
                stateManager.restoreState(currentPath);
            });
        }

        return () => {
            // Capture state on unmount/navigation away
            if (captureOnUnmount) {
                stateManager.captureState(currentPath, {
                    filterSelectors: selectors?.filters,
                    expandedSectionSelectors: selectors?.expandedSections,
                    searchSelector: selectors?.search,
                    formSelector: selectors?.forms
                });
            }
        };
    }, [pathname, stateManager]);
}

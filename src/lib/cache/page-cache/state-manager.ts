/**
 * StateManager - Manages UI state persistence across navigation
 * Implements Requirements 2.1, 2.2, 2.3, 2.4, 2.5
 * - Scroll position capture and restoration
 * - Filter state management
 * - UI element state tracking (expanded/collapsed sections)
 * - Search term preservation
 * - Form data persistence
 */

import { PageState, createEmptyPageState } from './types';

/**
 * Configuration options for StateManager
 */
export interface StateManagerConfig {
    /** Enable localStorage backup for persistence across sessions */
    enableLocalStorage?: boolean;
    /** Prefix for localStorage keys */
    localStoragePrefix?: string;
    /** Maximum number of states to keep in memory */
    maxStates?: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<StateManagerConfig> = {
    enableLocalStorage: false,
    localStoragePrefix: 'uolink_state_',
    maxStates: 10,
};

/**
 * StateManager handles UI state persistence across navigation
 */
export class StateManager {
    private stateStore: Map<string, PageState> = new Map();
    private config: Required<StateManagerConfig>;
    private routeAccessOrder: string[] = []; // Track access order for LRU

    constructor(config: StateManagerConfig = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };

        // Load states from localStorage if enabled
        if (this.config.enableLocalStorage) {
            this.loadFromLocalStorage();
        }
    }

    /**
     * Capture current page state
     * Requirement 2.1, 2.2, 2.3, 2.4, 2.5 - Capture all UI state
     */
    captureState(route: string, options?: {
        filterSelectors?: string[];
        expandedSectionSelectors?: string[];
        searchSelector?: string;
        formSelector?: string;
    }): PageState {
        const state: PageState = {
            scrollPosition: this.captureScrollPosition(),
            filters: this.captureFilters(options?.filterSelectors),
            expandedSections: this.captureExpandedSections(options?.expandedSectionSelectors),
            searchTerm: this.captureSearchTerm(options?.searchSelector),
            formData: this.captureFormData(options?.formSelector),
            customState: {},
        };

        this.setState(route, state);
        return state;
    }

    /**
     * Restore page state
     * Requirement 2.1, 2.2, 2.3, 2.4, 2.5 - Restore all UI state
     */
    restoreState(route: string, state?: PageState): boolean {
        const stateToRestore = state || this.getState(route);

        if (!stateToRestore) {
            return false;
        }

        // Restore in specific order for best UX
        // 1. Filters first (affects content)
        this.restoreFilters(stateToRestore.filters);

        // 2. Expanded sections (affects layout)
        this.restoreExpandedSections(stateToRestore.expandedSections);

        // 3. Form data
        this.restoreFormData(stateToRestore.formData);

        // 4. Search term
        this.restoreSearchTerm(stateToRestore.searchTerm);

        // 5. Scroll position last (after layout is stable)
        // Use requestAnimationFrame to ensure DOM is ready
        requestAnimationFrame(() => {
            this.restoreScrollPosition(stateToRestore.scrollPosition);
        });

        return true;
    }

    /**
     * Get stored state for a route
     */
    getState(route: string): PageState | null {
        const state = this.stateStore.get(route);

        if (state) {
            // Update access order for LRU
            this.updateAccessOrder(route);
        }

        return state || null;
    }

    /**
     * Store state for a route
     */
    setState(route: string, state: PageState): void {
        this.stateStore.set(route, state);
        this.updateAccessOrder(route);

        // Enforce max states limit using LRU
        if (this.stateStore.size > this.config.maxStates) {
            this.evictLRU();
        }

        // Persist to localStorage if enabled
        if (this.config.enableLocalStorage) {
            this.saveToLocalStorage(route, state);
        }
    }

    /**
     * Clear state for a route
     */
    clearState(route: string): void {
        this.stateStore.delete(route);
        this.routeAccessOrder = this.routeAccessOrder.filter(r => r !== route);

        if (this.config.enableLocalStorage) {
            this.removeFromLocalStorage(route);
        }
    }

    /**
     * Clear all stored states
     */
    clearAllStates(): void {
        this.stateStore.clear();
        this.routeAccessOrder = [];

        if (this.config.enableLocalStorage) {
            this.clearLocalStorage();
        }
    }

    /**
     * Capture scroll position
     * Requirement 2.2 - Scroll position memory
     */
    captureScrollPosition(): { x: number; y: number } {
        if (typeof window === 'undefined') {
            return { x: 0, y: 0 };
        }

        return {
            x: window.scrollX || window.pageXOffset || 0,
            y: window.scrollY || window.pageYOffset || 0,
        };
    }

    /**
     * Capture filter values from DOM
     * Requirement 2.1 - Filter preservation
     */
    captureFilters(selectors?: string[]): Record<string, any> {
        if (typeof window === 'undefined') {
            return {};
        }

        const filters: Record<string, any> = {};

        // Default selectors for common filter patterns
        const defaultSelectors = [
            'select[data-filter]',
            'input[data-filter]',
            'input[type="checkbox"][data-filter]',
            'input[type="radio"][data-filter]:checked',
        ];

        const selectorsToUse = selectors || defaultSelectors;

        selectorsToUse.forEach(selector => {
            try {
                const elements = document.querySelectorAll(selector);
                elements.forEach((element: Element) => {
                    const filterName = element.getAttribute('data-filter') ||
                        element.getAttribute('name') ||
                        element.getAttribute('id');

                    if (!filterName) return;

                    if (element instanceof HTMLInputElement) {
                        if (element.type === 'checkbox' || element.type === 'radio') {
                            filters[filterName] = element.checked;
                        } else {
                            filters[filterName] = element.value;
                        }
                    } else if (element instanceof HTMLSelectElement) {
                        filters[filterName] = element.value;
                    }
                });
            } catch (error) {
                console.warn(`Failed to capture filters for selector: ${selector}`, error);
            }
        });

        return filters;
    }

    /**
     * Capture expanded/collapsed UI elements
     * Requirement 2.4 - UI element state preservation
     */
    captureExpandedSections(selectors?: string[]): string[] {
        if (typeof window === 'undefined') {
            return [];
        }

        const expandedSections: string[] = [];

        // Default selectors for common expandable patterns
        const defaultSelectors = [
            '[data-expandable][data-expanded="true"]',
            '[aria-expanded="true"]',
            '.expanded[data-section-id]',
        ];

        const selectorsToUse = selectors || defaultSelectors;

        selectorsToUse.forEach(selector => {
            try {
                const elements = document.querySelectorAll(selector);
                elements.forEach((element: Element) => {
                    const sectionId = element.getAttribute('data-section-id') ||
                        element.getAttribute('id') ||
                        element.getAttribute('data-expandable');

                    if (sectionId) {
                        expandedSections.push(sectionId);
                    }
                });
            } catch (error) {
                console.warn(`Failed to capture expanded sections for selector: ${selector}`, error);
            }
        });

        return expandedSections;
    }

    /**
     * Capture search input value
     * Requirement 2.5 - Search text preservation
     */
    captureSearchTerm(selector?: string): string {
        if (typeof window === 'undefined') {
            return '';
        }

        const searchSelector = selector || 'input[type="search"], input[data-search], input[placeholder*="search" i]';

        try {
            const searchInput = document.querySelector(searchSelector);
            if (searchInput instanceof HTMLInputElement) {
                return searchInput.value;
            }
        } catch (error) {
            console.warn(`Failed to capture search term for selector: ${searchSelector}`, error);
        }

        return '';
    }

    /**
     * Capture form field values
     * Requirement 2.5 - Form data persistence
     */
    captureFormData(formSelector?: string): Record<string, any> {
        if (typeof window === 'undefined') {
            return {};
        }

        const formData: Record<string, any> = {};
        const selector = formSelector || 'form[data-persist]';

        try {
            const forms = document.querySelectorAll(selector);
            forms.forEach((form: Element) => {
                if (form instanceof HTMLFormElement) {
                    const formId = form.getAttribute('data-form-id') || form.id;
                    const data = new FormData(form);

                    const formValues: Record<string, any> = {};
                    data.forEach((value, key) => {
                        formValues[key] = value;
                    });

                    if (formId) {
                        formData[formId] = formValues;
                    }
                }
            });
        } catch (error) {
            console.warn(`Failed to capture form data for selector: ${selector}`, error);
        }

        return formData;
    }

    /**
     * Restore scroll position
     * Requirement 2.2 - Scroll position memory
     */
    restoreScrollPosition(position: { x: number; y: number }): void {
        if (typeof window === 'undefined') {
            return;
        }

        try {
            window.scrollTo(position.x, position.y);
        } catch (error) {
            console.warn('Failed to restore scroll position', error);
        }
    }

    /**
     * Restore filter selections
     * Requirement 2.1 - Filter preservation
     */
    restoreFilters(filters: Record<string, any>): void {
        if (typeof window === 'undefined') {
            return;
        }

        Object.entries(filters).forEach(([filterName, value]) => {
            try {
                // Try multiple selector patterns
                const selectors = [
                    `[data-filter="${filterName}"]`,
                    `[name="${filterName}"]`,
                    `#${filterName}`,
                ];

                for (const selector of selectors) {
                    const element = document.querySelector(selector);

                    if (element instanceof HTMLInputElement) {
                        if (element.type === 'checkbox' || element.type === 'radio') {
                            element.checked = Boolean(value);
                        } else {
                            element.value = String(value);
                        }
                        // Trigger change event for React/framework reactivity
                        element.dispatchEvent(new Event('change', { bubbles: true }));
                        break;
                    } else if (element instanceof HTMLSelectElement) {
                        element.value = String(value);
                        element.dispatchEvent(new Event('change', { bubbles: true }));
                        break;
                    }
                }
            } catch (error) {
                console.warn(`Failed to restore filter: ${filterName}`, error);
            }
        });
    }

    /**
     * Restore UI element states
     * Requirement 2.4 - UI element state preservation
     */
    restoreExpandedSections(sections: string[]): void {
        if (typeof window === 'undefined') {
            return;
        }

        sections.forEach(sectionId => {
            try {
                // Try multiple selector patterns
                const selectors = [
                    `[data-section-id="${sectionId}"]`,
                    `[data-expandable="${sectionId}"]`,
                    `#${sectionId}`,
                ];

                for (const selector of selectors) {
                    const element = document.querySelector(selector);

                    if (element) {
                        // Set expanded state
                        element.setAttribute('data-expanded', 'true');
                        element.setAttribute('aria-expanded', 'true');
                        element.classList.add('expanded');

                        // Trigger custom event for framework reactivity
                        element.dispatchEvent(new CustomEvent('expand', { bubbles: true }));
                        break;
                    }
                }
            } catch (error) {
                console.warn(`Failed to restore expanded section: ${sectionId}`, error);
            }
        });
    }

    /**
     * Restore search input
     * Requirement 2.5 - Search text preservation
     */
    restoreSearchTerm(term: string, selector?: string): void {
        if (typeof window === 'undefined' || !term) {
            return;
        }

        const searchSelector = selector || 'input[type="search"], input[data-search], input[placeholder*="search" i]';

        try {
            const searchInput = document.querySelector(searchSelector);
            if (searchInput instanceof HTMLInputElement) {
                searchInput.value = term;
                searchInput.dispatchEvent(new Event('input', { bubbles: true }));
                searchInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
        } catch (error) {
            console.warn('Failed to restore search term', error);
        }
    }

    /**
     * Restore form values
     * Requirement 2.5 - Form data persistence
     */
    restoreFormData(formData: Record<string, any>): void {
        if (typeof window === 'undefined') {
            return;
        }

        Object.entries(formData).forEach(([formId, values]) => {
            try {
                const selectors = [
                    `form[data-form-id="${formId}"]`,
                    `form#${formId}`,
                ];

                for (const selector of selectors) {
                    const form = document.querySelector(selector);

                    if (form instanceof HTMLFormElement) {
                        Object.entries(values as Record<string, any>).forEach(([fieldName, fieldValue]) => {
                            const field = form.elements.namedItem(fieldName);

                            if (field instanceof HTMLInputElement ||
                                field instanceof HTMLSelectElement ||
                                field instanceof HTMLTextAreaElement) {
                                field.value = String(fieldValue);
                                field.dispatchEvent(new Event('change', { bubbles: true }));
                            }
                        });
                        break;
                    }
                }
            } catch (error) {
                console.warn(`Failed to restore form data for: ${formId}`, error);
            }
        });
    }

    /**
     * Update access order for LRU eviction
     */
    private updateAccessOrder(route: string): void {
        // Remove if exists
        this.routeAccessOrder = this.routeAccessOrder.filter(r => r !== route);
        // Add to end (most recent)
        this.routeAccessOrder.push(route);
    }

    /**
     * Evict least recently used state
     */
    private evictLRU(): void {
        if (this.routeAccessOrder.length === 0) {
            return;
        }

        const lruRoute = this.routeAccessOrder[0];
        this.clearState(lruRoute);
    }

    /**
     * Load states from localStorage
     */
    private loadFromLocalStorage(): void {
        if (typeof window === 'undefined' || !window.localStorage) {
            return;
        }

        try {
            const keys = Object.keys(window.localStorage);
            keys.forEach(key => {
                if (key.startsWith(this.config.localStoragePrefix)) {
                    const route = key.substring(this.config.localStoragePrefix.length);
                    const stateJson = window.localStorage.getItem(key);

                    if (stateJson) {
                        const state = JSON.parse(stateJson) as PageState;
                        this.stateStore.set(route, state);
                        this.routeAccessOrder.push(route);
                    }
                }
            });
        } catch (error) {
            console.warn('Failed to load states from localStorage', error);
        }
    }

    /**
     * Save state to localStorage
     */
    private saveToLocalStorage(route: string, state: PageState): void {
        if (typeof window === 'undefined' || !window.localStorage) {
            return;
        }

        try {
            const key = this.config.localStoragePrefix + route;
            window.localStorage.setItem(key, JSON.stringify(state));
        } catch (error) {
            console.warn('Failed to save state to localStorage', error);
        }
    }

    /**
     * Remove state from localStorage
     */
    private removeFromLocalStorage(route: string): void {
        if (typeof window === 'undefined' || !window.localStorage) {
            return;
        }

        try {
            const key = this.config.localStoragePrefix + route;
            window.localStorage.removeItem(key);
        } catch (error) {
            console.warn('Failed to remove state from localStorage', error);
        }
    }

    /**
     * Clear all states from localStorage
     */
    private clearLocalStorage(): void {
        if (typeof window === 'undefined' || !window.localStorage) {
            return;
        }

        try {
            const keys = Object.keys(window.localStorage);
            keys.forEach(key => {
                if (key.startsWith(this.config.localStoragePrefix)) {
                    window.localStorage.removeItem(key);
                }
            });
        } catch (error) {
            console.warn('Failed to clear localStorage', error);
        }
    }

    /**
     * Get all stored routes (for testing)
     */
    getStoredRoutes(): string[] {
        return Array.from(this.stateStore.keys());
    }

    /**
     * Get number of stored states (for testing)
     */
    getStateCount(): number {
        return this.stateStore.size;
    }
}

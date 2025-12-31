/**
 * Property tests for StateManager
 * Tests Requirements 2.1, 2.2, 2.3, 2.4, 2.5
 * - Filter preservation across navigation
 * - Scroll position memory
 * - Combined state restoration
 * - UI element state preservation
 * - Search text preservation
 */

import { StateManager } from '../state-manager';
import { PageState } from '../types';

// Mock DOM environment for testing
const mockWindow = () => {
    if (typeof window === 'undefined') {
        // @ts-expect-error - Mock window for testing
        global.window = {
            scrollX: 0,
            scrollY: 0,
            pageXOffset: 0,
            pageYOffset: 0,
            scrollTo: jest.fn(),
            localStorage: {
                getItem: jest.fn(),
                setItem: jest.fn(),
                removeItem: jest.fn(),
                clear: jest.fn(),
                key: jest.fn(),
                length: 0,
            },
        };
        global.document = {
            querySelector: jest.fn(),
            // @ts-expect-error - Simplified mock for testing
            querySelectorAll: jest.fn(() => ({
                length: 0,
                item: () => null,
                forEach: () => { },
                [Symbol.iterator]: function* () { },
            })),
        };
        global.requestAnimationFrame = jest.fn(cb => setTimeout(cb, 0));
    }
};

describe('StateManager Property Tests', () => {
    let stateManager: StateManager;

    beforeEach(() => {
        mockWindow();
        stateManager = new StateManager({ enableLocalStorage: false });
    });

    afterEach(() => {
        stateManager.clearAllStates();
    });

    /**
     * Property 5: Filter preservation across navigation
     * Validates Requirement 2.1
     * 
     * For any set of applied filters on the dashboard, navigating away
     * and returning should preserve all filter selections
     */
    describe('Property 5: Filter preservation across navigation (Requirement 2.1)', () => {
        test('should preserve any filter configuration across navigation', () => {
            const iterations = 100;

            for (let i = 0; i < iterations; i++) {
                // Generate random filter configuration
                const filters = generateRandomFilters();
                const route = `/dashboard-${i}`;

                // Create state with filters
                const state: PageState = {
                    scrollPosition: { x: 0, y: 0 },
                    filters,
                    searchTerm: '',
                    expandedSections: [],
                    formData: {},
                    customState: {},
                };

                // Store state
                stateManager.setState(route, state);

                // Simulate navigation away and back
                const retrievedState = stateManager.getState(route);

                // Verify filters are preserved exactly
                expect(retrievedState).not.toBeNull();
                expect(retrievedState!.filters).toEqual(filters);

                // Verify all filter keys and values match
                Object.keys(filters).forEach(key => {
                    expect(retrievedState!.filters[key]).toBe(filters[key]);
                });
            }
        });

        test('should preserve complex nested filter structures', () => {
            const complexFilters = {
                semester: 'Fall 2024',
                subject: 'Computer Science',
                tags: ['AI', 'Machine Learning', 'Deep Learning'],
                dateRange: {
                    start: '2024-01-01',
                    end: '2024-12-31',
                },
                options: {
                    includeArchived: true,
                    sortBy: 'date',
                    order: 'desc',
                },
            };

            const state: PageState = {
                scrollPosition: { x: 0, y: 0 },
                filters: complexFilters,
                searchTerm: '',
                expandedSections: [],
                formData: {},
                customState: {},
            };

            stateManager.setState('/dashboard', state);
            const retrieved = stateManager.getState('/dashboard');

            expect(retrieved!.filters).toEqual(complexFilters);
        });

        test('should preserve empty filters', () => {
            const state: PageState = {
                scrollPosition: { x: 0, y: 0 },
                filters: {},
                searchTerm: '',
                expandedSections: [],
                formData: {},
                customState: {},
            };

            stateManager.setState('/dashboard', state);
            const retrieved = stateManager.getState('/dashboard');

            expect(retrieved!.filters).toEqual({});
        });
    });

    /**
     * Property 6: Scroll position memory
     * Validates Requirement 2.2
     * 
     * For any scroll position on any page, navigating away and returning
     * should restore the exact scroll position
     */
    describe('Property 6: Scroll position memory (Requirement 2.2)', () => {
        test('should preserve any scroll position across navigation', () => {
            const iterations = 100;

            for (let i = 0; i < iterations; i++) {
                // Generate random scroll position
                const scrollPosition = {
                    x: Math.floor(Math.random() * 10000),
                    y: Math.floor(Math.random() * 10000),
                };
                const route = `/page-${i}`;

                // Create state with scroll position
                const state: PageState = {
                    scrollPosition,
                    filters: {},
                    searchTerm: '',
                    expandedSections: [],
                    formData: {},
                    customState: {},
                };

                // Store state
                stateManager.setState(route, state);

                // Simulate navigation away and back
                const retrievedState = stateManager.getState(route);

                // Verify scroll position is preserved exactly
                expect(retrievedState).not.toBeNull();
                expect(retrievedState!.scrollPosition).toEqual(scrollPosition);
                expect(retrievedState!.scrollPosition.x).toBe(scrollPosition.x);
                expect(retrievedState!.scrollPosition.y).toBe(scrollPosition.y);
            }
        });

        test('should preserve zero scroll position', () => {
            const state: PageState = {
                scrollPosition: { x: 0, y: 0 },
                filters: {},
                searchTerm: '',
                expandedSections: [],
                formData: {},
                customState: {},
            };

            stateManager.setState('/page', state);
            const retrieved = stateManager.getState('/page');

            expect(retrieved!.scrollPosition).toEqual({ x: 0, y: 0 });
        });

        test('should preserve large scroll positions', () => {
            const state: PageState = {
                scrollPosition: { x: 999999, y: 999999 },
                filters: {},
                searchTerm: '',
                expandedSections: [],
                formData: {},
                customState: {},
            };

            stateManager.setState('/page', state);
            const retrieved = stateManager.getState('/page');

            expect(retrieved!.scrollPosition).toEqual({ x: 999999, y: 999999 });
        });
    });

    /**
     * Property 7: Combined state restoration
     * Validates Requirement 2.3
     * 
     * For any filtered view with a scroll position, returning to that view
     * should restore both the filtered results and the scroll position
     */
    describe('Property 7: Combined state restoration (Requirement 2.3)', () => {
        test('should preserve both filters and scroll position together', () => {
            const iterations = 100;

            for (let i = 0; i < iterations; i++) {
                // Generate random combined state
                const filters = generateRandomFilters();
                const scrollPosition = {
                    x: Math.floor(Math.random() * 5000),
                    y: Math.floor(Math.random() * 5000),
                };
                const route = `/filtered-page-${i}`;

                // Create state with both filters and scroll position
                const state: PageState = {
                    scrollPosition,
                    filters,
                    searchTerm: '',
                    expandedSections: [],
                    formData: {},
                    customState: {},
                };

                // Store state
                stateManager.setState(route, state);

                // Simulate navigation away and back
                const retrievedState = stateManager.getState(route);

                // Verify both filters and scroll position are preserved
                expect(retrievedState).not.toBeNull();
                expect(retrievedState!.filters).toEqual(filters);
                expect(retrievedState!.scrollPosition).toEqual(scrollPosition);

                // Verify they're restored together, not independently
                expect(retrievedState!.filters).toBeTruthy();
                expect(retrievedState!.scrollPosition).toBeTruthy();
            }
        });

        test('should preserve complex combined state', () => {
            const state: PageState = {
                scrollPosition: { x: 1500, y: 3000 },
                filters: {
                    semester: 'Spring 2024',
                    subject: 'Mathematics',
                    difficulty: 'Advanced',
                },
                searchTerm: 'calculus',
                expandedSections: ['section-1', 'section-3'],
                formData: {},
                customState: {},
            };

            stateManager.setState('/complex-page', state);
            const retrieved = stateManager.getState('/complex-page');

            expect(retrieved).toEqual(state);
        });
    });

    /**
     * Property 8: UI element state preservation
     * Validates Requirement 2.4
     * 
     * For any combination of expanded or collapsed UI elements, navigating
     * away and returning should maintain those exact states
     */
    describe('Property 8: UI element state preservation (Requirement 2.4)', () => {
        test('should preserve any combination of expanded sections', () => {
            const iterations = 100;

            for (let i = 0; i < iterations; i++) {
                // Generate random expanded sections
                const expandedSections = generateRandomExpandedSections();
                const route = `/page-${i}`;

                // Create state with expanded sections
                const state: PageState = {
                    scrollPosition: { x: 0, y: 0 },
                    filters: {},
                    searchTerm: '',
                    expandedSections,
                    formData: {},
                    customState: {},
                };

                // Store state
                stateManager.setState(route, state);

                // Simulate navigation away and back
                const retrievedState = stateManager.getState(route);

                // Verify expanded sections are preserved exactly
                expect(retrievedState).not.toBeNull();
                expect(retrievedState!.expandedSections).toEqual(expandedSections);
                expect(retrievedState!.expandedSections.length).toBe(expandedSections.length);

                // Verify all section IDs match
                expandedSections.forEach(sectionId => {
                    expect(retrievedState!.expandedSections).toContain(sectionId);
                });
            }
        });

        test('should preserve empty expanded sections', () => {
            const state: PageState = {
                scrollPosition: { x: 0, y: 0 },
                filters: {},
                searchTerm: '',
                expandedSections: [],
                formData: {},
                customState: {},
            };

            stateManager.setState('/page', state);
            const retrieved = stateManager.getState('/page');

            expect(retrieved!.expandedSections).toEqual([]);
        });

        test('should preserve many expanded sections', () => {
            const expandedSections = Array.from({ length: 50 }, (_, i) => `section-${i}`);
            const state: PageState = {
                scrollPosition: { x: 0, y: 0 },
                filters: {},
                searchTerm: '',
                expandedSections,
                formData: {},
                customState: {},
            };

            stateManager.setState('/page', state);
            const retrieved = stateManager.getState('/page');

            expect(retrieved!.expandedSections).toEqual(expandedSections);
            expect(retrieved!.expandedSections.length).toBe(50);
        });
    });

    /**
     * Property 9: Search text preservation
     * Validates Requirement 2.5
     * 
     * For any search text entered in search fields, navigating away and
     * returning should preserve the search text
     */
    describe('Property 9: Search text preservation (Requirement 2.5)', () => {
        test('should preserve any search text across navigation', () => {
            const iterations = 100;

            for (let i = 0; i < iterations; i++) {
                // Generate random search term
                const searchTerm = generateRandomSearchTerm();
                const route = `/search-page-${i}`;

                // Create state with search term
                const state: PageState = {
                    scrollPosition: { x: 0, y: 0 },
                    filters: {},
                    searchTerm,
                    expandedSections: [],
                    formData: {},
                    customState: {},
                };

                // Store state
                stateManager.setState(route, state);

                // Simulate navigation away and back
                const retrievedState = stateManager.getState(route);

                // Verify search term is preserved exactly
                expect(retrievedState).not.toBeNull();
                expect(retrievedState!.searchTerm).toBe(searchTerm);
            }
        });

        test('should preserve empty search term', () => {
            const state: PageState = {
                scrollPosition: { x: 0, y: 0 },
                filters: {},
                searchTerm: '',
                expandedSections: [],
                formData: {},
                customState: {},
            };

            stateManager.setState('/page', state);
            const retrieved = stateManager.getState('/page');

            expect(retrieved!.searchTerm).toBe('');
        });

        test('should preserve special characters in search term', () => {
            const specialSearchTerms = [
                'hello@world.com',
                'test & development',
                'C++ programming',
                'React.js <Component>',
                '日本語 search',
                'emoji 🚀 test',
                'multi\nline\ntext',
            ];

            specialSearchTerms.forEach((searchTerm, i) => {
                const state: PageState = {
                    scrollPosition: { x: 0, y: 0 },
                    filters: {},
                    searchTerm,
                    expandedSections: [],
                    formData: {},
                    customState: {},
                };

                stateManager.setState(`/page-${i}`, state);
                const retrieved = stateManager.getState(`/page-${i}`);

                expect(retrieved!.searchTerm).toBe(searchTerm);
            });
        });

        test('should preserve long search terms', () => {
            const longSearchTerm = 'a'.repeat(1000);
            const state: PageState = {
                scrollPosition: { x: 0, y: 0 },
                filters: {},
                searchTerm: longSearchTerm,
                expandedSections: [],
                formData: {},
                customState: {},
            };

            stateManager.setState('/page', state);
            const retrieved = stateManager.getState('/page');

            expect(retrieved!.searchTerm).toBe(longSearchTerm);
            expect(retrieved!.searchTerm.length).toBe(1000);
        });
    });

    /**
     * Additional tests for StateManager functionality
     */
    describe('StateManager Core Functionality', () => {
        test('should handle multiple routes independently', () => {
            const routes = ['/dashboard', '/profile', '/timetable', '/settings'];
            const states: PageState[] = routes.map((route, i) => ({
                scrollPosition: { x: i * 100, y: i * 200 },
                filters: { filter: `value-${i}` },
                searchTerm: `search-${i}`,
                expandedSections: [`section-${i}`],
                formData: {},
                customState: {},
            }));

            // Store all states
            routes.forEach((route, i) => {
                stateManager.setState(route, states[i]);
            });

            // Verify all states are independent
            routes.forEach((route, i) => {
                const retrieved = stateManager.getState(route);
                expect(retrieved).toEqual(states[i]);
            });
        });

        test('should enforce max states limit with LRU eviction', () => {
            const maxStates = 5;
            const manager = new StateManager({ maxStates, enableLocalStorage: false });

            // Add more states than the limit
            for (let i = 0; i < 10; i++) {
                const state: PageState = {
                    scrollPosition: { x: i, y: i },
                    filters: {},
                    searchTerm: '',
                    expandedSections: [],
                    formData: {},
                    customState: {},
                };
                manager.setState(`/page-${i}`, state);
            }

            // Should only keep the most recent 5
            expect(manager.getStateCount()).toBe(maxStates);

            // Oldest states should be evicted
            expect(manager.getState('/page-0')).toBeNull();
            expect(manager.getState('/page-1')).toBeNull();

            // Recent states should be retained
            expect(manager.getState('/page-9')).not.toBeNull();
            expect(manager.getState('/page-8')).not.toBeNull();
        });

        test('should update access order on get', () => {
            const manager = new StateManager({ maxStates: 3, enableLocalStorage: false });

            // Add 3 states
            for (let i = 0; i < 3; i++) {
                manager.setState(`/page-${i}`, {
                    scrollPosition: { x: 0, y: 0 },
                    filters: {},
                    searchTerm: '',
                    expandedSections: [],
                    formData: {},
                    customState: {},
                });
            }

            // Access page-0 to make it most recent
            manager.getState('/page-0');

            // Add a new state (should evict page-1, not page-0)
            manager.setState('/page-3', {
                scrollPosition: { x: 0, y: 0 },
                filters: {},
                searchTerm: '',
                expandedSections: [],
                formData: {},
                customState: {},
            });

            expect(manager.getState('/page-0')).not.toBeNull(); // Should be retained
            expect(manager.getState('/page-1')).toBeNull(); // Should be evicted
        });

        test('should clear individual state', () => {
            stateManager.setState('/page-1', {
                scrollPosition: { x: 0, y: 0 },
                filters: {},
                searchTerm: '',
                expandedSections: [],
                formData: {},
                customState: {},
            });

            expect(stateManager.getState('/page-1')).not.toBeNull();

            stateManager.clearState('/page-1');

            expect(stateManager.getState('/page-1')).toBeNull();
        });

        test('should clear all states', () => {
            for (let i = 0; i < 5; i++) {
                stateManager.setState(`/page-${i}`, {
                    scrollPosition: { x: 0, y: 0 },
                    filters: {},
                    searchTerm: '',
                    expandedSections: [],
                    formData: {},
                    customState: {},
                });
            }

            expect(stateManager.getStateCount()).toBe(5);

            stateManager.clearAllStates();

            expect(stateManager.getStateCount()).toBe(0);
        });
    });
});

/**
 * Helper functions to generate random test data
 */

function generateRandomFilters(): Record<string, any> {
    const filterTypes = ['semester', 'subject', 'difficulty', 'tags', 'dateRange', 'sortBy'];
    const numFilters = Math.floor(Math.random() * 5) + 1;
    const filters: Record<string, any> = {};

    for (let i = 0; i < numFilters; i++) {
        const filterType = filterTypes[Math.floor(Math.random() * filterTypes.length)];

        switch (filterType) {
            case 'semester':
                filters.semester = ['Fall 2024', 'Spring 2024', 'Summer 2024'][Math.floor(Math.random() * 3)];
                break;
            case 'subject':
                filters.subject = ['Math', 'CS', 'Physics', 'Chemistry'][Math.floor(Math.random() * 4)];
                break;
            case 'difficulty':
                filters.difficulty = ['Easy', 'Medium', 'Hard'][Math.floor(Math.random() * 3)];
                break;
            case 'tags':
                filters.tags = Array.from({ length: Math.floor(Math.random() * 3) + 1 },
                    () => `tag-${Math.floor(Math.random() * 10)}`);
                break;
            case 'dateRange':
                filters.dateRange = {
                    start: `2024-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-01`,
                    end: `2024-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-28`,
                };
                break;
            case 'sortBy':
                filters.sortBy = ['date', 'name', 'priority'][Math.floor(Math.random() * 3)];
                break;
        }
    }

    return filters;
}

function generateRandomExpandedSections(): string[] {
    const numSections = Math.floor(Math.random() * 10);
    return Array.from({ length: numSections }, (_, i) => `section-${i}-${Math.random().toString(36).substring(7)}`);
}

function generateRandomSearchTerm(): string {
    const terms = [
        'calculus',
        'linear algebra',
        'machine learning',
        'data structures',
        'algorithms',
        'physics',
        'chemistry',
        'biology',
        'history',
        'literature',
        '',
        'test 123',
        'search with spaces',
        'special!@#$%',
    ];
    return terms[Math.floor(Math.random() * terms.length)];
}

/**
 * Property tests for PageCacheProvider context
 * Tests Requirements 5.4, 5.5
 * - Context notification on cache population
 * - Graceful error handling
 */

import React from 'react';
import { render, act, renderHook } from '@testing-library/react';
import { PageCacheProvider, usePageCache } from '../page-cache-context';
import { CacheManager, PageType, ContentType, CacheEntryMetadata } from '../cache-manager';
import * as fastCheck from 'fast-check';

// Mock dependecies
jest.mock('../background-refresh-manager');
jest.mock('../navigation-guard');
// We use real CacheManager for state but mock IndexedDB inside it (via fake-indexeddb setup)

describe('PageCacheProvider Property Tests', () => {

    /**
     * Property 21: Context notification on cache population
     * Validates Requirement 5.4
     * 
     * When the cache is populated or updated, subscribed components
     * should receive notifications with the new data
     */
    describe('Property 21: Context notification on cache population (Requirement 5.4)', () => {
        test('should notify subscribers when cache entry is set', async () => {
            await fastCheck.assert(
                fastCheck.asyncProperty(
                    fastCheck.string(), // key
                    fastCheck.string(), // data
                    async (key, data) => {
                        // Skip empty keys
                        if (!key) return;

                        let receivedData: any = null;
                        const callback = jest.fn((d) => { receivedData = d; });

                        const wrapper = ({ children }: { children: React.ReactNode }) => (
                            <PageCacheProvider>{ children } </PageCacheProvider>
                        );

                        const { result } = renderHook(() => usePageCache(), { wrapper });

                        // Subscribe
                        await act(async () => {
                            result.current.subscribeToUpdates(key, callback);
                        });

                        // Set cache entry
                        const metadata: CacheEntryMetadata = {
                            pageType: PageType.OTHER,
                            contentType: ContentType.GENERIC,
                            route: '/test'
                        };

                        await act(async () => {
                            await result.current.setCacheEntry(key, data, metadata);
                        });

                        // Verify notification
                        expect(callback).toHaveBeenCalled();
                        expect(receivedData).toEqual(data);
                    }
                )
            );
        });

        test('should allow multiple subscribers for the same key', async () => {
            const key = 'test-key';
            const data = 'test-data';

            const callback1 = jest.fn();
            const callback2 = jest.fn();

            const wrapper = ({ children }: { children: React.ReactNode }) => (
                <PageCacheProvider>{ children } </PageCacheProvider>
            );

            const { result } = renderHook(() => usePageCache(), { wrapper });

            act(() => {
                result.current.subscribeToUpdates(key, callback1);
                result.current.subscribeToUpdates(key, callback2);
            });

            const metadata: CacheEntryMetadata = {
                pageType: PageType.OTHER,
                contentType: ContentType.GENERIC,
                route: '/test'
            };

            await act(async () => {
                await result.current.setCacheEntry(key, data, metadata);
            });

            expect(callback1).toHaveBeenCalledWith(data);
            expect(callback2).toHaveBeenCalledWith(data);
        });

        test('should unsubscribe correctly', async () => {
            const key = 'test-key';
            const data = 'test-data';
            const callback = jest.fn();

            const wrapper = ({ children }: { children: React.ReactNode }) => (
                <PageCacheProvider>{ children } </PageCacheProvider>
            );

            const { result } = renderHook(() => usePageCache(), { wrapper });

            let unsubscribe: () => void;
            act(() => {
                unsubscribe = result.current.subscribeToUpdates(key, callback);
            });

            // Unsubscribe
            act(() => {
                unsubscribe();
            });

            const metadata: CacheEntryMetadata = {
                pageType: PageType.OTHER,
                contentType: ContentType.GENERIC,
                route: '/test'
            };

            await act(async () => {
                await result.current.setCacheEntry(key, data, metadata);
            });

            expect(callback).not.toHaveBeenCalled();
        });
    });

    /**
     * Property 22: Graceful error handling
     * Validates Requirement 5.5
     * 
     * The system should handle errors gracefully without crashing the component tree,
     * maintaining a valid state and providing error information
     */
    describe('Property 22: Graceful error handling (Requirement 5.5)', () => {
        test('should catch errors during cache operations and expose them via context', async () => {
            const wrapper = ({ children }: { children: React.ReactNode }) => (
                <PageCacheProvider>{ children } </PageCacheProvider>
            );

            const { result } = renderHook(() => usePageCache(), { wrapper });

            // Simulate an error by mocking the internal cache manager to throw
            // We can't easily mock the internal instance created inside Provider without
            // dependency injection or more complex mocking.
            // Instead, we'll try to trigger an error by passing invalid data if possible,
            // or check if we can spy on the cacheManager from the result.

            // Since we return the real CacheManager instance, let's spy on its set method
            // AFTER it's been initialized and returned by the hook.
            const error = new Error('Simulated cache error');
            jest.spyOn(result.current.cacheManager, 'set').mockRejectedValueOnce(error);

            const metadata: CacheEntryMetadata = {
                pageType: PageType.OTHER,
                contentType: ContentType.GENERIC,
                route: '/test'
            };

            await act(async () => {
                await result.current.setCacheEntry('key', 'data', metadata);
            });

            expect(result.current.lastError).toEqual(error);

            // Clear error
            act(() => {
                result.current.clearError();
            });

            expect(result.current.lastError).toBeNull();
        });

        test('should not crash when getCacheEntry fails', async () => {
            const wrapper = ({ children }: { children: React.ReactNode }) => (
                <PageCacheProvider>{ children } </PageCacheProvider>
            );

            const { result } = renderHook(() => usePageCache(), { wrapper });
            const error = new Error('Simulated get error');
            jest.spyOn(result.current.cacheManager, 'get').mockRejectedValueOnce(error);

            let value;
            await act(async () => {
                value = await result.current.getCacheEntry('key');
            });

            expect(value).toBeNull();
            expect(result.current.lastError).toEqual(error);
        });
    });
});

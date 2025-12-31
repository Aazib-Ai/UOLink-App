import '@testing-library/jest-dom';

// Polyfill for structuredClone (needed for fake-indexeddb in Node < 17)
if (typeof global.structuredClone === 'undefined') {
    (global as any).structuredClone = (obj: any) => {
        return JSON.parse(JSON.stringify(obj));
    };
}

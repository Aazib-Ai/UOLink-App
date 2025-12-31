// Polyfill for structuredClone (needed for fake-indexeddb in Node < 17)
if (typeof global.structuredClone === 'undefined') {
    global.structuredClone = (obj) => {
        return JSON.parse(JSON.stringify(obj));
    };
}

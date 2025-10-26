import { getNotes, searchNotes, getFilterOptions } from './notes';

export const searchService = {
    searchNotes,
    getNotes,
    getFilterOptions,
};

// Re-export for direct access
export { searchNotes, getNotes, getFilterOptions };
// Re-export Firebase app configuration and instances
export { app, auth, db } from './firebase/app';

// Re-export data types
export type {
    CommentRecord,
    CommentReplyRecord,
    UserProfile,
    NoteScoreInputs,
    NoteScoreState,
    VoteOnNoteResult,
    ToggleSaveNoteResult,
    Note,
    NotesQueryResult,
    CommentsPageResult,
} from './data/types';

// Re-export utilities
export {
    toTitleCase,
    normalizeForStorage,
    slugify,
    toNumber,
    clampNonNegative,
    readString,
    readNumber,
} from './data/common';

export {
    computeCredibilityScore,
    readNoteScoreState,
    buildNoteScoreUpdate,
} from './data/note-utils';

export {
    resolveNoteFileMetadata,
} from './data/r2-utils';

// Re-export domain services
export * as notesService from './firebase/notes';
export * as profilesService from './firebase/profiles';
export * as commentsService from './firebase/comments';
export * as reportsService from './firebase/reports';
export * as auraService from './firebase/aura';
export * as searchService from './firebase/search';
export * as profileResolver from './firebase/profile-resolver';
export * as passwordService from './firebase/password-service';

// Legacy exports for backward compatibility
import {
    getNotes,
    getNotesWithPagination,
    getInitialNotes,
    searchNotes,
    getFilterOptions,
    getTotalNotesCount,
    getAllNotesWithFilters,
    getNotesForProfile,
} from './firebase/notes';

import {
    getAuraLeaderboard,
    getUserProfile,
    getUserProfileByUsername,
    getUserProfileByFullName,
} from './firebase/profiles';


import {
    getUserByUsernameOnly,
    getUserByIdOnly,
    isValidUsernameFormat,
    extractUsernameFromPath,
    generateProfileUrl,
    isValidProfileUrl,
} from './firebase/profile-resolver';

import {
    usernameCache,
    warmUsernameCache,
    schedulePeriodicCacheWarming,
    getCacheWarmingStats,
    initializeCache,
    initializeCacheDev
} from './cache';

// Migrate comment mutations to server API wrappers
import { addComment, likeComment, deleteComment, addReply } from './api/comments'
import { fetchCommentsPage, getComments, fetchReplies } from './firebase/comments'

// Reports legacy functions are deprecated; use lib/api/reports instead

// Legacy exports for backward compatibility - these re-export the domain services
export {
    getNotes,
    getNotesWithPagination,
    getInitialNotes,
    searchNotes,
    getFilterOptions,
    getTotalNotesCount,
    getAllNotesWithFilters,
    getNotesForProfile,
    addComment,
    fetchCommentsPage,
    getComments,
    likeComment,
    deleteComment,
    addReply,
    fetchReplies,
    getAuraLeaderboard,
    getUserProfile,
    getUserProfileByUsername,
    getUserProfileByFullName,
    getUserByUsernameOnly,
    getUserByIdOnly,
    isValidUsernameFormat,
    extractUsernameFromPath,
    generateProfileUrl,
    isValidProfileUrl,
    // Cache functionality
    usernameCache,
    warmUsernameCache,
    schedulePeriodicCacheWarming,
    getCacheWarmingStats,
    initializeCache,
    initializeCacheDev
};

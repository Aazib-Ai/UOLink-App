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
export * as usernameService from './firebase/username-service';
export * as profileResolver from './firebase/profile-resolver';
export * as passwordService from './firebase/password-service';

// Legacy exports for backward compatibility
import {
    addNote,
    getNotes,
    getNotesWithPagination,
    getInitialNotes,
    searchNotes,
    getFilterOptions,
    getTotalNotesCount,
    getAllNotesWithFilters,
    getNotesForProfile,
    voteOnNote,
    toggleSaveNote,
} from './firebase/notes';

import {
    getAuraLeaderboard,
    getUserProfile,
    getUserProfileByUsername,
    getUserProfileByFullName,
    updateProfileUsername,
} from './firebase/profiles';

import {
    checkAvailability,
    reserveUsername,
    getUserByUsername,
    generateSuggestions,
    changeUsername,
} from './firebase/username-service';

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

import {
    addComment,
    fetchCommentsPage,
    getComments,
    likeComment,
    deleteComment,
    addReply,
    fetchReplies,
} from './firebase/comments';

import {
    reportContent,
    getReportStatus,
    undoReport,
} from './firebase/reports';

// Legacy exports for backward compatibility - these re-export the domain services
export {
    addNote,
    getNotes,
    getNotesWithPagination,
    getInitialNotes,
    searchNotes,
    getFilterOptions,
    getTotalNotesCount,
    getAllNotesWithFilters,
    getNotesForProfile,
    voteOnNote,
    toggleSaveNote,
    addComment,
    fetchCommentsPage,
    getComments,
    likeComment,
    deleteComment,
    addReply,
    fetchReplies,
    reportContent,
    getReportStatus,
    undoReport,
    getAuraLeaderboard,
    getUserProfile,
    getUserProfileByUsername,
    getUserProfileByFullName,
    updateProfileUsername,
    checkAvailability,
    reserveUsername,
    getUserByUsername,
    generateSuggestions,
    changeUsername,
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

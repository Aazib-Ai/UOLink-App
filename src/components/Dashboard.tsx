'use client'

import { useState, useEffect, useContext, useMemo, useCallback } from "react"
import { getInitialNotes, getNotesWithPagination, getFilterOptions, getAllNotesWithFilters, toggleSaveNote, db, auth } from "@/lib/firebase"
import { getAuraTier, formatAura } from "@/lib/aura"
import { toTitleCase, slugify, normalizeForStorage } from "@/lib/utils"
import CustomSelect from "./CustomSelect"
import { ArrowUp, Trash, Bookmark, X, User, Filter, Search, ChevronDown, Flame, Skull } from "lucide-react"
import "@/styles/loader.css"
import Skeleton from "react-loading-skeleton"
import "react-loading-skeleton/dist/skeleton.css"
import { MorphingText } from "@/components/ui/morphing-text"
import { useRouter } from "next/navigation"
import { collection, getDocs } from "firebase/firestore"
import { useNotes } from "@/contexts/NotesContext"
import { useSavedNotes } from "@/contexts/SavedNotesContext"
import NotesLoader from "./NotesLoader"
import Link from "next/link"
import { useAuth } from "@/contexts/AuthContext"
import PDFThumbnail from "./PDFThumbnail"
import VoteButton from "./VoteButton"
import ReportButton from "./ReportButton"
import { getUserProfileByName } from "@/lib/firebase"
import DeleteConfirmModal from "./DeleteConfirmModal"
import { MAJOR_NAMES } from "@/constants/universityData"

const donators: Array<{ name: string; amount: number }> = []

const r2PublicBaseUrl =
  (process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL || process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL || '').trim()

const r2Hostname = (() => {
  if (!r2PublicBaseUrl) {
    return ''
  }

  try {
    return new URL(r2PublicBaseUrl).hostname.toLowerCase()
  } catch {
    return ''
  }
})()

const isPDFUrl = (url: string) => {
  const lowerUrl = url.toLowerCase()
  if (lowerUrl.includes('.pdf')) {
    return true
  }

  return r2Hostname ? lowerUrl.includes(r2Hostname) : false
}

type SortMode = 'trending' | 'top' | 'latest'

const SORT_OPTIONS: Array<{ value: SortMode; label: string }> = [
  { value: 'trending', label: 'Trending' },
  { value: 'top', label: 'Top Rated' },
  { value: 'latest', label: 'Latest' },
]

function Dashboard() {
  const { user } = useAuth()
  const [notes, setNotes] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [lastDocSnapshot, setLastDocSnapshot] = useState<any>(null)
    const [filterOptions, setFilterOptions] = useState<any>({
    subjects: [],
    teachers: [],
    semesters: [],
    sections: [],
    majors: [],
    materialTypes: [],
    materialSequences: [],
  })
  const [error, setError] = useState<string | null>(null)

  // Mobile filter visibility state
  const [showFilters, setShowFilters] = useState(false)

  // Filter state
  const [titleFilter, setTitleFilter] = useState("")
  const [semesterFilter, setSemesterFilter] = useState("")
  const [subjectFilter, setSubjectFilter] = useState("")
  const [nameFilter, setNameFilter] = useState("")
  const [teacherFilter, setTeacherFilter] = useState("")
  const [sectionFilter, setSectionFilter] = useState("")
  const [majorFilter, setMajorFilter] = useState("")
  const [materialTypeFilter, setMaterialTypeFilter] = useState("")
  const [materialSequenceFilter, setMaterialSequenceFilter] = useState("")
  const [sortMode, setSortMode] = useState<SortMode>('trending')

  // Admin Email - you should set this in environment variables
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "admin@example.com"
  const [admin, setAdmin] = useState(false)

  const router = useRouter()
  const [savingNotes, setSavingNotes] = useState(false)
  const [savedNotes, setSavedNotes] = useState<Record<string, boolean>>({})
  const [profilePictures, setProfilePictures] = useState<Record<string, string | undefined>>({})
  const [profileSlugs, setProfileSlugs] = useState<Record<string, string>>({})
  const [profileAura, setProfileAura] = useState<Record<string, { aura: number; tierName: string; badgeClass: string; borderClass: string }>>({})

  // Delete confirmation modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [noteToDelete, setNoteToDelete] = useState<{ id: string; title: string; subject: string } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const formatMaterialType = (value: string) => {
    if (!value) {
      return 'Not specified'
    }
    return toTitleCase(value.replace(/-/g, ' '))
  }

  const materialTypeDisplayMap = useMemo(() => {
    const map = new Map<string, string>()
    const types = Array.isArray(filterOptions.materialTypes) ? filterOptions.materialTypes : []
    types.forEach((type: string) => {
      if (!type) {
        return
      }
      const label = formatMaterialType(type)
      map.set(label, type)
    })
    return map
  }, [filterOptions.materialTypes])

  const materialTypeOptionsList = useMemo(() => {
    return ['Select Material Type', ...Array.from(materialTypeDisplayMap.keys())]
  }, [materialTypeDisplayMap])

  const sectionOptionsList = useMemo(() => {
    const sections = Array.isArray(filterOptions.sections) ? filterOptions.sections : []
    return ['Select Section', ...sections.map((section: string) => section.toUpperCase())]
  }, [filterOptions.sections])

  const materialSequenceOptionsList = useMemo(() => {
    const sequences = Array.isArray(filterOptions.materialSequences) ? filterOptions.materialSequences : []
    const sequenceLabel =
      materialTypeFilter === 'assignment'
        ? 'Select Assignment'
        : materialTypeFilter === 'quiz'
        ? 'Select Quiz'
        : 'Select Number'
    return [sequenceLabel, ...sequences]
  }, [filterOptions.materialSequences, materialTypeFilter])

  const materialTypeLabel = useMemo(
    () => (materialTypeFilter ? formatMaterialType(materialTypeFilter) : ''),
    [materialTypeFilter]
  )

  const isSequenceFilterEnabled = materialTypeFilter === 'assignment' || materialTypeFilter === 'quiz'

  const materialSequencePlaceholder = materialSequenceFilter
    ? materialSequenceFilter
    : materialTypeFilter === 'assignment'
    ? 'Assignment Number'
    : materialTypeFilter === 'quiz'
    ? 'Quiz Number'
    : 'Select Number'

  const getMaterialTypeValue = (value: unknown) => {
    if (typeof value !== 'string') {
      return ''
    }
    return normalizeForStorage(value)
  }

  const getTimestampAsDate = useCallback((value: any): Date | null => {
    if (!value) {
      return null
    }

    if (typeof value.toDate === 'function') {
      try {
        const converted = value.toDate()
        return converted instanceof Date && !Number.isNaN(converted.getTime()) ? converted : null
      } catch {
        return null
      }
    }

    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value
    }

    if (typeof value === 'number') {
      const fromNumber = new Date(value)
      return Number.isNaN(fromNumber.getTime()) ? null : fromNumber
    }

    if (typeof value === 'string') {
      const fromString = new Date(value)
      return Number.isNaN(fromString.getTime()) ? null : fromString
    }

    return null
  }, [])

  const computeTrendingScore = useCallback(
    (note: any) => {
      const vibe = typeof note?.vibeScore === 'number' ? note.vibeScore : 0
      const referenceDate =
        getTimestampAsDate(note?.lastInteractionAt) ||
        getTimestampAsDate(note?.vibeUpdatedAt) ||
        getTimestampAsDate(note?.uploadedAt) ||
        new Date()
      const ageHours = Math.max((Date.now() - referenceDate.getTime()) / (1000 * 60 * 60), 0)
      const freshnessBoost = Math.max(0, 72 - ageHours) / 4 // up to +18 for brand new notes
      return vibe + freshnessBoost
    },
    [getTimestampAsDate]
  )

  const getVibeBadge = (score: number): { icon: JSX.Element | null; classes: string } => {
    if (score > 10) {
      return {
        icon: <Flame className="h-3 w-3" aria-hidden="true" />,
        classes: 'border-orange-200 bg-orange-50 text-orange-700',
      }
    }

    if (score < -10) {
      return {
        icon: <Skull className="h-3 w-3" aria-hidden="true" />,
        classes: 'border-slate-700 bg-slate-900 text-gray-100',
      }
    }

    return {
      icon: null,
      classes: 'border-slate-200 bg-slate-100 text-slate-600',
    }
  }

  const buildMaterialDisplay = (note: any) => {
    const typeValue = getMaterialTypeValue(note?.materialType)
    if (!typeValue) {
      return 'Not specified'
    }

    const sequenceValue = note?.materialSequence ?? ''
    if ((typeValue === 'assignment' || typeValue === 'quiz') && sequenceValue) {
      return `${formatMaterialType(typeValue)} ${sequenceValue}`
    }
    return formatMaterialType(typeValue)
  }

  const handleMaterialFilterToggle = (note: any) => {
    const typeValue = getMaterialTypeValue(note?.materialType)
    if (!typeValue) {
      return
    }

    const sequenceValue = (note?.materialSequence ?? '').toString()
    const requiresSequence = typeValue === 'assignment' || typeValue === 'quiz'
    const sequenceMatch = requiresSequence ? sequenceValue === materialSequenceFilter : materialSequenceFilter === ''
    const isActive = materialTypeFilter === typeValue && sequenceMatch

    if (isActive) {
      setMaterialTypeFilter('')
      setMaterialSequenceFilter('')
    } else {
      setMaterialTypeFilter(typeValue)
      setMaterialSequenceFilter(requiresSequence ? sequenceValue : '')
    }
  }

  const applyNotePatch = useCallback(
    (noteId: string, patch: Record<string, any>) => {
      setNotes((prevNotes) =>
        prevNotes.map((note) => (note.id === noteId ? { ...note, ...patch } : note))
      )
    },
    [setNotes]
  )

  const handleVoteScoreUpdate = useCallback(
    (noteId: string, payload: { upvotes: number; downvotes: number; vibeScore: number }) => {
      const now = new Date()
      applyNotePatch(noteId, {
        upvoteCount: payload.upvotes,
        downvoteCount: payload.downvotes,
        vibeScore: payload.vibeScore,
        lastInteractionAt: now,
        vibeUpdatedAt: now,
      })
    },
    [applyNotePatch]
  )

  // Helper function to check if any filters are applied
  const hasActiveFilters = () => {
    return (
      titleFilter.trim() !== '' ||
      semesterFilter ||
      subjectFilter ||
      teacherFilter ||
      nameFilter ||
      sectionFilter ||
      majorFilter ||
      materialTypeFilter ||
      materialSequenceFilter
    );
  };

  const displayedNotes = useMemo(() => {
    if (!Array.isArray(notes)) {
      return [];
    }

    const decorated = notes.map((note) => {
      const vibeScore = typeof note?.vibeScore === 'number' ? note.vibeScore : 0;
      const trendingScore = computeTrendingScore(note);
      const uploadedDate = getTimestampAsDate(note?.uploadedAt) || new Date(0);

      return {
        note,
        vibeScore,
        trendingScore,
        uploadedDate,
      };
    });

    decorated.sort((a, b) => {
      if (sortMode === 'trending') {
        if (b.trendingScore !== a.trendingScore) {
          return b.trendingScore - a.trendingScore;
        }
        return b.uploadedDate.getTime() - a.uploadedDate.getTime();
      }

      if (sortMode === 'top') {
        if (b.vibeScore !== a.vibeScore) {
          return b.vibeScore - a.vibeScore;
        }
        return b.uploadedDate.getTime() - a.uploadedDate.getTime();
      }

      return b.uploadedDate.getTime() - a.uploadedDate.getTime();
    });

    return decorated.map((entry) => entry.note);
  }, [notes, sortMode, computeTrendingScore, getTimestampAsDate]);

  // Get active filter count
  const getActiveFilterCount = () => {
    let count = 0;
    if (titleFilter.trim() !== '') count++;
    if (semesterFilter) count++;
    if (subjectFilter) count++;
    if (teacherFilter) count++;
    if (nameFilter) count++;
    if (sectionFilter) count++;
    if (majorFilter) count++;
    if (materialTypeFilter) count++;
    if (materialSequenceFilter) count++;
    return count;
  };

  // Fetch profile picture for a contributor
  const fetchProfilePicture = async (contributorName: string): Promise<string | null> => {
    if (!contributorName) {
      return null;
    }

    const cachedImage = profilePictures[contributorName] ?? null;

    try {
      const profile = await getUserProfileByName(contributorName);

      if (profile) {
        const auraInfo = getAuraTier(typeof profile.aura === 'number' ? profile.aura : 0)
        setProfileAura(prev => ({
          ...prev,
          [contributorName]: {
            aura: auraInfo.aura,
            tierName: auraInfo.tier.name,
            badgeClass: auraInfo.tier.badgeClass,
            borderClass: auraInfo.tier.borderClass,
          },
        }))

        const resolvedSlug = profile.profileSlug || slugify(profile.fullName || contributorName);
        if (resolvedSlug && profileSlugs[contributorName] !== resolvedSlug) {
          setProfileSlugs(prev => ({
            ...prev,
            [contributorName]: resolvedSlug
          }));
        }

        if (profile.profilePicture && profile.profilePicture !== cachedImage) {
          setProfilePictures(prev => ({
            ...prev,
            [contributorName]: profile.profilePicture ?? undefined
          }));
          return profile.profilePicture;
        }

      }
    } catch (error) {
      console.error(`Error fetching profile data for ${contributorName}:`, error);
    }

    if (!profileSlugs[contributorName]) {
      const fallbackSlug = slugify(contributorName);
      if (fallbackSlug) {
        setProfileSlugs(prev => ({
          ...prev,
          [contributorName]: fallbackSlug
        }));
      }
    }

    return cachedImage;
  };

  // Fetch profile pictures for all notes
  useEffect(() => {
    const fetchAllProfilePictures = async () => {
      const uniqueContributors = [...new Set(notes.map(note => note.contributorName).filter(Boolean))];

      for (const contributor of uniqueContributors) {
        if (!profilePictures[contributor]) {
          fetchProfilePicture(contributor);
        }
      }
    };

    if (notes.length > 0) {
      fetchAllProfilePictures();
    }
  }, [notes]);

  const resolvePreviewImage = (note: any) => {
    if (!note) {
      return "/placeholder.svg"
    }

    if (note.previewImageUrl) {
      return note.previewImageUrl
    }

    const url = typeof note.fileUrl === "string" ? note.fileUrl : ""

    // Handle Google Drive URLs
    if (url.includes("drive.google.com")) {
      const fileIdMatch = url.match(/\/d\/([^/]+)/) || url.match(/id=([^&]+)/)
      if (fileIdMatch?.[1]) {
        return `https://drive.google.com/thumbnail?id=${fileIdMatch[1]}&sz=w1200`
      }
    }

    // For Cloudflare R2 PDF URLs, we'll use the PDF thumbnail component
    // Return a placeholder that will be replaced by the PDF thumbnail
    if (isPDFUrl(url)) {
      return null // We'll handle this with PDFThumbnail component
    }

    return "/placeholder.svg"
  }

  // Mobile detection effect
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)

    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Initial load effect
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch initial notes (first 9)
        const initialNotesResult = await getInitialNotes();
        setNotes(initialNotesResult.notes);
        setLastDocSnapshot(initialNotesResult.lastDocSnapshot);
        setHasMore(initialNotesResult.hasMore);

        // Fetch filter options
        const filterOptionsResult = await getFilterOptions();
        setFilterOptions(filterOptionsResult);

        
        // Check admin status
        if (user && user.email === adminEmail) {
          setAdmin(true);
        }

      } catch (error: any) {
        console.error("Error fetching initial data:", error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, [user]);

  // Load more notes function (only for latest notes without filters)
  const loadMoreNotes = async () => {
    if (loadingMore || !hasMore) return;

    try {
      setLoadingMore(true);

      // Only paginate when no filters are applied
      const result = await getNotesWithPagination(9, lastDocSnapshot, {});

      setNotes(prevNotes => [...prevNotes, ...result.notes]);
      setLastDocSnapshot(result.lastDocSnapshot);
      setHasMore(result.hasMore);

    } catch (error: any) {
      console.error("Error loading more notes:", error);
      setError(error.message);
    } finally {
      setLoadingMore(false);
    }
  };

  // Apply filters function - gets ALL filtered results (no pagination)
  const applyFilters = async () => {
    try {
      setLoading(true);
      setError(null);

      // Check if any filters are applied
      const hasFilters =
        titleFilter.trim() !== '' ||
        semesterFilter ||
        subjectFilter ||
        teacherFilter ||
        nameFilter ||
        sectionFilter ||
        majorFilter ||
        materialTypeFilter ||
        materialSequenceFilter;

      if (hasFilters) {
        // Get ALL notes with filters applied (no pagination)
        const filters = {
          semester: semesterFilter,
          subject: subjectFilter,
          teacher: teacherFilter,
          contributorName: nameFilter,
          section: sectionFilter,
          contributorMajor: majorFilter,
          materialType: materialTypeFilter,
          materialSequence: materialSequenceFilter,
        };
        const result = await getAllNotesWithFilters(filters, titleFilter);

        setNotes(result.notes);
        setLastDocSnapshot(null);
        setHasMore(false); // No pagination for filtered results
      } else {
        // Reset to initial state - first 9 notes with pagination
        const result = await getInitialNotes();
        setNotes(result.notes);
        setLastDocSnapshot(result.lastDocSnapshot);
        setHasMore(result.hasMore);
      }

    } catch (error: any) {
      console.error("Error applying filters:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      applyFilters(); // Always apply filters (will handle both filtered and unfiltered states)
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [
    titleFilter,
    semesterFilter,
    subjectFilter,
    teacherFilter,
    nameFilter,
    sectionFilter,
    majorFilter,
    materialTypeFilter,
    materialSequenceFilter,
  ]);

  // Reset filters
  const resetFilters = async () => {
    setTitleFilter("");
    setSemesterFilter("");
    setSubjectFilter("");
    setNameFilter("");
    setTeacherFilter("");
    setSectionFilter("");
    setMajorFilter("");
    setMaterialTypeFilter("");
    setMaterialSequenceFilter("");
    setSortMode('trending');

    try {
      setLoading(true);
      // Reset to initial state - first 9 notes with pagination
      const result = await getInitialNotes();
      setNotes(result.notes);
      setLastDocSnapshot(result.lastDocSnapshot);
      setHasMore(result.hasMore);
    } catch (error: any) {
      console.error("Error resetting filters:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (materialSequenceFilter && !['assignment', 'quiz'].includes(materialTypeFilter)) {
      setMaterialSequenceFilter('');
    }
  }, [materialTypeFilter, materialSequenceFilter]);

  const handleDelete = (id: string, title: string, subject: string) => {
    setNoteToDelete({ id, title, subject })
    setIsDeleteModalOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!noteToDelete) {
      return
    }

    if (!auth.currentUser) {
      setError('You need to sign in to delete notes.')
      return
    }

    try {
      setIsDeleting(true)
      const token = await auth.currentUser.getIdToken()
      const response = await fetch(`/api/upload?noteId=${encodeURIComponent(noteToDelete.id)}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        const message = payload?.error || 'Failed to delete the note. Please try again.'
        throw new Error(message)
      }

      setNotes((prevNotes) => prevNotes.filter((note) => note.id !== noteToDelete.id))
      console.log(`Note with ID: ${noteToDelete.id} has been deleted successfully.`)

      setIsDeleteModalOpen(false)
      setNoteToDelete(null)
    } catch (error) {
      console.error("Error deleting note:", error)
      setError(error instanceof Error ? error.message : 'Failed to delete the note. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  useEffect(() => {
    const fetchSavedNotes = async () => {
      if (!auth.currentUser) {
        return;
      }

      try {
        setSavingNotes(true);
        const userId = auth.currentUser.uid;
        const savedNotesRef = collection(db, "users", userId, "savedNotes");
        const savedNotesSnapshot = await getDocs(savedNotesRef);

        const saved: Record<string, boolean> = {};
        savedNotesSnapshot.forEach((doc) => {
          saved[doc.id] = true;
        });

        setSavedNotes(saved);
      } catch (error) {
        console.error("Error fetching saved notes:", error);
      } finally {
        setSavingNotes(false);
      }
    };

    fetchSavedNotes();
  }, []);

  // Update handleSaveNote function
  const handleSaveNote = async (noteId: string) => {
    if (!auth.currentUser) {
      alert("Please log in to save notes!");
      return;
    }

    try {
      setSavingNotes(true);
      const result = await toggleSaveNote(noteId);

      setSavedNotes((prev) => {
        const updated = { ...prev };
        if (result.saved) {
          updated[noteId] = true;
        } else {
          delete updated[noteId];
        }
        return updated;
      });

      const now = new Date();
      applyNotePatch(noteId, {
        saveCount: result.saveCount,
        vibeScore: result.vibeScore,
        lastInteractionAt: now,
        vibeUpdatedAt: now,
      });
    } catch (error: any) {
      console.error("Error saving note:", error);
      const message = error?.message || "Error saving note. Please try again.";
      alert(message);
    } finally {
      setSavingNotes(false);
    }
  };

  const handleViewNote = (note: any) => {
    const noteUrl = typeof note.fileUrl === "string" ? note.fileUrl : ""

    if (!noteUrl) {
      alert("Invalid Note URL")
      return
    }

    const auraDetails = profileAura[note.contributorName ?? '']
    const teacherValue = note.teacher || note.module || ''
    const params = new URLSearchParams({
      url: noteUrl,
      id: note.id ?? '',
      subject: note.subject ?? '',
      teacher: teacherValue ?? '',
      contributor: note.contributorName ?? '',
    })

    if (auraDetails) {
      params.set('aura', String(auraDetails.aura))
    }

    const vibeForParam = typeof note.vibeScore === 'number' ? note.vibeScore : 0
    params.set('vibeScore', String(vibeForParam))

    if (note.storageProvider) {
      params.set('storageProvider', note.storageProvider)
    }

    if (note.storageKey) {
      params.set('storageKey', note.storageKey)
    }

    if (note.storageBucket) {
      params.set('storageBucket', note.storageBucket)
    }

    const url = `/note?${params.toString()}`

    if (typeof window !== 'undefined') {
      try {
        router.push(url)
        return
      } catch (error) {
        console.error('[Dashboard] Failed to navigate with router, falling back', error)
      }

      window.location.assign(url)
    }
  }

  
  const handleShare = (noteUrl: string, noteId: string, noteSubject: string, noteTeacher: string, noteContributorName: string) => {
    const encodedUrl = encodeURIComponent(noteUrl);
    const encodedSubject = encodeURIComponent(noteSubject);
    const encodedTeacher = encodeURIComponent(noteTeacher);
    const encodedContributor = encodeURIComponent(noteContributorName);

    const url = `https://uolink.vercel.app/note?url=${encodedUrl}&id=${noteId}&subject=${encodedSubject}&teacher=${encodedTeacher}&contributor=${encodedContributor}`;

    const message = `Check out the notes of *${noteSubject}* | *${noteTeacher}* by *${noteContributorName}* on *UOLINK* :- ${url}`;

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, "_blank");
  };

  return (
    <div className="container md:mt-16 mt-14 mx-auto px-4 pb-8 pt-4">

      <button
        className="fixed bottom-4 right-4 border border-black  text-black p-2 rounded-full shadow-lg hover:bg-green-50 transition-all duration-300"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      >
        <ArrowUp className="md:size-5 size-3" />
      </button>

      {donators.length > 0 && (
        <div className="flex justify-center items-center flex-col">
          <MorphingText texts={donators.map((contributor) => `${contributor.name}-${contributor.amount}`)} />
        </div>
      )}

      <Link href="/donate">
        <div className="flex flex-row justify-center animate-pulse duration-700 hover:animate-none items-center">
          <h1 className="text-sm hover:underline md:hover:border-x px-5 md:hover:border-[#90c639] font-bold text-center hover:text-[#90c639] transition-all duration-200 ">Database <span className="text-amber-600 hover:text-[#90c639]"> Cost
          </span> Rising. <span className="text-[#90c639]">Donate</span> to Keep Us Running!</h1>
        </div>
      </Link>

      <div className="flex justify-end mb-4">
        {/* Mobile Filter Toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="md:hidden flex items-center gap-2 px-3 py-2 rounded-full border border-amber-200 bg-amber-50 text-sm font-medium text-gray-700 transition hover:bg-amber-100"
        >
          <Filter className="w-4 h-4" />
          Filters
          {getActiveFilterCount() > 0 && (
            <span className="bg-[#90c639] text-white text-xs rounded-full px-2 py-0.5">
              {getActiveFilterCount()}
            </span>
          )}
          <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Search Bar - Always Visible */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            id="titleFilter"
            value={titleFilter}
            onChange={(e) => setTitleFilter(e.target.value)}
            placeholder="Search notes..."
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-amber-200 bg-white text-sm font-medium text-gray-900 shadow-sm transition focus:border-[#90c639] focus:outline-none focus:ring-2 focus:ring-[#90c639]/20"
          />
        </div>
      </div>

      {/* Collapsible Filter Panel */}
      <div className={`mb-6 transition-all duration-300 overflow-hidden ${showFilters ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0 md:max-h-full md:opacity-100'}`}>
        <div className="bg-white/90 rounded-2xl border border-amber-100 p-4 shadow-lg">
          {/* Mobile Filter Header */}
          <div className="flex items-center justify-between mb-4 md:hidden">
            <h3 className="text-sm font-semibold text-gray-900">Filters</h3>
            <button
              onClick={() => setShowFilters(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Filter Pills - Most Important First */}
          <div className="space-y-4">
            {/* Top Row - Most Used Filters */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-600 block mb-1">
                  Subject
                </label>
                <CustomSelect
                  options={["Select Subject", ...filterOptions.subjects.map((subject: string) => toTitleCase(subject))]}
                  placeholder="Subject"
                  value={subjectFilter ? toTitleCase(subjectFilter) : undefined}
                  onChange={(selectedOption) => {
                    if (selectedOption === "Select Subject") {
                      setSubjectFilter("");
                    } else {
                      setSubjectFilter(selectedOption.toLowerCase());
                    }
                  }}
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-600 block mb-1">
                  Teacher
                </label>
                <CustomSelect
                  options={["Select Teacher", ...filterOptions.teachers.map((teacher: string) => toTitleCase(teacher))]}
                  placeholder="Teacher"
                  value={teacherFilter ? toTitleCase(teacherFilter) : undefined}
                  onChange={(selectedOption) => {
                    if (selectedOption === "Select Teacher") {
                      setTeacherFilter("");
                    } else {
                      setTeacherFilter(selectedOption.toLowerCase());
                    }
                  }}
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-600 block mb-1">
                  Semester
                </label>
                <CustomSelect
                  options={["Select Semester", ...filterOptions.semesters]}
                  placeholder="Semester"
                  value={semesterFilter || undefined}
                  onChange={(selectedOption) => {
                    if (selectedOption === "Select Semester") {
                      setSemesterFilter("");
                    } else {
                      setSemesterFilter(selectedOption);
                    }
                  }}
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-600 block mb-1">
                  Section
                </label>
                <CustomSelect
                  options={sectionOptionsList}
                  placeholder="Section"
                  value={sectionFilter ? sectionFilter.toUpperCase() : undefined}
                  onChange={(selectedOption) => {
                    if (selectedOption === "Select Section") {
                      setSectionFilter("");
                    } else {
                      setSectionFilter(selectedOption.toUpperCase());
                    }
                  }}
                />
              </div>
            </div>

            {/* Second Row - Additional Filters */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-600 block mb-1">
                  Type
                </label>
                <CustomSelect
                  options={materialTypeOptionsList}
                  placeholder="Material Type"
                  value={materialTypeLabel || undefined}
                  onChange={(selectedOption) => {
                    if (selectedOption === "Select Material Type") {
                      setMaterialTypeFilter("");
                      setMaterialSequenceFilter("");
                    } else {
                      const mappedValue = materialTypeDisplayMap.get(selectedOption) || slugify(selectedOption);
                      setMaterialTypeFilter(mappedValue);
                    }
                  }}
                />
              </div>

              {isSequenceFilterEnabled && (
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-gray-600 block mb-1">
                    Number
                  </label>
                  <CustomSelect
                    options={materialSequenceOptionsList}
                    placeholder={materialSequencePlaceholder}
                    value={materialSequenceFilter || undefined}
                    onChange={(selectedOption) => {
                      const firstOption = materialSequenceOptionsList[0];
                      if (selectedOption === firstOption) {
                        setMaterialSequenceFilter("");
                      } else {
                        setMaterialSequenceFilter(selectedOption.trim());
                      }
                    }}
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-600 block mb-1">
                  Contributor
                </label>
                <input
                  type="text"
                  value={nameFilter}
                  onChange={(event) => setNameFilter(event.target.value)}
                  placeholder="Name"
                  className="w-full rounded-xl border border-amber-200 px-4 py-3 text-sm font-medium text-gray-900 shadow-sm transition focus:border-[#90c639] focus:outline-none focus:ring-2 focus:ring-[#90c639]/20"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-600 block mb-1">
                  Major
                </label>
                <CustomSelect
                  options={["Select Major", ...MAJOR_NAMES]}
                  placeholder="Major"
                  value={majorFilter || undefined}
                  onChange={(selectedOption) => {
                    if (selectedOption === "Select Major") {
                      setMajorFilter("");
                    } else {
                      setMajorFilter(selectedOption);
                    }
                  }}
                />
              </div>
            </div>

            {/* Reset Button */}
            {hasActiveFilters() && (
              <button
                type="button"
                onClick={resetFilters}
                className="w-full rounded-xl border border-amber-300 bg-amber-100/80 px-4 py-2 text-sm font-semibold text-gray-800 transition hover:border-amber-500 hover:bg-amber-100"
              >
                Reset all filters
              </button>
            )}
          </div>
        </div>
      </div>


      {error && <p className="text-red-500">Error fetching notes: {error}</p>}

      {notes.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-gray-700">Sort by</p>
          <div className="flex gap-2">
            {SORT_OPTIONS.map((option) => {
              const isActive = sortMode === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSortMode(option.value)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-[#90c639]/40 ${
                    isActive
                      ? 'border-[#90c639] bg-[#90c639] text-white shadow-sm'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-[#90c639] hover:text-[#90c639]'
                  }`}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Notes Grid */}
      {loading ? (
        <NotesLoader />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {displayedNotes.map((note) => {
            const noteSection = (note.section || '').toString().toUpperCase()
            const materialTypeValue = getMaterialTypeValue(note.materialType)
            const materialDisplay = buildMaterialDisplay(note)
            const sequenceValue = (note.materialSequence ?? '').toString()
            const isSemesterActive = semesterFilter === note.semester && !!note.semester
            const isSectionActive = sectionFilter === noteSection && !!noteSection
            const isMaterialActive =
              materialTypeFilter === materialTypeValue &&
              (!!materialTypeValue &&
                (!['assignment', 'quiz'].includes(materialTypeValue) || materialSequenceFilter === sequenceValue))
            const badgeBase =
              'rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-gray-700 transition hover:border-[#90c639] hover:bg-[#90c639]/10'
            const badgeActive = 'border-[#90c639] bg-[#90c639]/15 text-[#1f3f1f] shadow-sm'
            const vibeScoreRaw = typeof note.vibeScore === 'number' ? note.vibeScore : 0
            const vibeScoreValue = Math.round(vibeScoreRaw)
            const vibeBadge = getVibeBadge(vibeScoreValue)
            const vibeDisplayValue = vibeScoreValue > 0 ? `+${vibeScoreValue}` : `${vibeScoreValue}`
            const saveCount = Math.max(0, Number(note.saveCount ?? 0))
            const auraDetails = profileAura[note.contributorName ?? '']
            const auraBorderClass =
              auraDetails?.borderClass ?? 'ring-1 ring-slate-200 ring-offset-2 ring-offset-white'
            const auraScoreLabel = auraDetails ? formatAura(auraDetails.aura) : null

            return (
              <div
                key={note.id}
                className="rounded-2xl border border-gray-200 bg-white shadow-xl transition hover:shadow-2xl overflow-hidden"
              >
                {/* Mobile Layout - Stacked Vertical */}
                <div className="sm:hidden">
                  {/* Header with Title and Vibe Score */}
                  <div className="p-4 pb-3 border-b border-gray-100">
                    <div className="flex items-start justify-between mb-3">
                      <h1
                        onClick={() => {
                          if (subjectFilter == note.subject) {
                            setSubjectFilter("")
                          } else {
                            setSubjectFilter(note.subject)
                          }
                        }}
                        className="flex-1 text-lg font-bold cursor-pointer transition-colors duration-300 hover:text-[#90c639] pr-2"
                      >
                        {toTitleCase(note.subject) || "unknown"}
                      </h1>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold flex-shrink-0 ${vibeBadge.classes}`}
                        title="Vibe Score"
                      >
                        {vibeBadge.icon && <span>{vibeBadge.icon}</span>}
                        <span>{vibeDisplayValue}</span>
                      </span>
                    </div>

                    {/* Teacher Info */}
                    <p className="text-sm text-gray-600 mb-2">
                      Teacher:{" "}
                      <span
                        onClick={() => {
                          const teacherValue = note.teacher || ''
                          if (!teacherValue) {
                            return
                          }
                          if (teacherFilter === teacherValue) {
                            setTeacherFilter("")
                          } else {
                            setTeacherFilter(teacherValue)
                          }
                        }}
                        className="cursor-pointer text-gray-800 transition-colors duration-300 hover:text-green-500"
                      >
                        {toTitleCase(note.teacher || '') || "Unknown"}
                      </span>
                    </p>

                    {/* Badges */}
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (!note.semester) {
                            return
                          }
                          if (semesterFilter === note.semester) {
                            setSemesterFilter("")
                          } else {
                            setSemesterFilter(note.semester)
                          }
                        }}
                        className={`${badgeBase} ${isSemesterActive ? badgeActive : ''} text-xs px-2 py-1`}
                      >
                        Sem {note.semester || 'N/A'}
                      </button>

                      {noteSection ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (sectionFilter === noteSection) {
                              setSectionFilter("")
                            } else {
                              setSectionFilter(noteSection)
                            }
                          }}
                          className={`${badgeBase} ${isSectionActive ? badgeActive : ''} text-xs px-2 py-1`}
                        >
                          Sec {noteSection}
                        </button>
                      ) : (
                        <span className="rounded-full border border-dashed border-gray-300 bg-gray-50 px-2 py-1 text-xs font-semibold text-gray-400">
                          Sec TBD
                        </span>
                      )}

                      {materialTypeValue ? (
                        <button
                          type="button"
                          onClick={() => handleMaterialFilterToggle(note)}
                          className={`${badgeBase} ${isMaterialActive ? badgeActive : ''} text-xs px-2 py-1`}
                        >
                          {materialDisplay}
                        </button>
                      ) : (
                        <span className="rounded-full border border-dashed border-gray-300 bg-gray-50 px-2 py-1 text-xs font-semibold text-gray-400">
                          Type TBD
                        </span>
                      )}
                    </div>

                    {/* Details */}
                    <p className="text-xs text-gray-500 line-clamp-2">{note.name}</p>
                  </div>

                  {/* Preview Image */}
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                    {isPDFUrl(note.fileUrl) ? (
                      <PDFThumbnail
                        url={note.fileUrl}
                        width={280}
                        height={140}
                        className="w-full rounded-lg border border-gray-300 cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => handleViewNote(note)}
                      />
                    ) : (
                      <img
                        onClick={() => handleViewNote(note)}
                        src={resolvePreviewImage(note) || "/placeholder.svg"}
                        alt="PDF Preview"
                        className="w-full h-32 object-cover rounded-lg border border-gray-300 cursor-pointer hover:opacity-90 transition-opacity"
                      />
                    )}
                  </div>

                  {/* Contributor Info */}
                  <div className="px-4 py-3 bg-white border-b border-gray-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className={`relative inline-flex items-center justify-center rounded-full p-[2px] ${auraBorderClass} flex-shrink-0`}>
                          {profilePictures[note.contributorName] ? (
                            <img
                              src={profilePictures[note.contributorName]}
                              alt={`${note.contributorName}'s profile`}
                              className="h-6 w-6 rounded-full object-cover"
                            />
                          ) : (
                            <div className="flex h-6 w-6 items-center justify-center rounded-full border border-gray-300 bg-gray-200">
                              <User className="h-3 w-3 text-gray-500" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <Link
                            href={`/profile/${encodeURIComponent(profileSlugs[note.contributorName] || note.contributorName)}`}
                            className="cursor-pointer font-semibold text-[#90c639] hover:text-[#7ab332] hover:underline text-sm truncate block"
                          >
                            {note.contributorName || "unknown"}
                          </Link>
                          {auraDetails && (
                            <span
                              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${auraDetails.badgeClass} mt-0.5`}
                              title={auraScoreLabel ? `Aura ${auraScoreLabel}` : 'Aura tier'}
                            >
                              {auraDetails.tierName}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 ml-2 flex-shrink-0">
                        {note.uploadedAt?.toDate?.()?.toLocaleDateString("en-GB", { month: 'short', day: 'numeric' }) || new Date().toLocaleDateString("en-GB", { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="p-3 bg-gray-50">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => handleViewNote(note)}
                        className="flex-1 bg-black text-white px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300 hover:rounded-xl active:scale-95"
                      >
                        View Note
                      </button>

                      <div className="flex items-center gap-1">
                        <VoteButton
                          noteId={note.id}
                          initialUpvotes={note.upvoteCount ?? 0}
                          initialDownvotes={note.downvoteCount ?? 0}
                          size="sm"
                          className="scale-90"
                          onScoreUpdate={(payload) => handleVoteScoreUpdate(note.id, payload)}
                        />

                        <div className="relative">
                          <Bookmark
                            size={18}
                            style={{
                              cursor: "pointer",
                              color: savedNotes[note.id] ? "#90c639" : "black",
                            }}
                            onClick={() => handleSaveNote(note.id)}
                            className={
                              savedNotes[note.id]
                                ? "fill-[#90c639] transition-all"
                                : "hover:fill-[#90c639] hover:scale-110 transition-all"
                            }
                          />
                          {saveCount > 0 && (
                            <span className="absolute -top-1 -right-1 rounded-full bg-emerald-500 px-1 text-[9px] font-semibold text-white shadow-sm">
                              {saveCount > 99 ? '99+' : saveCount}
                            </span>
                          )}
                        </div>

                        <ReportButton noteId={note.id} size="sm" className="scale-90" />

                        {(admin || (user && user.email === note.metadata?.createdBy)) && (
                          <div className="flex items-center justify-center rounded-lg bg-slate-50 p-1 transition-all duration-300 hover:bg-red-200">
                            <button type="button" onClick={() => handleDelete(note.id, note.name, note.subject)}>
                              <Trash size={16} color="red" className="transition-all duration-300 hover:scale-110" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tablet Layout - Compromise between mobile and desktop */}
                <div className="hidden sm:block lg:hidden">
                  <div className="p-5">
                    <div className="flex gap-4">
                      {/* Content Section */}
                      <div className="flex-1">
                        {/* Header */}
                        <div className="mb-3">
                          <div className="flex items-start justify-between mb-2">
                            <h1
                              onClick={() => {
                                if (subjectFilter == note.subject) {
                                  setSubjectFilter("")
                                } else {
                                  setSubjectFilter(note.subject)
                                }
                              }}
                              className="text-lg font-bold cursor-pointer transition-colors duration-300 hover:text-[#90c639] pr-2"
                            >
                              {toTitleCase(note.subject) || "unknown"}
                            </h1>
                            <span
                              className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold flex-shrink-0 ${vibeBadge.classes}`}
                              title="Vibe Score"
                            >
                              {vibeBadge.icon && <span>{vibeBadge.icon}</span>}
                              <span>{vibeDisplayValue}</span>
                            </span>
                          </div>

                          <p className="text-sm text-gray-600 mb-2">
                            Teacher:{" "}
                            <span
                              onClick={() => {
                                const teacherValue = note.teacher || ''
                                if (!teacherValue) {
                                  return
                                }
                                if (teacherFilter === teacherValue) {
                                  setTeacherFilter("")
                                } else {
                                  setTeacherFilter(teacherValue)
                                }
                              }}
                              className="cursor-pointer text-gray-800 transition-colors duration-300 hover:text-green-500"
                            >
                              {toTitleCase(note.teacher || '') || "Unknown"}
                            </span>
                          </p>
                        </div>

                        {/* Badges */}
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          <button
                            type="button"
                            onClick={() => {
                              if (!note.semester) {
                                return
                              }
                              if (semesterFilter === note.semester) {
                                setSemesterFilter("")
                              } else {
                                setSemesterFilter(note.semester)
                              }
                            }}
                            className={`${badgeBase} ${isSemesterActive ? badgeActive : ''} text-xs px-2 py-1`}
                          >
                            Sem {note.semester || 'N/A'}
                          </button>

                          {noteSection ? (
                            <button
                              type="button"
                              onClick={() => {
                                if (sectionFilter === noteSection) {
                                  setSectionFilter("")
                                } else {
                                  setSectionFilter(noteSection)
                                }
                              }}
                              className={`${badgeBase} ${isSectionActive ? badgeActive : ''} text-xs px-2 py-1`}
                            >
                              Sec {noteSection}
                            </button>
                          ) : (
                            <span className="rounded-full border border-dashed border-gray-300 bg-gray-50 px-2 py-1 text-xs font-semibold text-gray-400">
                              Sec TBD
                            </span>
                          )}

                          {materialTypeValue ? (
                            <button
                              type="button"
                              onClick={() => handleMaterialFilterToggle(note)}
                              className={`${badgeBase} ${isMaterialActive ? badgeActive : ''} text-xs px-2 py-1`}
                            >
                              {materialDisplay}
                            </button>
                          ) : (
                            <span className="rounded-full border border-dashed border-gray-300 bg-gray-50 px-2 py-1 text-xs font-semibold text-gray-400">
                              Type TBD
                            </span>
                          )}
                        </div>

                        {/* Details */}
                        <p className="text-xs text-gray-500 mb-3 line-clamp-2">{note.name}</p>

                        {/* Contributor Info */}
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className={`relative inline-flex items-center justify-center rounded-full p-[2px] ${auraBorderClass} flex-shrink-0`}>
                              {profilePictures[note.contributorName] ? (
                                <img
                                  src={profilePictures[note.contributorName]}
                                  alt={`${note.contributorName}'s profile`}
                                  className="h-6 w-6 rounded-full object-cover"
                                />
                              ) : (
                                <div className="flex h-6 w-6 items-center justify-center rounded-full border border-gray-300 bg-gray-200">
                                  <User className="h-3 w-3 text-gray-500" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <Link
                                href={`/profile/${encodeURIComponent(profileSlugs[note.contributorName] || note.contributorName)}`}
                                className="cursor-pointer font-semibold text-[#90c639] hover:text-[#7ab332] hover:underline text-sm truncate block"
                              >
                                {note.contributorName || "unknown"}
                              </Link>
                              {auraDetails && (
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${auraDetails.badgeClass} mt-0.5`}
                                  title={auraScoreLabel ? `Aura ${auraScoreLabel}` : 'Aura tier'}
                                >
                                  {auraDetails.tierName}
                                </span>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-gray-400 ml-2 flex-shrink-0">
                            {note.uploadedAt?.toDate?.()?.toLocaleDateString("en-GB", { month: 'short', day: 'numeric' }) || new Date().toLocaleDateString("en-GB", { month: 'short', day: 'numeric' })}
                          </p>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => handleViewNote(note)}
                            className="flex-1 bg-black text-white px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300 hover:rounded-xl active:scale-95"
                          >
                            View Note
                          </button>

                          <div className="flex items-center gap-1">
                            <VoteButton
                              noteId={note.id}
                              initialUpvotes={note.upvoteCount ?? 0}
                              initialDownvotes={note.downvoteCount ?? 0}
                              size="sm"
                              className="scale-90"
                              onScoreUpdate={(payload) => handleVoteScoreUpdate(note.id, payload)}
                            />

                            <div className="relative">
                              <Bookmark
                                size={18}
                                style={{
                                  cursor: "pointer",
                                  color: savedNotes[note.id] ? "#90c639" : "black",
                                }}
                                onClick={() => handleSaveNote(note.id)}
                                className={
                                  savedNotes[note.id]
                                    ? "fill-[#90c639] transition-all"
                                    : "hover:fill-[#90c639] hover:scale-110 transition-all"
                                }
                              />
                              {saveCount > 0 && (
                                <span className="absolute -top-1 -right-1 rounded-full bg-emerald-500 px-1 text-[9px] font-semibold text-white shadow-sm">
                                  {saveCount > 99 ? '99+' : saveCount}
                                </span>
                              )}
                            </div>

                            <ReportButton noteId={note.id} size="sm" className="scale-90" />

                            {(admin || (user && user.email === note.metadata?.createdBy)) && (
                              <div className="flex items-center justify-center rounded-lg bg-slate-50 p-1 transition-all duration-300 hover:bg-red-200">
                                <button type="button" onClick={() => handleDelete(note.id, note.name, note.subject)}>
                                  <Trash size={16} color="red" className="transition-all duration-300 hover:scale-110" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Preview Image Section */}
                      <div className="flex-shrink-0">
                        {isPDFUrl(note.fileUrl) ? (
                          <PDFThumbnail
                            url={note.fileUrl}
                            width={200}
                            height={160}
                            className="rounded-lg border border-gray-300 cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => handleViewNote(note)}
                          />
                        ) : (
                          <img
                            onClick={() => handleViewNote(note)}
                            src={resolvePreviewImage(note) || "/placeholder.svg"}
                            alt="PDF Preview"
                            className="w-40 h-32 object-cover rounded-lg border border-gray-300 cursor-pointer hover:opacity-90 transition-opacity"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Desktop Layout - Original Side by Side */}
                <div className="hidden lg:block p-6">
                  <div className="flex flex-row justify-between">
                    <div className="flex flex-col justify-between flex-1">
                      <div>
                        <h1 className="mb-3 flex items-center gap-2 font-bold text-xl">
                          <span
                            onClick={() => {
                              if (subjectFilter == note.subject) {
                                setSubjectFilter("")
                              } else {
                                setSubjectFilter(note.subject)
                              }
                            }}
                            className="relative cursor-pointer transition-colors duration-300 hover:text-[#90c639]"
                          >
                            {toTitleCase(note.subject) || "unknown"}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold ${vibeBadge.classes}`}
                            title="Vibe Score"
                          >
                            {vibeBadge.icon && <span>{vibeBadge.icon}</span>}
                            <span>{vibeDisplayValue}</span>
                          </span>
                        </h1>

                        <p className="mb-3 text-gray-600">
                          Teacher:
                          <span
                            onClick={() => {
                              const teacherValue = note.teacher || ''
                              if (!teacherValue) {
                                return
                              }
                              if (teacherFilter === teacherValue) {
                                setTeacherFilter("")
                              } else {
                                setTeacherFilter(teacherValue)
                              }
                            }}
                            className="relative ml-1 cursor-pointer text-gray-600 transition-colors duration-300 hover:text-green-500"
                          >
                            {toTitleCase(note.teacher || '') || "Unknown"}
                          </span>
                        </p>

                        <div className="mb-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (!note.semester) {
                                return
                              }
                              if (semesterFilter === note.semester) {
                                setSemesterFilter("")
                              } else {
                                setSemesterFilter(note.semester)
                              }
                            }}
                            className={`${badgeBase} ${isSemesterActive ? badgeActive : ''}`}
                          >
                            Semester {note.semester || 'N/A'}
                          </button>

                          {noteSection ? (
                            <button
                              type="button"
                              onClick={() => {
                                if (sectionFilter === noteSection) {
                                  setSectionFilter("")
                                } else {
                                  setSectionFilter(noteSection)
                                }
                              }}
                              className={`${badgeBase} ${isSectionActive ? badgeActive : ''}`}
                            >
                              Section {noteSection}
                            </button>
                          ) : (
                            <span className="rounded-full border border-dashed border-gray-300 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-400">
                              Section TBD
                            </span>
                          )}

                          {materialTypeValue ? (
                            <button
                              type="button"
                              onClick={() => handleMaterialFilterToggle(note)}
                              className={`${badgeBase} ${isMaterialActive ? badgeActive : ''}`}
                            >
                              {materialDisplay}
                            </button>
                          ) : (
                            <span className="rounded-full border border-dashed border-gray-300 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-400">
                              Material tagged soon
                            </span>
                          )}
                        </div>

                        <p className="mb-3 text-sm text-gray-600">Details: {note.name}</p>
                      </div>

                      <div className="mb-5 flex items-center gap-2">
                        <span className="text-sm text-gray-600">By:</span>
                        <div className="flex items-center gap-2">
                          <div className={`relative inline-flex items-center justify-center rounded-full p-[2px] ${auraBorderClass}`}>
                            {profilePictures[note.contributorName] ? (
                              <img
                                src={profilePictures[note.contributorName]}
                                alt={`${note.contributorName}'s profile`}
                                className="h-6 w-6 rounded-full object-cover"
                              />
                            ) : (
                              <div className="flex h-6 w-6 items-center justify-center rounded-full border border-gray-300 bg-gray-200">
                                <User className="h-3 w-3 text-gray-500" />
                              </div>
                            )}
                          </div>

                          <Link
                            href={`/profile/${encodeURIComponent(profileSlugs[note.contributorName] || note.contributorName)}`}
                            className="cursor-pointer font-semibold text-[#90c639] transition-colors duration-300 hover:text-[#7ab332] hover:underline"
                          >
                            {note.contributorName || "unknown"}
                          </Link>
                          {auraDetails && (
                            <span
                              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${auraDetails.badgeClass}`}
                              title={auraScoreLabel ? `Aura ${auraScoreLabel}` : 'Aura tier'}
                            >
                              {auraDetails.tierName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-center justify-between ml-6">
                      {isPDFUrl(note.fileUrl) ? (
                        <PDFThumbnail
                          url={note.fileUrl}
                          width={160}
                          height={192}
                          className="border-2 border-gray-300"
                          onClick={() => handleViewNote(note)}
                        />
                      ) : (
                        <img
                          onClick={() => handleViewNote(note)}
                          src={resolvePreviewImage(note) || "/placeholder.svg"}
                          alt="PDF Preview"
                          className="h-48 w-40 cursor-pointer rounded-lg border-2 border-gray-300 object-cover transition-all duration-300 hover:brightness-90"
                        />
                      )}
                    </div>
                  </div>

                  <div className="mt-5 flex w-full flex-row items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleViewNote(note)}
                      className="rounded-lg bg-black px-3 py-2 text-sm text-white transition-all duration-300 hover:rounded-2xl"
                    >
                      View Note
                    </button>

                    <div className="flex flex-row items-center gap-2">
                      <VoteButton
                        noteId={note.id}
                        initialUpvotes={note.upvoteCount ?? 0}
                        initialDownvotes={note.downvoteCount ?? 0}
                        size="sm"
                        onScoreUpdate={(payload) => handleVoteScoreUpdate(note.id, payload)}
                      />

                      <div className="relative flex items-center justify-center rounded-lg bg-gray-50 p-1 transition-all hover:bg-green-100">
                        <Bookmark
                          size={20}
                          style={{
                            cursor: "pointer",
                            color: savedNotes[note.id] ? "#90c639" : "black",
                          }}
                          onClick={() => handleSaveNote(note.id)}
                          className={
                            savedNotes[note.id]
                              ? "fill-[#90c639] transition-all"
                              : "hover:fill-[#90c639] hover:scale-125 transition-all"
                          }
                        />
                        {saveCount > 0 && (
                          <span className="absolute -top-1 -right-1 rounded-full bg-emerald-500 px-1.5 text-[10px] font-semibold text-white shadow-sm">
                            {saveCount > 99 ? '99+' : saveCount}
                          </span>
                        )}
                      </div>

                      <ReportButton noteId={note.id} size="sm" />

                      {(admin || (user && user.email === note.metadata?.createdBy)) && (
                        <div className="flex items-center justify-center rounded-lg bg-slate-50 p-1 transition-all duration-300 hover:bg-red-200">
                          <button type="button" onClick={() => handleDelete(note.id, note.name, note.subject)}>
                            <Trash size={20} color="red" className="transition-all duration-300 hover:scale-110" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div>
                      <p className="text-xs text-gray-400">
                        {note.uploadedAt?.toDate?.()?.toLocaleDateString("en-GB") || new Date().toLocaleDateString("en-GB")}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}

          {/* No results message */}
          {notes.length === 0 && !loading && (
            <div className="col-span-full text-center text-gray-500 py-8">
              No notes found! Reset filters or try different search terms.
            </div>
          )}

          {/* Load More Button - only show when no filters are applied */}
          {hasMore && notes.length > 0 && !hasActiveFilters() && (
            <div className="col-span-full flex justify-center py-8">
              <button
                onClick={loadMoreNotes}
                disabled={loadingMore}
                className="px-6 py-3 rounded-lg font-medium
               bg-amber-300 text-black
               hover:bg-amber-400
               disabled:bg-zinc-300 disabled:text-zinc-600
               shadow-sm hover:shadow-md
               transition-all duration-300 ease-in-out"
              >
                {loadingMore ? 'Loading More...' : 'Load More Notes'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Loading More Skeleton */}
      {loadingMore && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          {[1, 2, 3].map((card) => (
            <div
              key={card}
              className="z-70 w-full bg-zinc-50 rounded-lg shadow-lg p-4 flex flex-row space-x-6 overflow-hidden"
            >
              <div className="flex flex-col justify-center flex-grow">
                <Skeleton height={30} width={200} className="mb-4" />
                <Skeleton height={20} width={140} className="mb-4" />
                <Skeleton height={20} width={180} className="mb-4" />
                <Skeleton height={20} width={160} className="mb-4" />
                <div className="flex flex-row gap-2">
                  <Skeleton height={40} width={100} className="mt-4" />
                  <Skeleton height={40} width={40} className="mt-4" />
                </div>
              </div>
              <div className="flex-shrink-0">
                <Skeleton height={200} width={150} className="rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      )}

      {savingNotes && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 transition-all z-50">
          <h1 className="loader3 "></h1>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false)
          setNoteToDelete(null)
        }}
        onConfirm={handleConfirmDelete}
        noteTitle={noteToDelete?.title || ''}
        noteSubject={noteToDelete?.subject || ''}
        isDeleting={isDeleting}
      />

      <div className="text-center opacity-90 pt-14 flex flex-col">
        <div className="hover:-rotate-3 transition-all duration-300">
          <span className="text-[#90c639] font-bold">
            <span className="text-black">~ by</span> Aazib
          </span>
        </div>
      </div>
    </div>
  )
}

export default Dashboard

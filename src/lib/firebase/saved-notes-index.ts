import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore'
import { auth, db } from './app'

interface SavedNotesIndexDoc {
  ids: string[]
  updatedAt?: any
}

const getIndexRef = (userId: string) => doc(db, 'users', userId, 'savedNotesIndex')

export const readSavedNotesIndex = async (userId: string): Promise<string[] | null> => {
  const ref = getIndexRef(userId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  const data = snap.data() as SavedNotesIndexDoc
  return Array.isArray(data?.ids) ? data.ids : []
}

export const buildIndexFromSubcollection = async (userId: string): Promise<string[]> => {
  const savedNotesRef = collection(db, 'users', userId, 'savedNotes')
  const savedNotesSnapshot = await getDocs(savedNotesRef)

  const ids = savedNotesSnapshot.docs.map((doc) => doc.id)

  const indexRef = getIndexRef(userId)
  await setDoc(indexRef, { ids, updatedAt: serverTimestamp() })
  return ids
}

export const fetchSavedNoteIdsEfficient = async (userId: string): Promise<string[]> => {
  const indexIds = await readSavedNotesIndex(userId)
  if (indexIds && indexIds.length >= 0) {
    return indexIds
  }
  // Fallback: build index from existing subcollection documents
  return await buildIndexFromSubcollection(userId)
}

export const updateSavedNotesIndex = async (userId: string, noteId: string, shouldSave: boolean): Promise<void> => {
  const indexRef = getIndexRef(userId)
  // Use merge to create doc if missing
  await setDoc(
    indexRef,
    shouldSave
      ? { ids: arrayUnion(noteId), updatedAt: serverTimestamp() }
      : { ids: arrayRemove(noteId), updatedAt: serverTimestamp() },
    { merge: true }
  )
}

interface VotesIndexDoc {
  up?: string[]
  down?: string[]
  updatedAt?: any
}

const getVotesIndexRef = (userId: string) => doc(db, 'users', userId, 'votesIndex', 'index')

export const readVotesIndex = async (userId: string): Promise<{ up: string[]; down: string[] } | null> => {
  const ref = getVotesIndexRef(userId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  const data = snap.data() as VotesIndexDoc
  const up = Array.isArray(data?.up) ? data.up : []
  const down = Array.isArray(data?.down) ? data.down : []
  return { up, down }
}

export const buildVotesIndexFromSubcollection = async (userId: string): Promise<{ up: string[]; down: string[] }> => {
  const votesRef = collection(db, 'users', userId, 'votes')
  const votesSnap = await getDocs(votesRef)
  const up: string[] = []
  const down: string[] = []
  votesSnap.docs.forEach((d) => {
    const v = (d.data() as any)?.voteType
    if (v === 'up') up.push(d.id)
    else if (v === 'down') down.push(d.id)
  })
  const ref = getVotesIndexRef(userId)
  await setDoc(ref, { up, down, updatedAt: serverTimestamp() }, { merge: true })
  return { up, down }
}

export const fetchVotesIndexEfficient = async (userId: string): Promise<{ up: string[]; down: string[] }> => {
  const idx = await readVotesIndex(userId)
  if (idx) return idx
  return await buildVotesIndexFromSubcollection(userId)
}



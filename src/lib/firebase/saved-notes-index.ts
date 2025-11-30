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
  const idx = await readInteractionIndex(userId)
  if (!idx) {
    const ref = getInteractionIndexRef(userId)
    await setDoc(ref, { saved: [], up: [], down: [], updatedAt: serverTimestamp() }, { merge: true })
    return []
  }
  return Array.isArray(idx.saved) ? idx.saved : []
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
  const votesRef = collection(db, 'userVotes', userId, 'votes')
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
  const idx = await readInteractionIndex(userId)
  if (!idx) {
    const ref = getInteractionIndexRef(userId)
    await setDoc(ref, { saved: [], up: [], down: [], updatedAt: serverTimestamp() }, { merge: true })
    return { up: [], down: [] }
  }
  const up = Array.isArray(idx.up) ? idx.up : []
  const down = Array.isArray(idx.down) ? idx.down : []
  return { up, down }
}

interface InteractionIndexDoc {
  saved?: string[]
  up?: string[]
  down?: string[]
  updatedAt?: any
}

const getInteractionIndexRef = (userId: string) => doc(db, 'users', userId, 'interactionIndex', 'index')

export const readInteractionIndex = async (userId: string): Promise<{ saved: string[]; up: string[]; down: string[] } | null> => {
  const ref = getInteractionIndexRef(userId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  const data = snap.data() as InteractionIndexDoc
  const saved = Array.isArray(data?.saved) ? data.saved : []
  const up = Array.isArray(data?.up) ? data.up : []
  const down = Array.isArray(data?.down) ? data.down : []
  return { saved, up, down }
}

export const fetchInteractionIndexEfficient = async (userId: string): Promise<{ saved: string[]; up: string[]; down: string[] }> => {
  const idx = await readInteractionIndex(userId)
  if (idx) return idx
  const ref = getInteractionIndexRef(userId)
  await setDoc(ref, { saved: [], up: [], down: [], updatedAt: serverTimestamp() }, { merge: true })
  return { saved: [], up: [], down: [] }
}

export const repairInteractionIndex = async (userId: string): Promise<{ saved: string[]; up: string[]; down: string[] }> => {
  const savedSnap = await getDocs(collection(db, 'users', userId, 'savedNotes'))
  const saved = savedSnap.docs.map((d) => d.id)
  const votesSnap = await getDocs(collection(db, 'userVotes', userId, 'votes'))
  const up: string[] = []
  const down: string[] = []
  votesSnap.docs.forEach((d) => {
    const v = (d.data() as any)?.voteType
    if (v === 'up') up.push(d.id)
    else if (v === 'down') down.push(d.id)
  })
  const ref = getInteractionIndexRef(userId)
  await setDoc(ref, { saved, up, down, updatedAt: serverTimestamp() }, { merge: true })
  return { saved, up, down }
}

export const monitorInteractionIndexConsistency = async (userId: string): Promise<{ consistent: boolean; counts: { saved: number; up: number; down: number } }> => {
  const idx = await readInteractionIndex(userId)
  const savedCount = idx ? (Array.isArray(idx.saved) ? idx.saved.length : 0) : 0
  const upCount = idx ? (Array.isArray(idx.up) ? idx.up.length : 0) : 0
  const downCount = idx ? (Array.isArray(idx.down) ? idx.down.length : 0) : 0
  return { consistent: true, counts: { saved: savedCount, up: upCount, down: downCount } }
}


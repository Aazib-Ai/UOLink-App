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


import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
  orderBy,
  limit,
  startAfter,
  QueryDocumentSnapshot,
  DocumentData,
} from 'firebase/firestore'
import { db } from '../firebase/app'

export interface ProfileStatsResult {
  userId: string
  totalNotes: number
  totalUpvotes: number
  totalDownvotes: number
  totalSaves: number
  totalReports: number
  averageCredibility: number
}

export async function calculateStatsForUser(userId: string, pageSize = 200): Promise<ProfileStatsResult> {
  const notesCol = collection(db, 'notes')
  let q = query(notesCol, where('uploadedBy', '==', userId), orderBy('__name__'), limit(pageSize))
  let lastDoc: QueryDocumentSnapshot<DocumentData> | null = null

  let totalNotes = 0
  let totalUpvotes = 0
  let totalDownvotes = 0
  let totalSaves = 0
  let totalReports = 0
  let credibilitySum = 0

  while (true) {
    const snap = await getDocs(q)
    if (snap.empty) break
    for (const d of snap.docs) {
      const data = d.data() as any
      totalNotes += 1
      totalUpvotes += Number(data.upvoteCount || 0)
      totalDownvotes += Number(data.downvoteCount || 0)
      totalSaves += Number(data.saveCount || 0)
      totalReports += Number(data.reportCount || 0)
      credibilitySum += Number(data.credibilityScore || 0)
    }
    lastDoc = snap.docs[snap.docs.length - 1]
    q = query(notesCol, where('uploadedBy', '==', userId), orderBy('__name__'), startAfter(lastDoc), limit(pageSize))
  }

  const averageCredibility = totalNotes > 0 ? credibilitySum / totalNotes : 0

  return {
    userId,
    totalNotes,
    totalUpvotes,
    totalDownvotes,
    totalSaves,
    totalReports,
    averageCredibility,
  }
}

export async function migrateProfileStats(batchSize = 50): Promise<{ processed: number; updated: number }> {
  const profilesCol = collection(db, 'profiles')
  let lastDoc: QueryDocumentSnapshot<DocumentData> | null = null
  let processed = 0
  let updated = 0

  while (true) {
    let pq = query(profilesCol, orderBy('__name__'), limit(batchSize))
    if (lastDoc) {
      pq = query(profilesCol, orderBy('__name__'), startAfter(lastDoc), limit(batchSize))
    }
    const snap = await getDocs(pq)
    if (snap.empty) break

    const batch = writeBatch(db)
    for (const prof of snap.docs) {
      const uid = prof.id
      const stats = await calculateStatsForUser(uid)
      const ref = doc(db, 'profiles', uid)
      batch.set(ref, {
        totalNotes: stats.totalNotes,
        totalUpvotes: stats.totalUpvotes,
        totalDownvotes: stats.totalDownvotes,
        totalSaves: stats.totalSaves,
        totalReports: stats.totalReports,
        averageCredibility: stats.averageCredibility,
        lastStatsUpdate: new Date(),
      }, { merge: true })
      updated += 1
    }

    await batch.commit()
    processed += snap.size
    lastDoc = snap.docs[snap.docs.length - 1]
    if (snap.size < batchSize) break
  }

  return { processed, updated }
}


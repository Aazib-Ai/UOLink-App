import { getAdminDb } from '@/lib/firebaseAdmin'
import { enforceNoteSchemaOnWrite } from '@/lib/data/note-schema'

async function run() {
  const db = getAdminDb()
  const notesRef = db.collection('notes')
  const snap = await notesRef.get()

  let updated = 0
  let skipped = 0

  const updates: Array<{ id: string; data: Record<string, any> }> = []
  snap.forEach((doc) => {
    const data = doc.data() || {}

    const normalized = enforceNoteSchemaOnWrite({
      semester: data.semester,
      section: data.section,
      materialType: typeof data.materialType === 'string' ? data.materialType : '',
      materialSequence: data.materialSequence,
    })

    const currentSemester = typeof data.semester === 'string' ? data.semester.trim() : data.semester
    const currentSection = typeof data.section === 'string' ? data.section.trim() : data.section
    const currentSeq = data.materialSequence

    const needsUpdate =
      currentSemester !== normalized.semester ||
      currentSection !== normalized.section ||
      currentSeq !== normalized.materialSequence

    if (needsUpdate) {
      updates.push({ id: doc.id, data: {
        semester: normalized.semester,
        section: normalized.section,
        materialSequence: normalized.materialSequence,
      } })
    } else {
      skipped++
    }
  })

  // Batch updates in chunks to avoid exceeding Firestore limits
  const chunkSize = 400
  for (let i = 0; i < updates.length; i += chunkSize) {
    const chunk = updates.slice(i, i + chunkSize)
    const batch = db.batch()
    for (const u of chunk) {
      const ref = notesRef.doc(u.id)
      batch.set(ref, u.data, { merge: true })
    }
    await batch.commit()
    updated += chunk.length
    console.log(`[migrate-normalize-notes] Updated ${chunk.length} notes in batch`) // eslint-disable-line no-console
  }

  console.log(`[migrate-normalize-notes] Done. Updated: ${updated}, Skipped: ${skipped}, Total: ${snap.size}`) // eslint-disable-line no-console
}

run().catch((err) => {
  console.error('[migrate-normalize-notes] Failed:', err) // eslint-disable-line no-console
  process.exit(1)
})


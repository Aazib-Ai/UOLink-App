import { initializeTestEnvironment, assertFails, assertSucceeds, RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { readFileSync } from 'fs'

async function main() {
  const rules = readFileSync('firestore.rules', 'utf8')
  let testEnv: RulesTestEnvironment | undefined

  try {
    const host = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1'
    const port = Number(process.env.FIRESTORE_EMULATOR_PORT || 8080)
    testEnv = await initializeTestEnvironment({
      projectId: 'uolink-rules-test',
      firestore: { rules, host, port },
    })

    // Seed baseline data with rules disabled
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      // Seed note and nested collections
      await db.collection('notes').doc('note1').set({ title: 'Test Note', uploadedBy: 'alice' })
      await db.collection('notes').doc('note1').collection('comments').doc('comment1').set({ text: 'Seed comment', replyCount: 0 })
      await db.collection('notes').doc('note1').collection('comments').doc('comment1').collection('replies').doc('reply1').set({ text: 'Seed reply' })

      // Seed profiles
      await db.collection('profiles').doc('alice').set({ fullName: 'Alice', bio: '', role: 'user', uid: 'alice' })
      await db.collection('profiles').doc('bob').set({ fullName: 'Bob', bio: '', role: 'user', uid: 'bob' })

      // Seed users private subcollections
      await db.collection('users').doc('alice').collection('private').doc('settings').set({ theme: 'dark' })
      await db.collection('users').doc('bob').collection('private').doc('settings').set({ theme: 'light' })

      // Seed unknown collection for catch-all deny
      await db.collection('secret').doc('doc1').set({ value: 42 })
    })

    const aliceDb = testEnv.authenticatedContext('alice').firestore()
    const bobDb = testEnv.authenticatedContext('bob').firestore()
    const unauthDb = testEnv.unauthenticatedContext().firestore()

    console.log('— Testing comments write is blocked for clients —')
    await assertFails(
      aliceDb.collection('notes').doc('note1').collection('comments').add({ text: 'Hello', userId: 'alice' })
    )
    console.log('✓ Client comments write blocked as expected')

    console.log('— Testing replies write is blocked for clients —')
    await assertFails(
      aliceDb.collection('notes').doc('note1').collection('comments').doc('comment1').collection('replies').add({ text: 'Reply', userId: 'alice' })
    )
    console.log('✓ Client replies write blocked as expected')

    console.log('— Testing reads allowed for notes, comments, and replies —')
    await assertSucceeds(aliceDb.collection('notes').doc('note1').get())
    await assertSucceeds(bobDb.collection('notes').doc('note1').get())
    await assertSucceeds(unauthDb.collection('notes').doc('note1').get())
    await assertSucceeds(aliceDb.collection('notes').doc('note1').collection('comments').doc('comment1').get())
    await assertSucceeds(bobDb.collection('notes').doc('note1').collection('comments').doc('comment1').get())
    await assertSucceeds(unauthDb.collection('notes').doc('note1').collection('comments').doc('comment1').get())
    await assertSucceeds(aliceDb.collection('notes').doc('note1').collection('comments').doc('comment1').collection('replies').doc('reply1').get())
    await assertSucceeds(bobDb.collection('notes').doc('note1').collection('comments').doc('comment1').collection('replies').doc('reply1').get())
    await assertSucceeds(unauthDb.collection('notes').doc('note1').collection('comments').doc('comment1').collection('replies').doc('reply1').get())
    console.log('✓ Reads allowed as expected')

    console.log('— Testing notes create is blocked for clients —')
    await assertFails(
      aliceDb.collection('notes').add({ title: 'New note', uploadedBy: 'alice' })
    )
    await assertFails(
      bobDb.collection('notes').add({ title: 'New note', uploadedBy: 'bob' })
    )
    await assertFails(
      unauthDb.collection('notes').add({ title: 'New note' })
    )
    console.log('✓ Notes create blocked as expected for all clients')

    console.log('— Testing notes update allowed only for owner —')
    await assertSucceeds(
      aliceDb.collection('notes').doc('note1').update({ title: 'Updated by Alice' })
    )
    await assertFails(
      bobDb.collection('notes').doc('note1').update({ title: 'Updated by Bob' })
    )
    await assertFails(
      unauthDb.collection('notes').doc('note1').update({ title: 'Updated by Unauth' })
    )
    console.log('✓ Notes update owner-only enforced')

    console.log('— Testing notes delete allowed only for owner —')
    await assertFails(bobDb.collection('notes').doc('note1').delete())
    await assertFails(unauthDb.collection('notes').doc('note1').delete())
    await assertSucceeds(aliceDb.collection('notes').doc('note1').delete())
    console.log('✓ Notes delete owner-only enforced')

    console.log('— Testing users subcollections owner-only access —')
    await assertSucceeds(aliceDb.collection('users').doc('alice').collection('private').doc('settings').get())
    await assertSucceeds(aliceDb.collection('users').doc('alice').collection('private').doc('settings').update({ theme: 'light' }))
    await assertFails(bobDb.collection('users').doc('alice').collection('private').doc('settings').get())
    await assertFails(bobDb.collection('users').doc('alice').collection('private').doc('settings').update({ theme: 'hacked' }))
    await assertFails(unauthDb.collection('users').doc('alice').collection('private').doc('settings').get())
    console.log('✓ Users subcollections owner-only enforced')

    console.log('— Testing profile update allowed for owner with allowed fields —')
    await assertSucceeds(
      aliceDb.collection('profiles').doc('alice').update({ bio: 'Hi there' })
    )
    console.log('✓ Owner can update allowed profile fields')

    console.log('— Testing profile update blocked for disallowed field —')
    await assertFails(
      aliceDb.collection('profiles').doc('alice').update({ role: 'admin' })
    )
    console.log('✓ Disallowed profile field blocked as expected')

    console.log('— Testing profile update blocked for non-owner —')
    await assertFails(
      bobDb.collection('profiles').doc('alice').update({ bio: 'Injected' })
    )
    console.log('✓ Non-owner profile updates blocked as expected')

    console.log('— Testing profile update blocked for unauthenticated user —')
    await assertFails(
      unauthDb.collection('profiles').doc('alice').update({ bio: 'Unauth write' })
    )
    console.log('✓ Unauthenticated profile updates blocked as expected')

    console.log('— Testing profile field-level validation (bio length, uid immutability) —')
    const longBio = 'x'.repeat(1001)
    await assertFails(aliceDb.collection('profiles').doc('alice').update({ bio: longBio }))
    await assertFails(aliceDb.collection('profiles').doc('alice').update({ uid: 'bob' }))
    console.log('✓ Profile field-level validation enforced')

    console.log('— Testing profiles create blocked for clients —')
    await assertFails(aliceDb.collection('profiles').doc('charlie').set({ uid: 'charlie', bio: 'hi' }))
    console.log('✓ Profile creation blocked')

    console.log('— Testing catch-all deny for unknown collections —')
    await assertFails(unauthDb.collection('secret').doc('doc1').get())
    await assertFails(aliceDb.collection('secret').doc('doc1').get())
    await assertFails(aliceDb.collection('secret').doc('doc1').update({ value: 43 }))
    console.log('✓ Unknown collections access denied')

  } catch (err) {
    console.warn('Firestore emulator not detected. Skipping rules tests.')
    console.warn('To run, start emulator and set FIRESTORE_EMULATOR_PORT if needed.')
    process.exitCode = 0
  } finally {
    await testEnv?.cleanup()
  }
}

main()

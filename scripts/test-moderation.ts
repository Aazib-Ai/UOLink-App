import { evaluateText, enforceModeration, moderateProfileFields } from '@/lib/security/moderation'

async function run() {
  console.log('Testing moderation…')
  const samples = [
    'Hello world',
    'This is damn bad',
    'Contact me at test@example.com',
    'Free money! Click here: http://spam.ru/win',
  ]
  for (const s of samples) {
    const evalRes = evaluateText(s)
    console.log('Eval:', s, evalRes)
    const enf = await enforceModeration(s, { endpoint: '/test', userId: 'tester' })
    console.log('Enforce:', s, enf)
  }

  const profile = { bio: 'I love free money', about: 'NSFW links', skills: ['JS', 'damn go'] }
  const mod = moderateProfileFields(profile)
  console.log('Profile moderation:', mod)
}

run().catch((err) => {
  console.error('Moderation test failed:', err)
  process.exit(1)
})


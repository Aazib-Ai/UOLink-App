import Navbar from '@/components/Navbar'
import StartContributingCTA from '@/components/about/StartContributingCTA'
import Link from 'next/link'

const featureHighlights = [
  {
    id: '01',
    title: 'Scan Notes on the Go (The UOLink Scanner)',
    description:
      'You do not need another app. Use the built-in UOLink Scanner to snap photos of your physical notes, watch it auto-detect the page, and turn them into a single, high-quality PDF right from your phone. Going from paper to platform takes seconds.',
  },
  {
    id: '02',
    title: 'Find What Is Fire (The Vibe Score)',
    description:
      "Do not waste time on sus notes. Our community uses a Vibe Score made of upvotes, downvotes, and saves to tell you what is legit. Instantly see a note's credibility, and filter by trending or top-rated to find the best stuff fast.",
  },
  {
    id: '03',
    title: 'Build Your Aura (The Glow Up)',
    description:
      'Upload fire notes, earn saves and upvotes, and watch your Aura score climb. Unlock cosmetic rewards, rise on the community leaderboard, and show everyone you are the real one.',
  },
]

const crewCallsToAction = [
  {
    title: 'For Students',
    description:
      'You are the heart of this platform. Start building your Aura by contributing your notes, scan them with our tool or upload a file. Every upload helps a fellow student and makes UOLink more valuable for everyone.',
  },
  {
    title: 'For Coders, Creatives, & Builders',
    description:
      'UOLink is 100% open-source, and we need your skills. Sling code, pitch a new UI, or share a bug fix on GitHub. Shipping real features to help thousands of classmates is a legit way to grow your portfolio.',
  },
]

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <main className="container mx-auto mt-20 px-4 pb-16 md:mt-24">
        <div className="mx-auto max-w-4xl space-y-10">
          <section className="rounded-3xl border border-amber-200 bg-white/80 p-8 text-center shadow-lg shadow-amber-100 backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#90c639]">About UOLink</p>
            <h1 className="mt-5 text-3xl font-bold text-gray-900 sm:text-4xl md:text-5xl">Find Fire Notes. Build Your Aura.</h1>
            <p className="mt-5 text-base text-gray-600 sm:text-lg">
              UOLink is a platform for students at the University of Lahore Sargodha campus, built by a student from the same campus. Share your
              notes, discover the best study materials, and get real recognition for your contributions. No gatekeeping. No stress. No cap.
            </p>
          </section>

          <section className="rounded-3xl border border-amber-200 bg-white/80 p-6 shadow-md shadow-amber-100 sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-2xl font-semibold text-gray-900 sm:text-3xl">Our Mission: Stop the Stress</h2>
              <span className="inline-flex items-center justify-center rounded-full bg-[#90c639]/15 px-4 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-[#5a7c27]">
                Community First
              </span>
            </div>
            <p className="mt-5 text-base text-gray-600 sm:text-lg">
              Our mission is simple: nobody should be scrambling for good notes five minutes before an exam. We back a culture where the best
              study materials are accessible to every student, so the entire UOL community can glow up together.
            </p>
          </section>

          <section className="rounded-3xl border border-amber-200 bg-white/80 p-6 shadow-md shadow-amber-100 sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-2xl font-semibold text-gray-900 sm:text-3xl">How UOLink Works</h2>
              <span className="inline-flex items-center justify-center rounded-full bg-[#90c639]/15 px-4 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-[#5a7c27]">
                Built for Students
              </span>
            </div>
            <p className="mt-5 text-base text-gray-600">
              This is not just another file dump. Every feature is built to solve real student problems.
            </p>
            <div className="mt-8 space-y-6">
              {featureHighlights.map((feature) => (
                <div
                  key={feature.id}
                  className="flex flex-col gap-4 rounded-2xl border border-amber-100 bg-white/90 p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg sm:flex-row sm:items-start sm:p-7"
                >
                  <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#90c639]/20 text-sm font-semibold text-[#4c6b1f]">
                    {feature.id}
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 sm:text-xl">{feature.title}</h3>
                    <p className="mt-3 text-base text-gray-600">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-amber-200 bg-white/80 p-6 shadow-md shadow-amber-100 sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-2xl font-semibold text-gray-900 sm:text-3xl">Join the Crew</h2>
              <span className="inline-flex items-center justify-center rounded-full bg-[#90c639]/15 px-4 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-[#5a7c27]">
                Open Source
              </span>
            </div>
            <p className="mt-5 text-base text-gray-600">
              UOLink is built by the community, for the community. Slide in where you vibe the most and help shape what comes next.
            </p>
            <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
              {crewCallsToAction.map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-amber-100 bg-gradient-to-br from-white/95 to-white/75 p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                >
                  <h3 className="text-lg font-semibold text-gray-900 sm:text-xl">{item.title}</h3>
                  <p className="mt-3 text-base text-gray-600">{item.description}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-[#1e2f19] bg-gradient-to-br from-[#1e2f19] via-[#16341f] to-[#0f1f12] px-6 py-8 text-white shadow-2xl shadow-emerald-900/20 sm:px-8 sm:py-10">
            <h3 className="text-2xl font-semibold sm:text-3xl">Ready to glow up with us?</h3>
            <p className="mt-3 text-base text-emerald-100 sm:text-lg">
              Share your notes, build your Aura, and help create the most trusted study hub on campus.
            </p>
            <div className="mt-6 flex flex-col gap-4 sm:flex-row">
              <StartContributingCTA className="w-full sm:w-auto" />
              <Link
                href="https://github.com/Aazib-Ai/UOLink-App"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center rounded-full border border-white/40 px-6 py-3 text-sm font-semibold text-white transition hover:border-white hover:bg-white/10 sm:w-auto"
              >
                Build with Us on GitHub
              </Link>
            </div>
          </section>

          <footer className="text-center text-sm text-gray-500">
            Created with {'\u2764\uFE0F'} by <span className="font-semibold text-[#90c639]">Aazib</span>
          </footer>
        </div>
      </main>
    </>
  )
}

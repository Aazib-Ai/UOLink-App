import Navbar from '@/components/Navbar'
import Link from 'next/link'

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <div className="container md:mt-24 mt-20 mx-auto px-4 pb-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-center mb-8">About Get Material</h1>

          <div className="bg-white p-8 rounded-xl shadow-lg">
            <div className="prose max-w-none">
              <h2 className="text-2xl font-semibold mb-4">Our Mission</h2>
              <p className="text-gray-600 mb-6">
                Get Material is a platform dedicated to helping students access and share educational materials easily.
                We believe in the power of collaborative learning and want to make quality study materials accessible to everyone.
              </p>

              <h2 className="text-2xl font-semibold mb-4">What We Do</h2>
              <p className="text-gray-600 mb-6">
                Our platform allows students and educators to upload, share, and access study materials including notes,
                assignments, and reference documents. We organize content by subject, semester, and topics to make
                finding the right materials effortless.
              </p>

              <h2 className="text-2xl font-semibold mb-4">Get Involved</h2>
              <p className="text-gray-600 mb-6">
                Join our community of learners! You can contribute by uploading your own study materials or help us
                keep the platform running through donations. Every contribution helps us maintain and improve our service.
              </p>

              <div className="flex gap-4 mt-8">
                <Link href="/" className="bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-colors">
                  Browse Materials
                </Link>
                <Link href="/auth" className="bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 transition-colors">
                  Contribute Materials
                </Link>
                <Link href="/donate" className="bg-yellow-500 text-black px-6 py-3 rounded-lg hover:bg-yellow-600 transition-colors">
                  Support Us
                </Link>
              </div>
            </div>
          </div>

          <div className="text-center mt-12">
            <p className="text-gray-600">
              Created with ❤️ by <span className="text-green-600 font-semibold">Aazib</span>
            </p>
          </div>
        </div>
      </div>
    </>
  )
}

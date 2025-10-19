import Navbar from '@/components/Navbar'
import Link from 'next/link'

export default function DonatePage() {
  return (
    <>
      <Navbar />
      <div className="container md:mt-24 mt-20 mx-auto px-4 pb-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-center mb-8">Support Our Mission</h1>

          <div className="bg-white p-8 rounded-xl shadow-lg">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-semibold mb-4">Help Us Keep Learning Accessible</h2>
              <p className="text-gray-600 text-lg">
                Your donation helps us maintain our database, improve our services, and keep educational materials free for everyone.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 mb-8">
              <div className="bg-yellow-50 p-6 rounded-lg">
                <h3 className="text-xl font-semibold mb-3">Why Donate?</h3>
                <ul className="text-gray-600 space-y-2">
                  <li>• Maintain our growing database of materials</li>
                  <li>• Improve platform performance and features</li>
                  <li>• Keep the service free for all students</li>
                  <li>• Support server and infrastructure costs</li>
                </ul>
              </div>

              <div className="bg-green-50 p-6 rounded-lg">
                <h3 className="text-xl font-semibold mb-3">Your Impact</h3>
                <ul className="text-gray-600 space-y-2">
                  <li>• Help thousands of students access materials</li>
                  <li>• Support collaborative learning</li>
                  <li>• Enable educators to share resources</li>
                  <li>• Build a sustainable educational community</li>
                </ul>
              </div>
            </div>

            <div className="text-center bg-amber-100 p-6 rounded-lg mb-8">
              <h3 className="text-xl font-semibold mb-4">Database Costs Are Rising!</h3>
              <p className="text-gray-700 mb-4">
                As our community grows, so do our infrastructure costs. Your support ensures we can continue providing this valuable service.
              </p>
              <p className="text-amber-600 font-semibold">
                Every contribution, no matter the size, makes a difference!
              </p>
            </div>

            <div className="text-center">
              <h3 className="text-xl font-semibold mb-6">How to Support</h3>

              <div className="space-y-6">
                <div className="bg-gradient-to-br from-purple-50 to-indigo-50 p-8 rounded-2xl shadow-lg border border-purple-100">
                  <div className="flex flex-col items-center space-y-6">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-indigo-400 rounded-2xl blur-lg opacity-30 animate-pulse"></div>
                      <div className="relative bg-white p-2 rounded-2xl shadow-xl">
                        <img
                          src="/QR.jpeg"
                          alt="Payment QR Code"
                          className="w-48 h-48 md:w-64 md:h-64 rounded-xl"
                        />
                      </div>
                    </div>

                    <div className="text-center space-y-4">
                      <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl blur-lg opacity-20"></div>
                        <div className="relative bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-3 rounded-xl shadow-lg">
                          <h4 className="text-xl font-bold mb-1">Scan to Support</h4>
                        </div>
                      </div>

                      <div className="max-w-md">
                        <p className="text-gray-700 text-sm md:text-base leading-relaxed bg-white/80 backdrop-blur px-4 py-3 rounded-lg border border-purple-100">
                          <span className="text-purple-600 font-semibold">🔒 Trusted Payment:</span> Scan the QR with your payment app and <span className="font-bold text-indigo-600">UOL community will ensure that your money will go to only good cause, not for personal use.</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 p-6 rounded-lg">
                  <h4 className="font-semibold mb-2">Need Other Payment Options?</h4>
                  <p className="text-gray-600">
                    Contact us at <a href="mailto:support@uolink.com" className="text-[#90c639] hover:underline">support@uolink.com</a> for alternative payment methods.
                  </p>
                </div>
              </div>

              <div className="mt-8 space-y-4">
                <Link href="/" className="block bg-black text-white px-8 py-3 rounded-lg hover:bg-gray-800 transition-colors">
                  Continue to Materials
                </Link>
                <Link href="/auth" className="block bg-[#90c639] text-white px-8 py-3 rounded-lg hover:bg-[#7ba032] transition-colors">
                  Share Your Materials
                </Link>
              </div>
            </div>
          </div>

          <div className="text-center mt-8">
            <p className="text-gray-600">
              Thank you for supporting education! ❤️
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
import Navbar from '@/components/Navbar'
import DonatePageClient from '@/components/DonatePageClient'

const qrImage = 'https://pub-dce6478318af4978926a0e278f8a72e5.r2.dev/App-content/Qr.jpeg'

export default function DonatePage() {
  return (
    <>
      <Navbar />
      <DonatePageClient qrImage={qrImage} />
    </>
  )
}

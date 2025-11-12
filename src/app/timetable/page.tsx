import TimetablePage from '@/components/TimetablePage'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Timetable | UOLink',
  description: 'Manage and view your class schedule. The foundation is ready for future timetable features.',
}

export default function Timetable() {
  return <TimetablePage />
}


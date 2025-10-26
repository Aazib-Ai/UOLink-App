import { Search } from 'lucide-react'

interface DashboardSearchProps {
  titleFilter: string
  setTitleFilter: (value: string) => void
}

export const DashboardSearch: React.FC<DashboardSearchProps> = ({
  titleFilter,
  setTitleFilter,
}) => {
  return (
    <div className="mb-6">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          id="titleFilter"
          value={titleFilter}
          onChange={(e) => setTitleFilter(e.target.value)}
          placeholder="Search notes..."
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-amber-200 bg-white text-sm font-medium text-gray-900 shadow-sm transition focus:border-[#90c639] focus:outline-none focus:ring-2 focus:ring-[#90c639]/20"
        />
      </div>
    </div>
  )
}
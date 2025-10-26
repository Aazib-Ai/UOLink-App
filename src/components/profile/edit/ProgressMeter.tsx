import { CheckCircle } from 'lucide-react'

interface ProgressMeterProps {
  completionScore: number
  isProfileComplete: boolean
}

export default function ProgressMeter({ completionScore, isProfileComplete }: ProgressMeterProps) {
  if (isProfileComplete) return null

  return (
    <div className="mt-8">
      <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm max-w-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#5f7f2a]/70">Completion</p>
        <div className="mt-2 flex items-baseline justify-between">
          <span className="text-3xl font-semibold text-gray-900">{completionScore}%</span>
          <span className="text-xs text-gray-500">profile score</span>
        </div>
        <div className="mt-3 h-2 rounded-full bg-[#e7f4cf]">
          <div
            className="h-full rounded-full bg-[#90c639] transition-all duration-300"
            style={{ width: `${completionScore}%` }}
          />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-[#90c639]" />
          <span className="text-xs font-semibold text-[#426014]">
            {completionScore >= 70 ? 'Almost complete' : 'Keep building'}
          </span>
        </div>
      </div>
    </div>
  )
}
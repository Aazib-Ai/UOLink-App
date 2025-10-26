interface SuccessBannerProps {
  success: string | null
  error: string | null
}

export default function SuccessBanner({ success, error }: SuccessBannerProps) {
  if (success) {
    return (
      <div
        className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-sm font-medium text-[#2f5f1d] shadow-sm animate-in slide-in-from-top-2 fade-in-50"
        role="status"
      >
        {success}
      </div>
    )
  }

  if (error) {
    return (
      <div
        className="mt-4 rounded-2xl border border-rose-200 bg-rose-50/90 px-4 py-3 text-sm font-medium text-rose-600 shadow-sm animate-in slide-in-from-top-2 fade-in-50"
        role="alert"
      >
        {error}
      </div>
    )
  }

  return null
}
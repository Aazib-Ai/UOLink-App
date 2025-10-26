'use client'

import { ChevronDown, Filter, X } from 'lucide-react'
import CustomSelect from '../CustomSelect'
import { toTitleCase, normalizeForStorage } from '@/lib/utils'
import { MAJOR_NAMES } from '@/constants/universityData'

interface DashboardFiltersProps {
  showFilters: boolean
  setShowFilters: (show: boolean) => void
  filterOptions: any
  titleFilter: string
  setTitleFilter: (value: string) => void
  semesterFilter: string
  setSemesterFilter: (value: string) => void
  subjectFilter: string
  setSubjectFilter: (value: string) => void
  teacherFilter: string
  setTeacherFilter: (value: string) => void
  nameFilter: string
  setNameFilter: (value: string) => void
  sectionFilter: string
  setSectionFilter: (value: string) => void
  majorFilter: string
  setMajorFilter: (value: string) => void
  materialTypeFilter: string
  setMaterialTypeFilter: (value: string) => void
  materialSequenceFilter: string
  setMaterialSequenceFilter: (value: string) => void
  hasActiveFilters: () => boolean
  resetFilters: () => void
}

export const DashboardFilters: React.FC<DashboardFiltersProps> = ({
  showFilters,
  setShowFilters,
  filterOptions,
  titleFilter,
  setTitleFilter,
  semesterFilter,
  setSemesterFilter,
  subjectFilter,
  setSubjectFilter,
  teacherFilter,
  setTeacherFilter,
  nameFilter,
  setNameFilter,
  sectionFilter,
  setSectionFilter,
  majorFilter,
  setMajorFilter,
  materialTypeFilter,
  setMaterialTypeFilter,
  materialSequenceFilter,
  setMaterialSequenceFilter,
  hasActiveFilters,
  resetFilters,
}) => {
  const formatMaterialType = (value: string) => {
    if (!value) {
      return 'Not specified'
    }
    return toTitleCase(value.replace(/-/g, ' '))
  }

  const materialTypeDisplayMap = (() => {
    const map = new Map<string, string>()
    const types = Array.isArray(filterOptions.materialTypes) ? filterOptions.materialTypes : []
    types.forEach((type: string) => {
      if (!type) {
        return
      }
      const label = formatMaterialType(type)
      map.set(label, type)
    })
    return map
  })()

  const materialTypeOptionsList = ['Select Material Type', ...Array.from(materialTypeDisplayMap.keys())]

  const sectionOptionsList = (() => {
    const sections = Array.isArray(filterOptions.sections) ? filterOptions.sections : []
    return ['Select Section', ...sections.map((section: string) => section.toUpperCase())]
  })()

  const materialSequenceOptionsList = (() => {
    const sequences = Array.isArray(filterOptions.materialSequences) ? filterOptions.materialSequences : []
    const sequenceLabel =
      materialTypeFilter === 'assignment'
        ? 'Select Assignment'
        : materialTypeFilter === 'quiz'
          ? 'Select Quiz'
          : 'Select Number'
    return [sequenceLabel, ...sequences]
  })()

  const materialTypeLabel = materialTypeFilter ? formatMaterialType(materialTypeFilter) : ''

  const isSequenceFilterEnabled = materialTypeFilter === 'assignment' || materialTypeFilter === 'quiz'

  const materialSequencePlaceholder = materialSequenceFilter
    ? materialSequenceFilter
    : materialTypeFilter === 'assignment'
      ? 'Assignment Number'
      : materialTypeFilter === 'quiz'
        ? 'Quiz Number'
        : 'Select Number'



  const getActiveFilterCount = () => {
    let count = 0
    if (titleFilter.trim() !== '') count++
    if (semesterFilter) count++
    if (subjectFilter) count++
    if (teacherFilter) count++
    if (nameFilter) count++
    if (sectionFilter) count++
    if (majorFilter) count++
    if (materialTypeFilter) count++
    if (materialSequenceFilter) count++
    return count
  }

  return (
    <>
      {/* Mobile Filter Toggle */}
      <div className="flex justify-between items-center mb-4 md:hidden">
        <div className="flex flex-wrap gap-2">
          {majorFilter && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[#90c639] text-white text-xs font-medium">
              {majorFilter}
              <button
                onClick={() => setMajorFilter("")}
                className="hover:bg-white/20 rounded-full p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {subjectFilter && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-500 text-white text-xs font-medium">
              {toTitleCase(subjectFilter)}
              <button
                onClick={() => setSubjectFilter("")}
                className="hover:bg-white/20 rounded-full p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 px-3 py-2 rounded-full border border-amber-200 bg-amber-50 text-sm font-medium text-gray-700 transition hover:bg-amber-100"
        >
          <Filter className="w-4 h-4" />
          Filters
          {getActiveFilterCount() > 0 && (
            <span className="bg-[#90c639] text-white text-xs rounded-full px-2 py-0.5">
              {getActiveFilterCount()}
            </span>
          )}
          <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Collapsible Filter Panel */}
      <div className={`mb-4 transition-all duration-300 overflow-hidden ${showFilters ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0 md:max-h-full md:opacity-100'}`}>
        <div className="bg-white/90 rounded-2xl border border-amber-100 p-3 md:p-4 shadow-lg">
          {/* Mobile Filter Header */}
          <div className="flex items-center justify-between mb-3 md:hidden">
            <h3 className="text-sm font-semibold text-gray-900">Filter Notes</h3>
            <button
              onClick={() => setShowFilters(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Filter Pills - Most Important First */}
          <div className="space-y-3 md:space-y-4">
            {/* Top Row - Most Used Filters */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
              <div>
                <label className="text-[10px] md:text-xs font-semibold uppercase tracking-wide text-gray-600 block mb-1">
                  Subject
                </label>
                <CustomSelect
                  options={["Select Subject", ...filterOptions.subjects.map((subject: string) => toTitleCase(subject))]}
                  placeholder="Subject"
                  value={subjectFilter ? toTitleCase(subjectFilter) : undefined}
                  size="sm"
                  onChange={(selectedOption) => {
                    if (selectedOption === "Select Subject") {
                      setSubjectFilter("")
                    } else {
                      setSubjectFilter(selectedOption.toLowerCase())
                    }
                  }}
                />
              </div>

              <div>
                <label className="text-[10px] md:text-xs font-semibold uppercase tracking-wide text-gray-600 block mb-1">
                  Major
                </label>
                <CustomSelect
                  options={["Select Major", ...MAJOR_NAMES]}
                  placeholder="Major"
                  value={majorFilter || undefined}
                  size="sm"
                  onChange={(selectedOption) => {
                    if (selectedOption === "Select Major") {
                      setMajorFilter("")
                    } else {
                      setMajorFilter(selectedOption)
                    }
                  }}
                />
              </div>

              <div>
                <label className="text-[10px] md:text-xs font-semibold uppercase tracking-wide text-gray-600 block mb-1">
                  Semester
                </label>
                <CustomSelect
                  options={["Select Semester", ...filterOptions.semesters]}
                  placeholder="Semester"
                  value={semesterFilter || undefined}
                  size="sm"
                  onChange={(selectedOption) => {
                    if (selectedOption === "Select Semester") {
                      setSemesterFilter("")
                    } else {
                      setSemesterFilter(selectedOption)
                    }
                  }}
                />
              </div>

              <div>
                <label className="text-[10px] md:text-xs font-semibold uppercase tracking-wide text-gray-600 block mb-1">
                  Teacher
                </label>
                <CustomSelect
                  options={["Select Teacher", ...filterOptions.teachers.map((teacher: string) => toTitleCase(teacher))]}
                  placeholder="Teacher"
                  value={teacherFilter ? toTitleCase(teacherFilter) : undefined}
                  size="sm"
                  onChange={(selectedOption) => {
                    if (selectedOption === "Select Teacher") {
                      setTeacherFilter("")
                    } else {
                      setTeacherFilter(selectedOption.toLowerCase())
                    }
                  }}
                />
              </div>
            </div>

            {/* Second Row - Additional Filters */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
              <div>
                <label className="text-[10px] md:text-xs font-semibold uppercase tracking-wide text-gray-600 block mb-1">
                  Section
                </label>
                <CustomSelect
                  options={sectionOptionsList}
                  placeholder="Section"
                  value={sectionFilter ? sectionFilter.toUpperCase() : undefined}
                  size="sm"
                  onChange={(selectedOption) => {
                    if (selectedOption === "Select Section") {
                      setSectionFilter("")
                    } else {
                      setSectionFilter(selectedOption.toUpperCase())
                    }
                  }}
                />
              </div>

              <div>
                <label className="text-[10px] md:text-xs font-semibold uppercase tracking-wide text-gray-600 block mb-1">
                  Type
                </label>
                <CustomSelect
                  options={materialTypeOptionsList}
                  placeholder="Material Type"
                  value={materialTypeLabel || undefined}
                  size="sm"
                  onChange={(selectedOption) => {
                    if (selectedOption === "Select Material Type") {
                      setMaterialTypeFilter("")
                      setMaterialSequenceFilter("")
                    } else {
                      const mappedValue = materialTypeDisplayMap.get(selectedOption) || normalizeForStorage(selectedOption)
                      setMaterialTypeFilter(mappedValue)
                    }
                  }}
                />
              </div>

              {isSequenceFilterEnabled && (
                <div>
                  <label className="text-[10px] md:text-xs font-semibold uppercase tracking-wide text-gray-600 block mb-1">
                    Number
                  </label>
                  <CustomSelect
                    options={materialSequenceOptionsList}
                    placeholder={materialSequencePlaceholder}
                    value={materialSequenceFilter || undefined}
                    size="sm"
                    onChange={(selectedOption) => {
                      const firstOption = materialSequenceOptionsList[0]
                      if (selectedOption === firstOption) {
                        setMaterialSequenceFilter("")
                      } else {
                        setMaterialSequenceFilter(selectedOption.trim())
                      }
                    }}
                  />
                </div>
              )}

              <div>
                <label className="text-[10px] md:text-xs font-semibold uppercase tracking-wide text-gray-600 block mb-1">
                  Contributor
                </label>
                <input
                  type="text"
                  value={nameFilter}
                  onChange={(event) => setNameFilter(event.target.value)}
                  placeholder="Name"
                  className="w-full rounded-xl border border-amber-200 px-3 py-2 md:px-4 md:py-3 text-xs md:text-sm font-medium text-gray-900 shadow-sm transition focus:border-[#90c639] focus:outline-none focus:ring-2 focus:ring-[#90c639]/20"
                />
              </div>
            </div>

            {/* Reset Button */}
            {hasActiveFilters() && (
              <button
                type="button"
                onClick={resetFilters}
                className="w-full rounded-xl border border-amber-300 bg-amber-100/80 px-3 py-2 md:px-4 text-xs md:text-sm font-semibold text-gray-800 transition hover:border-amber-500 hover:bg-amber-100"
              >
                Reset all filters
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

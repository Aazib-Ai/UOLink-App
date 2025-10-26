'use client'

import { useRef, useState } from 'react'
import { X, Plus } from 'lucide-react'

const COMMON_SKILLS = [
  'Python', 'JavaScript', 'React', 'Node.js', 'TypeScript', 'Java', 'C++', 'C#',
  'HTML/CSS', 'SQL', 'MongoDB', 'Express.js', 'Vue.js', 'Angular', 'Django',
  'Flutter', 'Swift', 'Kotlin', 'Go', 'Rust', 'PHP', 'Ruby', 'MATLAB',
  'Machine Learning', 'Data Analysis', 'Web Development', 'Mobile Development',
  'Cloud Computing', 'DevOps', 'UI/UX Design', 'Git', 'Docker', 'AWS',
  'Google Cloud', 'Azure', 'TensorFlow', 'PyTorch', 'Deep Learning',
  'Blockchain', 'Game Development', 'AR/VR', 'IoT', 'Networking'
]

interface SkillsManagerProps {
  skills: string[]
  onAddSkill: (skill: string) => void
  onRemoveSkill: (skill: string) => void
}

export default function SkillsManager({ skills, onAddSkill, onRemoveSkill }: SkillsManagerProps) {
  const [newSkill, setNewSkill] = useState('')
  const skillsInputRef = useRef<HTMLInputElement>(null)

  const addSkill = () => {
    const trimmedSkill = newSkill.trim()
    if (trimmedSkill && !skills.includes(trimmedSkill)) {
      onAddSkill(trimmedSkill)
      setNewSkill('')
    }
  }

  const handleSkillInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addSkill()
    }
  }

  const addCommonSkill = (skill: string) => {
    if (!skills.includes(skill)) {
      onAddSkill(skill)
    }
  }

  return (
    <section className="rounded-2xl border border-lime-100 bg-white/90 p-5 shadow-sm">
      <div>
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-[#5f7f2a]/70">Signature strengths</p>
        <h2 className="text-lg font-semibold text-gray-900">Skills</h2>
      </div>
      <div className="mt-6 space-y-5">
        {skills.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
              Your skills ({skills.length})
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {skills.map((skill, index) => (
                <span
                  key={index}
                  className="group inline-flex items-center gap-2 rounded-full border border-[#90c639]/40 bg-[#f4fbe8] px-4 py-2 text-xs font-semibold text-[#335013] shadow-sm"
                >
                  {skill}
                  <button
                    type="button"
                    onClick={() => onRemoveSkill(skill)}
                    className="rounded-full border border-transparent bg-white/40 p-1 text-[#335013] transition hover:bg-white hover:text-rose-600"
                    aria-label={`Remove ${skill}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Add a skill</label>
            <input
              ref={skillsInputRef}
              type="text"
              value={newSkill}
              onChange={(e) => setNewSkill(e.target.value)}
              onKeyDown={handleSkillInputKeyDown}
              className="mt-2 w-full rounded-xl border border-lime-200 bg-white/70 px-4 py-3 text-sm text-gray-900 shadow-sm transition hover:border-lime-300 focus:border-[#90c639] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#90c639]/20"
              placeholder="Type a skill and press Enter"
            />
          </div>
          <button
            type="button"
            onClick={addSkill}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#90c639] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#7ab332]"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Suggested skills</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {COMMON_SKILLS.slice(0, 15).map((skill) => {
              const isAdded = skills.includes(skill)
              return (
                <button
                  key={skill}
                  type="button"
                  onClick={() => addCommonSkill(skill)}
                  disabled={isAdded}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    isAdded
                      ? 'cursor-not-allowed border-lime-100 bg-lime-50 text-gray-400'
                      : 'border-lime-200 bg-white text-gray-700 hover:-translate-y-0.5 hover:border-[#90c639] hover:text-gray-900'
                  }`}
                >
                  {skill}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
"use client"

import { useState, useEffect } from "react"

interface MorphingTextProps {
  texts: string[]
  className?: string
}

export function MorphingText({ texts, className = "" }: MorphingTextProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    if (texts.length <= 1) return

    const interval = setInterval(() => {
      setIsAnimating(true)
      setTimeout(() => {
        setCurrentIndex((prevIndex) => (prevIndex + 1) % texts.length)
        setIsAnimating(false)
      }, 150)
    }, 3000)

    return () => clearInterval(interval)
  }, [texts.length])

  if (!texts || texts.length === 0) {
    return <p className={`text-black font-bold text-center md:text-sm h-14 ${className}`}>Loading..</p>
  }

  return (
    <div className={`w-full ${className}`}>
      <p
        className={`text-black font-bold text-center md:text-sm h-14 flex items-center justify-center transition-opacity duration-150 ${
          isAnimating ? 'opacity-0' : 'opacity-100'
        }`}
      >
        {texts[currentIndex]}
      </p>
    </div>
  )
}
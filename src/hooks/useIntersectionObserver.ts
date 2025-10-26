import { useEffect, useState, RefObject } from 'react'

interface UseIntersectionObserverOptions {
    threshold?: number | number[]
    root?: Element | null
    rootMargin?: string
    freezeOnceVisible?: boolean
}

export function useIntersectionObserver(
    elementRef: RefObject<Element>,
    options: UseIntersectionObserverOptions = {}
): boolean {
    const {
        threshold = 0,
        root = null,
        rootMargin = '0px',
        freezeOnceVisible = false
    } = options

    const [isIntersecting, setIsIntersecting] = useState(false)

    useEffect(() => {
        const element = elementRef.current

        // If element doesn't exist or IntersectionObserver is not supported
        if (!element || typeof IntersectionObserver === 'undefined') {
            return
        }

        // If already intersecting and freezeOnceVisible is true, don't observe
        if (freezeOnceVisible && isIntersecting) {
            return
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                const isElementIntersecting = entry.isIntersecting

                setIsIntersecting(isElementIntersecting)

                // If freezeOnceVisible and element is intersecting, disconnect observer
                if (freezeOnceVisible && isElementIntersecting) {
                    observer.unobserve(element)
                }
            },
            {
                threshold,
                root,
                rootMargin
            }
        )

        observer.observe(element)

        return () => {
            observer.disconnect()
        }
    }, [elementRef, threshold, root, rootMargin, freezeOnceVisible, isIntersecting])

    return isIntersecting
}
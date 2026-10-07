import * as React from "react"

const MOBILE_BREAKPOINT = 768

// breakpoint: width (px) below which this counts as mobile; the app sidebar passes lg (1024).
export function useIsMobile(breakpoint = MOBILE_BREAKPOINT) {
  const query = `(max-width: ${breakpoint - 1}px)`
  const subscribe = React.useCallback((onChange: () => void) => {
    const mql = window.matchMedia(query)
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [query])
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false
  )
}

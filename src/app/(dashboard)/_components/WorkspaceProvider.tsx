'use client'

import {
  createContext, useCallback, useContext, useEffect, useState,
  type ReactNode,
} from 'react'
import {
  WORKSPACE_STORAGE_KEY, deserializeWorkspace, serializeWorkspace,
} from '../_lib/workspace-storage'

type Store = Record<string, unknown>
type WorkspaceCtx = {
  store: Store
  setSlice: (key: string, value: unknown) => void
  hydrated: boolean
}

const WorkspaceContext = createContext<WorkspaceCtx | null>(null)

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<Store>({})
  const [hydrated, setHydrated] = useState(false)

  // 마운트 후에만 sessionStorage 읽기 (SSR엔 sessionStorage 없음 → 하이드레이션 미스매치 방지).
  // set-state-in-effect 규칙은 반복 cascading 렌더를 막으려는 것인데, 여기는 마운트 1회성
  // 하이드레이션이라 cascade가 아니다. 빈 deps + 1회 실행이라 안전하므로 의도적으로 끈다.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setStore(deserializeWorkspace(sessionStorage.getItem(WORKSPACE_STORAGE_KEY)))
    setHydrated(true)
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */

  const setSlice = useCallback((key: string, value: unknown) => {
    setStore((prev) => {
      const next = { ...prev, [key]: value }
      try { sessionStorage.setItem(WORKSPACE_STORAGE_KEY, serializeWorkspace(next)) } catch {}
      return next
    })
  }, [])

  return (
    <WorkspaceContext.Provider value={{ store, setSlice, hydrated }}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspaceSlice<T>(key: string): {
  value: T | undefined
  save: (value: T) => void
  hydrated: boolean
} {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspaceSlice must be used within WorkspaceProvider')
  const { store, setSlice, hydrated } = ctx
  const value = store[key] as T | undefined
  const save = useCallback((v: T) => setSlice(key, v), [setSlice, key])
  return { value, save, hydrated }
}

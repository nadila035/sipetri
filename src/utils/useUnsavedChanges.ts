import { useEffect } from "react"

export function confirmNavigation(): boolean {
  return window.dispatchEvent(
    new Event("reporting:navigate", { cancelable: true }),
  )
}

export function useUnsavedChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return

    const navigate = (event: Event) => {
      event.preventDefault()

      window.alert(
        "Perubahan belum tersimpan. Simpan perubahan sebelum berpindah halaman atau peran.",
      )
    }

    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }

    window.addEventListener("reporting:navigate", navigate)

    window.addEventListener("beforeunload", unload)

    return () => {
      window.removeEventListener("reporting:navigate", navigate)

      window.removeEventListener("beforeunload", unload)
    }
  }, [dirty])
}

export function useConfirmableUnsavedChanges(dirty: boolean, message: string) {
  useEffect(() => {
    if (!dirty) return

    const navigate = (event: Event) => {
      if (!window.confirm(message)) {
        event.preventDefault()
      }
    }

    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }

    window.addEventListener("reporting:navigate", navigate)
    window.addEventListener("beforeunload", unload)

    return () => {
      window.removeEventListener("reporting:navigate", navigate)
      window.removeEventListener("beforeunload", unload)
    }
  }, [dirty, message])
}

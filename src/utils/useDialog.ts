import { useEffect, useRef } from "react"

import { animateDialog } from "./useMotion"

export function useDialog(
  open: boolean,
  onClose: () => void,
  selector: string,
) {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return

    const previous = document.activeElement as HTMLElement | null

    const dialog = document.querySelector<HTMLElement>(selector)

    const controls = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          "button, input, select, textarea, a[href]",
        ) ?? [],
      ).filter(
        (el) => !el.hasAttribute("disabled") && el.getClientRects().length > 0,
      )

    controls()[0]?.focus()

    const cleanupMotion = dialog ? animateDialog(dialog) : undefined

    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        onCloseRef.current()
      }

      if (event.key === "Tab") {
        const elements = controls()

        const first = elements[0],
          last = elements[elements.length - 1]

        if (!dialog?.contains(document.activeElement)) {
          event.preventDefault()
          ;(event.shiftKey ? last : first)?.focus()
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first?.focus()
        }
      }
    }

    const handleKeydown = (event: KeyboardEvent) => {
      const dialogs = document.querySelectorAll(
        '[role="dialog"][aria-modal="true"]',
      )

      if (dialogs[dialogs.length - 1] !== dialog) return

      keydown(event)
    }

    document.addEventListener("keydown", handleKeydown)

    return () => {
      cleanupMotion?.()
      document.removeEventListener("keydown", handleKeydown)
      previous?.focus()
    }
  }, [open, selector])
}

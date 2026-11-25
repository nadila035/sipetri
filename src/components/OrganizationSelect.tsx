import { useEffect, useId, useRef, useState } from "react"
import "./organization-select.css"

type OrganizationSelectProps = {
  label: string
  value: string
  options: string[]
  disabled?: boolean
  onChange: (value: string) => void
}

export function OrganizationSelect({ label, value, options, disabled = false, onChange }: OrganizationSelectProps) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLUListElement>(null)

  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) {
        setOpen(false)
        setQuery("")
      }
    }
    document.addEventListener("pointerdown", dismiss)
    return () => document.removeEventListener("pointerdown", dismiss)
  }, [])

  const filtered = options.filter((option) => option.toLocaleLowerCase("id-ID").includes(query.toLocaleLowerCase("id-ID")))
  const activeIndex = Math.min(active, Math.max(0, filtered.length - 1))

  useEffect(() => {
    if (open) list.current?.children[activeIndex]?.scrollIntoView({ block: "nearest" })
  }, [activeIndex, open, query])

  const choose = (option: string) => {
    onChange(option)
    setOpen(false)
    setQuery("")
  }

  return (
    <div ref={root} className="organization-select" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) {
        setOpen(false)
        setQuery("")
      }
    }}>
      <label className="organization-select-label" htmlFor={id}>{label}</label>
      <div className="organization-select-control">
        <input
          id={id}
          name={label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={!disabled && open}
          aria-controls={`${id}-list`}
          aria-activedescendant={!disabled && open && filtered.length ? `${id}-option-${activeIndex}` : undefined}
          autoComplete="off"
          disabled={disabled}
          value={!disabled && open ? query : value}
          placeholder={!disabled && open ? `Cari ${label.toLowerCase()}...` : "Pilih unit"}
          title={value}
          onFocus={() => { if (disabled) return; setOpen(true); setQuery(""); setActive(Math.max(0, options.indexOf(value))) }}
          onClick={() => { if (disabled) return; if (!open) { setOpen(true); setQuery(""); setActive(Math.max(0, options.indexOf(value))) } }}
          onChange={(event) => { if (disabled) return; setQuery(event.target.value); setActive(0); setOpen(true) }}
          onKeyDown={(event) => {
            if (disabled) return
            if (event.key === "Escape") { event.preventDefault(); setOpen(false); setQuery("") }
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault()
              if (!open) { setOpen(true); setQuery(""); setActive(Math.max(0, options.indexOf(value))) }
              else setActive(Math.max(0, Math.min(filtered.length - 1, activeIndex + (event.key === "ArrowDown" ? 1 : -1))))
            }
            if (event.key === "Enter" && open) {
              event.preventDefault()
              if (filtered[activeIndex]) choose(filtered[activeIndex])
            }
          }}
        />
        <svg className="organization-select-arrow" aria-hidden="true" width="10" height="6" viewBox="0 0 10 6" fill="none">
          <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </div>
      {!disabled && open && (
        <div className="organization-select-panel">
          <ul id={`${id}-list`} role="listbox" aria-label={label} ref={list}>
            {filtered.map((option, index) => (
              <li
                id={`${id}-option-${index}`}
                key={option}
                role="option"
                aria-selected={option === value}
                data-active={index === activeIndex}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(option)}
              >{option}</li>
            ))}
          </ul>
          {filtered.length === 0 && <div className="organization-select-empty" role="status">Unit tidak ditemukan.</div>}
        </div>
      )}
    </div>
  )
}

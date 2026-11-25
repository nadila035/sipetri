import { useLayoutEffect, type RefObject } from "react"

import { gsap } from "gsap"

import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(ScrollTrigger)

export function refreshScrollLayout() {
  ScrollTrigger.refresh()
}

export function usePageMotion(
  root: RefObject<HTMLDivElement | null>,
  route: string,
) {
  useLayoutEffect(() => {
    const element = root.current

    if (!element) return

    const media = gsap.matchMedia()

    const context = gsap.context(
      () => {
        media.add("screen and (prefers-reduced-motion: no-preference)", () => {
          const small = window.matchMedia("(max-width: 700px)").matches

          const distance = small ? 12 : 24

          const intro = gsap.timeline({
            defaults: { ease: "power3.out", clearProps: "transform,opacity" },
          })

          const heading = element.querySelector(
            ".welcome-copy, .admin-page > h1, .report-heading",
          )

          if (heading)
            intro.from(heading, { y: distance, opacity: 0.75, duration: 0.65 })

          const deadline = element.querySelector(".deadline-card")

          if (deadline)
            intro.from(
              deadline,
              { x: small ? 0 : 20, y: small ? 10 : 0, duration: 0.7 },
              0.12,
            )

          const actions = element.querySelector(".action-grid")

          if (actions)
            intro.from(actions, { y: 14, opacity: 0.8, duration: 0.55 }, 0.18)

          const metrics = element.querySelectorAll(
            ".kpi-card, .admin-kpis > article",
          )

          if (metrics.length)
            intro.from(
              metrics,
              { y: distance, duration: 0.6, stagger: 0.055 },
              0.22,
            )

          // The dashboard scrolls with the document, not the modal's overflow containers.

          element
            .querySelectorAll<HTMLElement>(
              ".progress-panel, .activity-panel, .admin-charts > section",
            )
            .forEach((section) => {
              const timeline = gsap.timeline({
                scrollTrigger: {
                  trigger: section,
                  start: "top 90%",
                  once: true,
                },

                defaults: {
                  ease: "power3.out",
                  clearProps: "transform,opacity",
                },
              })

              timeline.from(section, {
                y: distance,
                opacity: 0.85,
                duration: 0.65,
                immediateRender: false,
              })

              const bars = section.querySelectorAll(
                ".quarter-bar, .admin-bar-track > div",
              )

              if (bars.length)
                timeline.from(
                  bars,
                  {
                    scaleY: 0.08,
                    transformOrigin: "bottom center",
                    duration: 0.8,
                    stagger: 0.045,
                    immediateRender: false,
                  },
                  0.12,
                )

              const steps = section.querySelectorAll(".document-timeline > li")

              if (steps.length)
                timeline.from(
                  steps,
                  {
                    x: small ? 8 : 14,
                    duration: 0.45,
                    stagger: 0.055,
                    immediateRender: false,
                  },
                  0.12,
                )
            })

          const active = document.querySelector(".nav-item.active")

          if (active)
            gsap.from(active, {
              x: small ? 0 : -5,
              duration: 0.35,
              ease: "power2.out",
              clearProps: "transform",
            })
        })
      },
      element,
    )

    return () => {
      media.revert()
      context.revert()
    }
  }, [root, route])
}

export function animateDialog(dialog: HTMLElement) {
  const media = gsap.matchMedia()

  const context = gsap.context(() => {
    media.add("screen and (prefers-reduced-motion: no-preference)", () => {
      const surface =
        dialog.querySelector(
          ".detail-drawer, .print-preview-bar, .submit-success-dialog",
        ) ?? dialog

      gsap.from(surface, {
        y: 18,
        duration: 0.4,
        ease: "power3.out",
        clearProps: "transform",
      })
    })
  }, dialog)

  return () => {
    media.revert()
    context.revert()
  }
}

export function useLoginMotion(root: RefObject<HTMLDivElement | null>) {
  useLayoutEffect(() => {
    const element = root.current
    if (!element) return

    const media = gsap.matchMedia()
    const context = gsap.context(() => {
      media.add("screen and (prefers-reduced-motion: no-preference)", () => {
        const timeline = gsap.timeline({
          defaults: { ease: "power3.out", clearProps: "transform,opacity" },
        })

        const shell = element.querySelector(".login-shell")
        if (shell) {
          timeline.from(shell, {
            y: 18,
            scale: 0.985,
            opacity: 0.6,
            duration: 0.55,
          })
        }

        const photo = element.querySelector(".login-campus-photo")
        if (photo) {
          timeline.from(
            photo,
            {
              scale: 1.08,
              duration: 1.15,
              ease: "power2.out",
            },
            0,
          )
        }

        const brandItems = element.querySelectorAll(".login-brand-overlay > *")
        if (brandItems.length) {
          timeline.from(
            brandItems,
            {
              y: 16,
              opacity: 0,
              duration: 0.55,
              stagger: 0.09,
            },
            0.16,
          )
        }

        const formItems = element.querySelectorAll(
          ".login-form-head, .login-field, .login-submit-btn",
        )
        if (formItems.length) {
          timeline.from(
            formItems,
            {
              y: 12,
              opacity: 0,
              duration: 0.45,
              stagger: 0.055,
            },
            0.14,
          )
        }
      })
    }, element)

    return () => {
      media.revert()
      context.revert()
    }
  }, [root])
}

export function usePortalMotion(root: RefObject<HTMLDivElement | null>) {
  useLayoutEffect(() => {
    const element = root.current
    if (!element) return

    const media = gsap.matchMedia()
    const context = gsap.context(() => {
      media.add("screen and (prefers-reduced-motion: no-preference)", () => {
        const small = window.matchMedia("(max-width: 767px)").matches

        const heroTl = gsap.timeline({
          defaults: { ease: "power2.out", clearProps: "transform,opacity" },
        })

        const heroPhoto = element.querySelector(".portal-hero-bg")
        if (heroPhoto) {
          heroTl.from(
            heroPhoto,
            {
              scale: 1.06,
              duration: 1.15,
              ease: "power2.out",
            },
            0,
          )
        }

        const heroCopy = element.querySelector(".portal-hero-copy")
        if (heroCopy) {
          heroTl.from(
            heroCopy,
            {
              y: small ? 18 : 28,
              opacity: 0,
              duration: 0.75,
            },
            0.05,
          )
        }

        const revealNodes = element.querySelectorAll<HTMLElement>(
          "[data-portal-reveal]",
        )
        revealNodes.forEach((node) => {
          const delayMs = Number(node.dataset.revealDelay ?? "0")
          const delay = Number.isFinite(delayMs) ? delayMs / 1000 : 0
          const distance =
            node.dataset.portalReveal === "card"
              ? small
                ? 28
                : 52
              : small
                ? 36
                : 72

          gsap.from(node, {
            y: distance,
            opacity: 0,
            duration: 0.95,
            delay,
            ease: "power2.inOut",
            clearProps: "transform,opacity",
            scrollTrigger: {
              trigger: node,
              start: "top 92%",
              once: true,
            },
          })
        })

        ScrollTrigger.refresh()
      })
    }, element)

    return () => {
      media.revert()
      context.revert()
    }
  }, [root])
}

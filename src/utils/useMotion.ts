import { useEffect, useLayoutEffect, type RefObject } from "react"
import Lenis from "lenis"
import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(ScrollTrigger)

let activeLenisInstance: Lenis | null = null

export function refreshScrollLayout() {
  activeLenisInstance?.resize()
  ScrollTrigger.refresh()
}

export function scrollToTarget(
  target: number | string | HTMLElement,
  options?: { immediate?: boolean; offset?: number },
) {
  if (typeof window === "undefined") return
  if (activeLenisInstance) {
    activeLenisInstance.scrollTo(target, {
      immediate: options?.immediate ?? false,
      offset: options?.offset ?? 0,
    })
    return
  }
  if (typeof target === "number") {
    window.scrollTo({
      top: target,
      behavior: options?.immediate ? "auto" : "smooth",
    })
  } else if (typeof target === "string") {
    const el = document.querySelector<HTMLElement>(target)
    el?.scrollIntoView({ behavior: options?.immediate ? "auto" : "smooth" })
  } else {
    target.scrollIntoView({ behavior: options?.immediate ? "auto" : "smooth" })
  }
}

export function useSmoothScroll(routeKey?: string) {
  useEffect(() => {
    if (typeof window === "undefined") return

    const reducedMotionQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    )
    const printQuery = window.matchMedia("print")
    if (reducedMotionQuery.matches || printQuery.matches) {
      return
    }

    const lenis = new Lenis({
      duration: 1.02,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 0.95,
      touchMultiplier: 1.15,
      autoRaf: false,
      prevent: (node: HTMLElement | null) => {
        if (!node || typeof node.closest !== "function") return false
        return Boolean(
          node.closest(
            "[data-lenis-prevent], [role='dialog'][aria-modal='true'], .official-grid-scroll, .admin-table-wrap, .detail-scroll-body, .print-canvas, .triwulan-row-modal-body, .portal-modal-dialog",
          ),
        )
      },
    })

    activeLenisInstance = lenis
    document.documentElement.classList.add("lenis", "lenis-smooth")

    const onLenisScroll = () => {
      ScrollTrigger.update()
      const maxScroll = Math.max(
        1,
        document.documentElement.scrollHeight - window.innerHeight,
      )
      const progress = Math.min(1, Math.max(0, window.scrollY / maxScroll))
      document.documentElement.style.setProperty(
        "--scroll-progress",
        progress.toFixed(4),
      )
    }

    lenis.on("scroll", onLenisScroll)

    const tick = (timeSeconds: number) => {
      lenis.raf(timeSeconds * 1000)
    }

    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0)

    const syncDialogLock = () => {
      const hasOpenDialog = Boolean(
        document.querySelector('[role="dialog"][aria-modal="true"]'),
      )
      if (hasOpenDialog) {
        lenis.stop()
      } else {
        lenis.start()
      }
    }

    const observer = new MutationObserver(syncDialogLock)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-modal", "class"],
    })
    syncDialogLock()

    const handleBeforePrint = () => {
      lenis.stop()
    }
    const handleAfterPrint = () => {
      syncDialogLock()
      lenis.resize()
      ScrollTrigger.refresh()
    }
    window.addEventListener("beforeprint", handleBeforePrint)
    window.addEventListener("afterprint", handleAfterPrint)

    return () => {
      window.removeEventListener("beforeprint", handleBeforePrint)
      window.removeEventListener("afterprint", handleAfterPrint)
      observer.disconnect()
      gsap.ticker.remove(tick)
      lenis.off("scroll", onLenisScroll)
      lenis.destroy()
      if (activeLenisInstance === lenis) {
        activeLenisInstance = null
      }
      document.documentElement.classList.remove(
        "lenis",
        "lenis-smooth",
        "lenis-stopped",
      )
      document.documentElement.style.removeProperty("--scroll-progress")
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined" || !routeKey) return
    if (activeLenisInstance) {
      activeLenisInstance.scrollTo(0, { immediate: true })
      activeLenisInstance.resize()
    } else {
      window.scrollTo({ top: 0 })
    }
    const rafId = window.requestAnimationFrame(() => {
      ScrollTrigger.refresh()
    })
    return () => window.cancelAnimationFrame(rafId)
  }, [routeKey])
}

export function usePageMotion(
  root: RefObject<HTMLDivElement | null>,
  route: string,
) {
  useLayoutEffect(() => {
    const element = root.current
    if (!element) return

    const media = gsap.matchMedia()

    const context = gsap.context(() => {
      media.add("screen and (prefers-reduced-motion: no-preference)", () => {
        const small = window.matchMedia("(max-width: 700px)").matches
        const distance = small ? 12 : 22

        const intro = gsap.timeline({
          defaults: { ease: "power3.out", clearProps: "transform,opacity" },
        })

        const heading = element.querySelector(
          ".welcome-copy, .admin-page > h1, .report-heading",
        )
        if (heading) {
          intro.from(heading, { y: distance, opacity: 0.72, duration: 0.58 })
        }

        const deadline = element.querySelector(".deadline-card")
        if (deadline) {
          intro.from(
            deadline,
            { x: small ? 0 : 18, y: small ? 10 : 0, duration: 0.62 },
            0.1,
          )
        }

        const identityBlocks = element.querySelectorAll(
          ".report-identity > .identity-block, .overdue-period-bar",
        )
        if (identityBlocks.length) {
          intro.from(
            identityBlocks,
            {
              y: 14,
              opacity: 0.78,
              duration: 0.5,
              stagger: 0.06,
            },
            0.12,
          )
        }

        const summaryItems = element.querySelectorAll(
          ".report-summary > div, .history-stats > div",
        )
        if (summaryItems.length) {
          intro.from(
            summaryItems,
            {
              y: 12,
              opacity: 0.8,
              duration: 0.45,
              stagger: 0.045,
            },
            0.16,
          )
        }

        const actions = element.querySelector(".action-grid")
        if (actions) {
          intro.from(actions, { y: 14, opacity: 0.8, duration: 0.52 }, 0.16)
        }

        const metrics = element.querySelectorAll(
          ".kpi-card, .admin-kpis > article",
        )
        if (metrics.length) {
          intro.from(
            metrics,
            { y: distance, opacity: 0.82, duration: 0.55, stagger: 0.05 },
            0.18,
          )
        }

        element
          .querySelectorAll<HTMLElement>(
            ".progress-panel, .activity-panel, .admin-charts > section, .matrix-grid-panel, .history-panel, .admin-panel",
          )
          .forEach((section) => {
            const timeline = gsap.timeline({
              scrollTrigger: {
                trigger: section,
                start: "top 91%",
                once: true,
              },
              defaults: {
                ease: "power3.out",
                clearProps: "transform,opacity",
              },
            })

            timeline.from(section, {
              y: distance,
              opacity: 0.86,
              duration: 0.6,
              immediateRender: false,
            })

            const bars = section.querySelectorAll(
              ".quarter-bar, .admin-bar-track > div",
            )
            if (bars.length) {
              timeline.from(
                bars,
                {
                  scaleY: 0.08,
                  transformOrigin: "bottom center",
                  duration: 0.78,
                  stagger: 0.045,
                  immediateRender: false,
                },
                0.1,
              )
            }

            const steps = section.querySelectorAll(".document-timeline > li")
            if (steps.length) {
              timeline.from(
                steps,
                {
                  x: small ? 8 : 14,
                  duration: 0.45,
                  stagger: 0.05,
                  immediateRender: false,
                },
                0.1,
              )
            }
          })

        const active = document.querySelector(".nav-item.active")
        if (active) {
          gsap.from(active, {
            x: small ? 0 : -5,
            duration: 0.32,
            ease: "power2.out",
            clearProps: "transform",
          })
        }

        ScrollTrigger.refresh()
      })
    }, element)

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
        duration: 0.36,
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

        const heroPhoto = element.querySelector<HTMLElement>(".portal-hero-bg")
        if (heroPhoto) {
          heroTl.from(
            heroPhoto,
            {
              scale: 1.06,
              duration: 1.1,
              ease: "power2.out",
            },
            0,
          )

          if (!small) {
            gsap.to(heroPhoto, {
              yPercent: 9,
              ease: "none",
              scrollTrigger: {
                trigger: element.querySelector(".portal-hero") ?? heroPhoto,
                start: "top top",
                end: "bottom top",
                scrub: 0.6,
              },
            })
          }
        }

        const heroCopy = element.querySelector(".portal-hero-copy")
        if (heroCopy) {
          heroTl.from(
            heroCopy,
            {
              y: small ? 18 : 28,
              opacity: 0,
              duration: 0.72,
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
                ? 24
                : 44
              : small
                ? 30
                : 58

          gsap.from(node, {
            y: distance,
            opacity: 0,
            duration: 0.85,
            delay,
            ease: "power3.out",
            clearProps: "transform,opacity",
            scrollTrigger: {
              trigger: node,
              start: "top 91%",
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

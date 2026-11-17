/*
 * Remove o selo "Criado com o Skip" injetado na página pelo script da
 * plataforma (goskip.dev/skip.js). O selo não faz parte do código deste
 * projeto: ele é adicionado dinamicamente ao DOM, por isso esta limpeza
 * observa mutações e remove o elemento sempre que ele reaparecer.
 * Também é executado no evento beforeprint, garantindo que o selo nunca
 * saia nos PDFs de propostas e pedidos.
 */

const BADGE_TEXT_PATTERN = /criado\s+com\s+(o\s+)?skip/i

function isInsideAppRoot(el: Element): boolean {
  return el.id === 'root' || (!!el.closest && !!el.closest('#root'))
}

function removeBadgeEl(el: Element) {
  el.remove()
}

function sweepOnce() {
  // 1. Links/elementos explícitos da marca Skip
  document.querySelectorAll('a[href*="goskip.dev"]').forEach((a) => {
    const text = (a.textContent || '').trim()
    if (BADGE_TEXT_PATTERN.test(text) || !isInsideAppRoot(a)) {
      removeBadgeEl(a)
    }
  })

  document
    .querySelectorAll('[data-skip-badge], [id^="skip-badge"], [class*="skip-badge"]')
    .forEach(removeBadgeEl)

  // 2. Qualquer elemento cujo texto seja exatamente o selo
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT)
  let current = walker.currentNode as Element | null
  while (current) {
    const el = current as Element
    const ownText = Array.from(el.childNodes)
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent || '')
      .join(' ')
      .trim()

    if (ownText && BADGE_TEXT_PATTERN.test(ownText)) {
      // Remove o menor contêiner que carrega o selo (o próprio elemento)
      removeBadgeEl(el)
      // Reinicia o caminhamento: a remoção invalida a posição atual
      current = walker.nextNode() as Element | null
      continue
    }
    current = walker.nextNode() as Element | null
  }
}

let scheduled = false
function scheduleSweep() {
  if (scheduled) return
  scheduled = true
  requestAnimationFrame(() => {
    scheduled = false
    try {
      sweepOnce()
    } catch {
      /* silencioso: nunca pode quebrar a renderização */
    }
  })
}

export function startSkipBadgeRemoval() {
  if (typeof window === 'undefined') return

  try {
    sweepOnce()
  } catch {
    /* silencioso */
  }

  // Observa reinjeções feitas pelo script da plataforma
  const observer = new MutationObserver(scheduleSweep)
  observer.observe(document.documentElement, { childList: true, subtree: true })

  // Garantia extra na janela de impressão (PDF)
  window.addEventListener('beforeprint', () => {
    try {
      sweepOnce()
    } catch {
      /* silencioso */
    }
  })
}

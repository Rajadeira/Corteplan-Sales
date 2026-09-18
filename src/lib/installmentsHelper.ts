import type { QuoteInstallment } from '@/types'

export interface PaymentConditionPreset {
  id: string
  label: string
  description?: string
  generate: (total: number, baseDate?: Date) => QuoteInstallment[]
}

/**
 * Arredonda para 2 casas decimais evitando problemas de float do JS
 */
export function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100
}

/**
 * Cria data no formato YYYY-MM-DD adicionando meses a partir de uma data base
 */
function addMonthsToDate(baseDate: Date, monthsToAdd: number): string {
  const d = new Date(baseDate)
  d.setMonth(d.getMonth() + monthsToAdd)
  return d.toISOString().split('T')[0]
}

/**
 * Gera parcelas iguais dividindo o total em N vezes
 * A última parcela absorve a diferença de centavos para garantir que a soma feche no total exato.
 */
export function generateEqualInstallments(
  count: number,
  total: number,
  baseDate: Date = new Date(),
  method: string = 'Boleto',
): QuoteInstallment[] {
  if (count <= 0 || total <= 0) return []

  const eachVal = round2(total / count)
  const installments: QuoteInstallment[] = []

  let accumulated = 0
  for (let i = 1; i <= count; i++) {
    const isLast = i === count
    const val = isLast ? round2(total - accumulated) : eachVal
    accumulated = round2(accumulated + val)

    installments.push({
      number: i,
      date: addMonthsToDate(baseDate, i - 1),
      method,
      value: val,
    })
  }

  return installments
}

/**
 * Gera parcelas com Entrada (percentual) + N parcelas
 * Exemplo: Entrada 50% + 2 parcelas (total 3 parcelas: entrada 50%, parc 2 e parc 3 dividem os outros 50%)
 * A última parcela absorve o arredondamento de centavos.
 */
export function generateDownPaymentWithInstallments(
  downPaymentPercent: number,
  additionalInstallmentsCount: number,
  total: number,
  baseDate: Date = new Date(),
  method: string = 'Boleto',
): QuoteInstallment[] {
  if (total <= 0) return []

  // Se additionalInstallmentsCount for 0, é à vista 100% ou parcela única
  if (additionalInstallmentsCount <= 0) {
    return [
      {
        number: 1,
        date: addMonthsToDate(baseDate, 0),
        method,
        value: round2(total),
      },
    ]
  }

  const downPaymentVal = round2((total * downPaymentPercent) / 100)
  const remainingTotal = round2(total - downPaymentVal)

  const installments: QuoteInstallment[] = [
    {
      number: 1,
      date: addMonthsToDate(baseDate, 0),
      method,
      value: downPaymentVal,
    },
  ]

  let accumulated = downPaymentVal
  const eachRemaining = round2(remainingTotal / additionalInstallmentsCount)

  for (let i = 1; i <= additionalInstallmentsCount; i++) {
    const isLast = i === additionalInstallmentsCount
    const val = isLast ? round2(total - accumulated) : eachRemaining
    accumulated = round2(accumulated + val)

    installments.push({
      number: i + 1,
      date: addMonthsToDate(baseDate, i),
      method,
      value: val,
    })
  }

  return installments
}

/**
 * Presets comuns de Condição de Pagamento do sistema Corteplan
 */
export const PAYMENT_CONDITION_PRESETS: PaymentConditionPreset[] = [
  {
    id: 'entrada_50_plus_2',
    label: 'Entrada 50% + 2 parcelas',
    description: 'Entrada 50% à vista e saldo em 2 parcelas (30 / 60 dias)',
    generate: (total, baseDate) => generateDownPaymentWithInstallments(50, 2, total, baseDate),
  },
  {
    id: 'entrada_50_plus_50_30d',
    label: 'Entrada 50% + 50% (30 dias)',
    description: 'Entrada 50% à vista e saldo de 50% em 30 dias',
    generate: (total, baseDate) => generateDownPaymentWithInstallments(50, 1, total, baseDate),
  },
  {
    id: 'entrada_30_plus_3',
    label: 'Entrada 30% + 3 parcelas',
    description: 'Entrada 30% e restante dividido em 3x',
    generate: (total, baseDate) => generateDownPaymentWithInstallments(30, 3, total, baseDate),
  },
  {
    id: 'a_vista',
    label: 'À Vista (1x integral)',
    description: '1 parcela no valor total da proposta',
    generate: (total, baseDate) => generateEqualInstallments(1, total, baseDate),
  },
  {
    id: '2x_iguais',
    label: '2x Sem Entrada (30 / 60 dias)',
    description: 'Dividido em 2 parcelas iguais',
    generate: (total, baseDate) => generateEqualInstallments(2, total, baseDate),
  },
  {
    id: '3x_iguais',
    label: '3x Sem Entrada (30 / 60 / 90 dias)',
    description: 'Dividido em 3 parcelas iguais',
    generate: (total, baseDate) => generateEqualInstallments(3, total, baseDate),
  },
  {
    id: '4x_iguais',
    label: '4x Sem Entrada',
    description: 'Dividido em 4 parcelas iguais',
    generate: (total, baseDate) => generateEqualInstallments(4, total, baseDate),
  },
]

/**
 * Tenta inferir ou aplicar automaticamente uma condição com base no texto digitado
 * Ex: "Entrada 50% + 2 parcelas", "Entrada 50% + 2x", "Entrada 40% + 3x", "3x", "4x", "À vista"
 */
export function generateInstallmentsFromTerms(
  termsText: string,
  total: number,
  baseDate: Date = new Date(),
): QuoteInstallment[] | null {
  if (total <= 0 || !termsText) return null
  const clean = termsText.trim().toLowerCase()

  // Match: Entrada XX% + Y parcelas ou Entrada XX% + Yx
  const matchDown = clean.match(/entrada\s*(\d+)%?\s*\+\s*(\d+)(?:\s*(?:x|parcelas?))?/i)
  if (matchDown) {
    const downPercent = parseInt(matchDown[1], 10)
    const addCount = parseInt(matchDown[2], 10)
    if (!isNaN(downPercent) && !isNaN(addCount)) {
      return generateDownPaymentWithInstallments(downPercent, addCount, total, baseDate)
    }
  }

  // Match: Entrada XX% + 50% ou saldo 30 dias
  const match50_50 = clean.match(/entrada\s*50%.*50%/i)
  if (match50_50) {
    return generateDownPaymentWithInstallments(50, 1, total, baseDate)
  }

  // Match: Nx (ex: 2x, 3x, 4x, 5x, 6x, 10x, 12x)
  const matchNx = clean.match(/^(\d+)\s*x$/i)
  if (matchNx) {
    const count = parseInt(matchNx[1], 10)
    if (count > 0 && count <= 36) {
      return generateEqualInstallments(count, total, baseDate)
    }
  }

  if (clean.includes('à vista') || clean.includes('a vista') || clean === '1x') {
    return generateEqualInstallments(1, total, baseDate)
  }

  return null
}

/**
 * Reajuste dinâmico das parcelas:
 * Quando o usuário edita manualmente o valor da parcela de índice `editedIndex`:
 * As parcelas posteriores (editedIndex + 1 até o final) são recalculadas automaticamente
 * para que a soma total das parcelas feche EXATAMENTE no valor da proposta.
 * A última parcela absorve os centavos restantes.
 * Se a soma das parcelas anteriores e a editada já ultrapassar o total, as seguintes viram 0.
 * Se for editada a última parcela e houver mais de uma parcela, o ajuste pode ser compensado na anterior ou mantido.
 */
export function rebalanceInstallments(
  installments: QuoteInstallment[],
  editedIndex: number,
  newVal: number,
  total: number,
): QuoteInstallment[] {
  if (!installments || installments.length === 0) return []

  const list: QuoteInstallment[] = installments.map((it, idx) => ({
    ...it,
    value: idx === editedIndex ? round2(newVal) : round2(Number(it.value) || 0),
  }))

  const count = list.length
  if (count <= 1) {
    // Parcela única: o valor é o próprio digitado
    return list
  }

  // Caso 1: editou uma parcela que NÃO é a última
  if (editedIndex < count - 1) {
    // Soma de todas as parcelas fixadas até o índice editado
    let sumFixed = 0
    for (let i = 0; i <= editedIndex; i++) {
      sumFixed = round2(sumFixed + list[i].value)
    }

    const remaining = round2(total - sumFixed)
    const subsequentCount = count - (editedIndex + 1)

    if (remaining <= 0) {
      // Valor extrapolou o total da proposta: zera as posteriores
      for (let i = editedIndex + 1; i < count; i++) {
        list[i].value = 0
      }
    } else {
      // Divide o restante igualmente entre as parcelas subsequentes
      const eachSubsequent = round2(remaining / subsequentCount)
      let sumSubsequent = 0

      for (let i = editedIndex + 1; i < count; i++) {
        const isLast = i === count - 1
        const val = isLast ? round2(remaining - sumSubsequent) : eachSubsequent
        sumSubsequent = round2(sumSubsequent + val)
        list[i].value = Math.max(0, val)
      }
    }
  } else {
    // Caso 2: editou a ÚLTIMA parcela (editedIndex === count - 1)
    // Para fechar no total da proposta, ajustamos a penúltima parcela (count - 2)
    // Mantendo todas as anteriores a ela fixas
    let sumBeforePenultimate = 0
    for (let i = 0; i < count - 2; i++) {
      sumBeforePenultimate = round2(sumBeforePenultimate + list[i].value)
    }

    const lastVal = list[count - 1].value
    const penultimateVal = round2(total - sumBeforePenultimate - lastVal)
    list[count - 2].value = Math.max(0, penultimateVal)
  }

  return list
}

import React from 'react'

interface CorteplanLogoProps {
  className?: string
  width?: number | string
  height?: number | string
  variant?: 'color' | 'monochrome'
}

/**
 * Componente do Logo CORTEPLAN
 * Wordmark estilizado em caixa alta com chanfros geométricos e moldura característica,
 * com o toque de cor âmbar/laranja ou monocromático escuro para impressão P&B.
 */
export default function CorteplanLogo({
  className = '',
  width = 180,
  height = 42,
  variant = 'color',
}: CorteplanLogoProps) {
  const isMono = variant === 'monochrome'
  const brandColor = isMono ? '#000000' : '#E66812'
  const textFill = isMono ? '#000000' : '#0F172A'

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 240 56"
      width={width}
      height={height}
      className={className}
      aria-label="Logo CORTEPLAN"
    >
      {/* Moldura exterior chanfrada/arredondada */}
      <rect
        x="4"
        y="4"
        width="232"
        height="48"
        rx="8"
        ry="8"
        fill="none"
        stroke={brandColor}
        strokeWidth="3.5"
      />

      {/* Símbolo geométrico de corte/fresa no canto esquerdo da moldura */}
      <polygon points="4,12 18,4 4,4" fill={brandColor} />
      <polygon points="236,44 222,52 236,52" fill={brandColor} />

      {/* Texto CORTEPLAN com tipografia forte, condensada e itálica/dinâmica */}
      <text
        x="120"
        y="37"
        textAnchor="middle"
        fontFamily="ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
        fontSize="28"
        fontWeight="900"
        fontStyle="italic"
        letterSpacing="2.5"
        fill={textFill}
      >
        CORTEPLAN
      </text>

      {/* Linha discreta de precisão sob o nome */}
      <line
        x1="22"
        y1="44"
        x2="218"
        y2="44"
        stroke={brandColor}
        strokeWidth="1.5"
        strokeDasharray="4 2"
        opacity={isMono ? 0.4 : 0.8}
      />
    </svg>
  )
}

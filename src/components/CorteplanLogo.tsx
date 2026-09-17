import React from 'react'
import corteplanLogoImg from '@/assets/logo-novo-corteplan-f44ab.png'

interface CorteplanLogoProps {
  className?: string
  width?: number | string
  height?: number | string
  variant?: 'color' | 'monochrome'
}

/**
 * Componente oficial do Logo CORTEPLAN
 * Utiliza o asset da marca oficial: moldura/parênteses em laranja (#F08A24)
 * e o texto "CORTEPLAN" em caixa alta, itálico, extra-bold grafite (#3A3A3C).
 * Suporta variante monocromática para impressão em preto e branco.
 */
export default function CorteplanLogo({
  className = '',
  width = 180,
  height = 'auto',
  variant = 'color',
}: CorteplanLogoProps) {
  const isMono = variant === 'monochrome'

  return (
    <img
      src={corteplanLogoImg}
      alt="CORTEPLAN"
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        maxWidth: '100%',
        objectFit: 'contain',
        filter: isMono ? 'grayscale(100%) contrast(120%)' : undefined,
      }}
      className={`inline-block select-none ${className}`}
    />
  )
}

/**
 * Redimensiona e comprime uma imagem (File) no navegador usando HTMLCanvasElement.
 * Gera uma string data URL base64 otimizada (JPEG com qualidade ~0.8)
 * limitada a maxDimension (padrão 480px), ideal para miniaturas na proposta impressa
 * sem sobrecarregar o JSON nem a memória.
 */
export async function compressProductImage(
  file: File,
  maxDimension = 480,
  quality = 0.82,
): Promise<string> {
  return new Promise((resolve, reject) => {
    // Validação de tipo
    if (!file.type.startsWith('image/')) {
      reject(new Error('O arquivo selecionado não é uma imagem válida.'))
      return
    }

    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Erro ao ler arquivo de imagem.'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Erro ao carregar a imagem selecionada.'))
      img.onload = () => {
        let width = img.naturalWidth || img.width
        let height = img.naturalHeight || img.height

        // Redimensionar mantendo proporção
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width)
            width = maxDimension
          } else {
            width = Math.round((width * maxDimension) / height)
            height = maxDimension
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, width)
        canvas.height = Math.max(1, height)

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Não foi possível obter contexto 2D para renderização.'))
          return
        }

        // Fundo branco no canvas para evitar transparência preta em conversão para JPEG
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

        // Exporta como JPEG leve
        const dataUrl = canvas.toDataURL('image/jpeg', quality)
        resolve(dataUrl)
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}

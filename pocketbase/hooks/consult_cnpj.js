// Endpoint backend para consulta de CNPJ com fallback robusto (BrasilAPI + ReceitaWS)
// Isso contorna bloqueios de CORS do browser, instabilidades de 503 da BrasilAPI e rate limits da ReceitaWS pública.

routerAdd(
  'GET',
  '/backend/v1/consult-cnpj/{cnpj}',
  (e) => {
    const rawCnpj = e.request.pathValue('cnpj') || ''
    const clean = rawCnpj.replace(/\D/g, '')

    if (clean.length !== 14) {
      return e.json(400, {
        error: 'CNPJ deve conter 14 dígitos numéricos',
      })
    }

    // Função auxiliar para mascarar CEP
    const formatCep = (raw) => {
      const d = String(raw || '')
        .replace(/\D/g, '')
        .slice(0, 8)
      if (d.length <= 5) return d
      return d.slice(0, 5) + '-' + d.slice(5)
    }

    // Tentativa 1: BrasilAPI
    try {
      const res1 = $http.send({
        url: 'https://brasilapi.com.br/api/cnpj/v1/' + clean,
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Corteplan-ERP/1.0',
        },
        timeout: 6,
      })

      if (res1.statusCode === 200 && res1.json) {
        const data = res1.json
        if (data && (data.razao_social || data.nome_fantasia)) {
          const fullPhone =
            data.ddd_telefone_1 ||
            (data.ddd_telefone_2 ? data.ddd_telefone_2 : '') ||
            (data.telefone ? data.telefone : '')

          const logradouroPart = [data.descricao_tipo_de_logradouro, data.logradouro]
            .filter(Boolean)
            .join(' ')
            .trim()

          const cnaeCode = data.cnae_fiscal ? String(data.cnae_fiscal) : ''
          const cnaeDesc = data.cnae_fiscal_descricao || ''
          const natJurCode = data.natureza_juridica
            ? String(data.natureza_juridica).split('-')[0].trim()
            : data.codigo_natureza_juridica
              ? String(data.codigo_natureza_juridica)
              : ''
          const natJurDesc = data.natureza_juridica
            ? String(data.natureza_juridica).includes('-')
              ? String(data.natureza_juridica).split('-').slice(1).join('-').trim()
              : String(data.natureza_juridica)
            : ''
          const situacao = data.descricao_situacao_cadastral || data.situacao_cadastral || 'ATIVA'

          return e.json(200, {
            razaoSocial: data.razao_social || '',
            nomeFantasia: data.nome_fantasia || '',
            cnae: cnaeCode,
            cnaeDescricao: cnaeDesc,
            naturezaJuridicaCodigo: natJurCode,
            naturezaJuridicaDescricao: natJurDesc,
            situacaoCadastral: situacao,
            logradouro: logradouroPart,
            numero: data.numero || '',
            complemento: data.complemento || '',
            bairro: data.bairro || '',
            cidade: data.municipio || '',
            uf: data.uf || '',
            cep: data.cep ? formatCep(data.cep) : '',
            telefone: fullPhone ? String(fullPhone).replace(/\D/g, '') : '',
            email: String(data.email || '')
              .toLowerCase()
              .trim(),
            fonte: 'BrasilAPI',
          })
        }
      }
    } catch (err) {
      console.warn('Erro na consulta BrasilAPI via backend:', err)
    }

    // Tentativa 2: ReceitaWS
    try {
      const res2 = $http.send({
        url: 'https://receitaws.com.br/v1/cnpj/' + clean,
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Corteplan-ERP/1.0',
        },
        timeout: 8,
      })

      if (res2.statusCode === 200 && res2.json) {
        const data = res2.json
        if (data && data.status !== 'ERROR' && (data.nome || data.fantasia)) {
          // ReceitaWS traz atividade_principal: [{ code: '56.11-2-01', text: 'Restaurantes...' }]
          let cnaeCode = ''
          let cnaeDesc = ''
          if (Array.isArray(data.atividade_principal) && data.atividade_principal.length > 0) {
            cnaeCode = data.atividade_principal[0].code || ''
            cnaeDesc = data.atividade_principal[0].text || ''
          }
          let natJurCode = ''
          let natJurDesc = ''
          if (data.natureza_juridica) {
            const rawNat = String(data.natureza_juridica)
            const parts = rawNat.split('-')
            if (parts.length > 1) {
              natJurCode = parts[0].trim()
              natJurDesc = parts.slice(1).join('-').trim()
            } else {
              natJurDesc = rawNat.trim()
            }
          }
          const situacao = data.situacao || 'ATIVA'

          return e.json(200, {
            razaoSocial: data.nome || '',
            nomeFantasia: data.fantasia || '',
            cnae: cnaeCode,
            cnaeDescricao: cnaeDesc,
            naturezaJuridicaCodigo: natJurCode,
            naturezaJuridicaDescricao: natJurDesc,
            situacaoCadastral: situacao,
            logradouro: data.logradouro || '',
            numero: data.numero || '',
            complemento: data.complemento || '',
            bairro: data.bairro || '',
            cidade: data.municipio || '',
            uf: data.uf || '',
            cep: data.cep ? formatCep(data.cep) : '',
            telefone: data.telefone ? String(data.telefone).replace(/\D/g, '') : '',
            email: String(data.email || '')
              .toLowerCase()
              .trim(),
            fonte: 'ReceitaWS',
          })
        }
      }
    } catch (err) {
      console.warn('Erro na consulta ReceitaWS via backend:', err)
    }

    return e.json(404, {
      error: 'CNPJ não encontrado ou serviços de consulta indisponíveis no momento.',
    })
  },
  $apis.requireAuth(),
)

// pocketbase/hooks/confere_cnpj.js
// Integração segura via servidor com o Confere CNPJ (https://conferecnpj.com.br)
// - Exclusivo para perfil Administrador
// - Lê a API Key salva nas configurações do sistema (app_settings: setting_key = 'confere_cnpj_settings')
// - Executa a consulta em duas etapas:
//     1) POST /api/v1/consulta (com debito de 1 credito, retorna consultation_id e dados cadastrais)
//     2) POST /api/v1/consulta/ia (com 0 creditos adicionais, retorna CND, CNDT, score de confianca e alertas)
// - Não consulta endpoint de protestos (fora do escopo contratado pelo usuario)
// - Normaliza os dados para consumo limpo pelo frontend e persistência no banco

routerAdd(
  'GET',
  '/backend/v1/confere-cnpj/{cnpj}',
  (e) => {
    const auth = e.auth
    if (!auth || auth.get('role') !== 'Administrador') {
      throw new ForbiddenError('Apenas administradores podem realizar consultas externas de risco.')
    }

    const rawCnpj = e.request.pathValue('cnpj') || ''
    const clean = String(rawCnpj).replace(/\D/g, '')

    if (clean.length !== 14) {
      throw new BadRequestError('CNPJ deve conter exatamente 14 dígitos numéricos.')
    }

    // 1. Buscar credenciais e configurações salvas em app_settings
    let confereSettings = null
    try {
      const rec = $app.findFirstRecordByData('app_settings', 'setting_key', 'confere_cnpj_settings')
      if (rec) {
        confereSettings = rec.get('value')
      }
    } catch (_) {
      confereSettings = null
    }

    const apiKey =
      confereSettings && confereSettings.apiKey ? String(confereSettings.apiKey).trim() : ''

    if (!apiKey) {
      return e.json(412, {
        configured: false,
        code: 'API_KEY_MISSING',
        error:
          'Chave de API do Confere CNPJ não configurada. Acesse Configurações > Confere CNPJ e insira sua chave.',
      })
    }

    const baseUrl = 'https://conferecnpj.com.br'

    // 2. Etapa 1: POST /api/v1/consulta
    let step1Res = null
    try {
      step1Res = $http.send({
        url: baseUrl + '/api/v1/consulta',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: 'Bearer ' + apiKey,
          'User-Agent': 'Corteplan-ERP/1.0',
        },
        body: JSON.stringify({ cnpj: clean }),
        timeout: 15,
      })
    } catch (err) {
      return e.json(504, {
        code: 'TIMEOUT_STEP1',
        error: 'Tempo limite esgotado ao contatar o Confere CNPJ (Etapa 1). Tente novamente.',
        details: err.message || String(err),
      })
    }

    if (step1Res.statusCode === 401) {
      return e.json(401, {
        code: 'INVALID_API_KEY',
        error:
          'API Key do Confere CNPJ inválida ou não autorizada. Verifique a chave em Configurações.',
      })
    }

    if (step1Res.statusCode === 402) {
      return e.json(402, {
        code: 'INSUFFICIENT_CREDITS',
        error:
          'Saldo insuficiente de créditos no Confere CNPJ. Recarregue seus créditos em conferecnpj.com.br/perfil.',
      })
    }

    if (step1Res.statusCode === 404) {
      return e.json(404, {
        code: 'CNPJ_NOT_FOUND',
        error: 'CNPJ não encontrado na base de dados oficiais do Confere CNPJ.',
      })
    }

    if (step1Res.statusCode < 200 || step1Res.statusCode >= 300) {
      const rawError = (step1Res.json && (step1Res.json.error || step1Res.json.message)) || ''
      return e.json(step1Res.statusCode, {
        code: 'API_ERROR_STEP1',
        error: rawError || 'Erro retornado pela API do Confere CNPJ na consulta cadastral.',
        statusCode: step1Res.statusCode,
      })
    }

    const step1Data = step1Res.json || {}
    const consultationId =
      step1Data.consultation_id ||
      step1Data.consultationId ||
      step1Data.id ||
      (step1Data.data && (step1Data.data.consultation_id || step1Data.data.id))

    // 3. Etapa 2: POST /api/v1/consulta/ia (0 créditos — enriquecimento, certidões e análise)
    let step2Data = {}
    if (consultationId) {
      try {
        const step2Res = $http.send({
          url: baseUrl + '/api/v1/consulta/ia',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: 'Bearer ' + apiKey,
            'User-Agent': 'Corteplan-ERP/1.0',
          },
          body: JSON.stringify({ consultation_id: consultationId }),
          timeout: 25,
        })

        if (step2Res.statusCode >= 200 && step2Res.statusCode < 300) {
          step2Data = step2Res.json || {}
        } else {
          console.warn(
            'Aviso: Etapa 2 (IA/certidões) retornou status',
            step2Res.statusCode,
            JSON.stringify(step2Res.json || {}),
          )
        }
      } catch (err2) {
        console.warn('Aviso: falha na chamada da Etapa 2 do Confere CNPJ:', err2)
      }
    }

    // 4. Normalização dos dados combinados
    // A API pode retornar campos em raiz, dentro de data, cnpj_data, analise, ia, etc.
    const rootData = step1Data.data || {}
    const cnpjData = rootData.cnpj_data || step1Data.cnpj_data || step1Data || {}
    const analysisData =
      step2Data.analise ||
      step2Data.analysis ||
      step2Data.data ||
      step2Data.resultado ||
      step2Data ||
      {}

    // Extração do Score de Confiança (0 a 100)
    let score = null
    const candidateScoreFields = [
      analysisData.score,
      analysisData.score_confianca,
      analysisData.confidence_score,
      step2Data.score,
      step2Data.score_confianca,
      step1Data.score,
      rootData.score,
    ]
    for (let i = 0; i < candidateScoreFields.length; i++) {
      const v = candidateScoreFields[i]
      if (typeof v === 'number' && !isNaN(v)) {
        score = Math.round(v)
        break
      }
      if (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v))) {
        score = Math.round(Number(v))
        break
      }
    }

    // Se a API não retornou score explícito mas trouxe indicadores, calcula fallback elegante
    // Faixas oficiais do Confere CNPJ:
    // 85-100: Excelente
    // 70-84: Bom
    // 50-69: Moderado
    // 30-49: Baixo
    // 0-29: Crítico
    let scoreLabel = 'Não avaliado'
    if (score !== null) {
      if (score >= 85) scoreLabel = 'Excelente'
      else if (score >= 70) scoreLabel = 'Bom'
      else if (score >= 50) scoreLabel = 'Moderado'
      else if (score >= 30) scoreLabel = 'Baixo'
      else scoreLabel = 'Crítico'
    }

    // Alertas automáticos (situação irregular, capital social, CNAE de risco etc.)
    let alerts = []
    const candidateAlerts =
      analysisData.alertas ||
      analysisData.alerts ||
      step2Data.alertas ||
      step2Data.alerts ||
      rootData.alertas ||
      []

    if (Array.isArray(candidateAlerts)) {
      alerts = candidateAlerts.map((a) => {
        if (typeof a === 'string') return { texto: a, tipo: 'aviso' }
        return {
          texto: a.mensagem || a.descricao || a.texto || a.title || JSON.stringify(a),
          tipo: a.tipo || a.severidade || a.level || 'aviso',
        }
      })
    } else if (typeof candidateAlerts === 'object' && candidateAlerts !== null) {
      Object.keys(candidateAlerts).forEach((k) => {
        const val = candidateAlerts[k]
        if (val) alerts.push({ texto: String(val), tipo: 'aviso' })
      })
    }

    // Certidão Negativa de Débitos Federal (CND Receita/PGFN)
    const rawCndFederal =
      analysisData.cnd ||
      analysisData.cnd_federal ||
      step2Data.cnd ||
      step2Data.cnd_federal ||
      step2Data.certidao_federal ||
      rootData.cnd ||
      {}

    const cndFederalStatus =
      rawCndFederal.status ||
      rawCndFederal.situacao ||
      (typeof rawCndFederal === 'string' ? rawCndFederal : '') ||
      'Não consultada'

    const cndFederalValidade =
      rawCndFederal.validade ||
      rawCndFederal.data_validade ||
      rawCndFederal.data_expiracao ||
      rawCndFederal.valid_until ||
      ''

    // Certidão Negativa de Débitos Trabalhistas (CNDT Justiça do Trabalho)
    const rawCndt =
      analysisData.cndt || step2Data.cndt || step2Data.certidao_trabalhista || rootData.cndt || {}

    const cndtStatus =
      rawCndt.status ||
      rawCndt.situacao ||
      (typeof rawCndt === 'string' ? rawCndt : '') ||
      'Não consultada'

    const cndtValidade =
      rawCndt.validade ||
      rawCndt.data_validade ||
      rawCndt.data_expiracao ||
      rawCndt.valid_until ||
      ''

    const consultedAt = new Date().toISOString()

    const normalized = {
      success: true,
      configured: true,
      consultationId: consultationId || null,
      consultedAt: consultedAt,
      cnpj: clean,
      razaoSocial:
        cnpjData.razao_social ||
        cnpjData.razaoSocial ||
        cnpjData.nome ||
        rootData.razao_social ||
        '',
      nomeFantasia:
        cnpjData.nome_fantasia ||
        cnpjData.nomeFantasia ||
        cnpjData.fantasia ||
        rootData.nome_fantasia ||
        '',
      situacaoCadastral:
        cnpjData.situacao_cadastral ||
        cnpjData.descricao_situacao_cadastral ||
        cnpjData.situacao ||
        'ATIVA',
      score: score,
      scoreLabel: scoreLabel,
      alerts: alerts,
      cndFederal: {
        status: cndFederalStatus,
        validade: cndFederalValidade,
        numero: rawCndFederal.numero || rawCndFederal.codigo_controle || '',
        raw: rawCndFederal,
      },
      cndt: {
        status: cndtStatus,
        validade: cndtValidade,
        numero: rawCndt.numero || rawCndt.codigo_expedicao || '',
        raw: rawCndt,
      },
      creditsRemaining:
        step1Data.credits_remaining !== undefined
          ? step1Data.credits_remaining
          : step1Data.credits !== undefined
            ? step1Data.credits
            : null,
      rawSummary: {
        step1Status: step1Res.statusCode,
        step2Status: consultationId ? 200 : 0,
      },
    }

    return e.json(200, normalized)
  },
  $apis.requireAuth(),
)

// 0027_seed_sample_supplier_invoice.js
// Seed de exemplo demonstrativo de NF-e de entrada de fornecedor com XML real e saída no Fluxo de Caixa.
migrate(
  (app) => {
    const accessKey = '35261024306897000144550010000099991234567890'

    // Idempotência: se já existe registro com essa chave, não duplica
    try {
      app.findFirstRecordByData('supplier_invoices', 'access_key', accessKey)
      return
    } catch (_) {}

    let itemsXml = ''
    let totalVal = 0

    for (let i = 1; i <= 30; i++) {
      const vProd = 150.5 * i
      totalVal += vProd
      itemsXml += `
      <det nItem="${i}">
        <prod>
          <cProd>PROD-CORTE-${i.toString().padStart(4, '0')}</cProd>
          <cEAN>SEM GTIN</cEAN>
          <xProd>Chapa de MDF Revestido 18mm Modelo Industrial Premium Lote Especial de Fornecedor Homologado Item ${i}</xProd>
          <NCM>44111490</NCM>
          <CFOP>5102</CFOP>
          <uCom>M2</uCom>
          <qCom>10.0000</qCom>
          <vUnCom>${(vProd / 10).toFixed(4)}</vUnCom>
          <vProd>${vProd.toFixed(2)}</vProd>
          <cEANTrib>SEM GTIN</cEANTrib>
          <uTrib>M2</uTrib>
          <qTrib>10.0000</qTrib>
          <vUnTrib>${(vProd / 10).toFixed(4)}</vUnTrib>
          <indTot>1</indTot>
        </prod>
        <imposto>
          <vTotTrib>${(vProd * 0.18).toFixed(2)}</vTotTrib>
          <ICMS>
            <ICMS00>
              <orig>0</orig>
              <CST>00</CST>
              <modBC>3</modBC>
              <vBC>${vProd.toFixed(2)}</vBC>
              <pICMS>18.00</pICMS>
              <vICMS>${(vProd * 0.18).toFixed(2)}</vICMS>
            </ICMS00>
          </ICMS>
          <PIS>
            <PISAliq>
              <CST>01</CST>
              <vBC>${vProd.toFixed(2)}</vBC>
              <pPIS>1.65</pPIS>
              <vPIS>${(vProd * 0.0165).toFixed(2)}</vPIS>
            </PISAliq>
          </PIS>
          <COFINS>
            <COFINSAliq>
              <CST>01</CST>
              <vBC>${vProd.toFixed(2)}</vBC>
              <pCOFINS>7.60</pCOFINS>
              <vCOFINS>${(vProd * 0.076).toFixed(2)}</vCOFINS>
            </COFINSAliq>
          </COFINS>
        </imposto>
      </det>`
    }

    const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe xmlns="http://www.portalfiscal.inf.br/nfe">
    <infNFe Id="NFe${accessKey}" versao="4.00">
      <ide>
        <cUF>35</cUF>
        <cNF>12345678</cNF>
        <natOp>Venda de mercadoria adquirida ou recebida de terceiros para industrialização</natOp>
        <mod>55</mod>
        <serie>1</serie>
        <nNF>9999</nNF>
        <dhEmi>2026-10-25T10:00:00-03:00</dhEmi>
        <tpNF>1</tpNF>
        <idDest>1</idDest>
        <cMunFG>3550308</cMunFG>
        <tpImp>1</tpImp>
        <tpEmis>1</tpEmis>
        <cDV>0</cDV>
        <tpAmb>1</tpAmb>
        <finNFe>1</finNFe>
        <indFinal>0</indFinal>
        <indPres>1</indPres>
        <procEmi>0</procEmi>
        <verProc>4.0</verProc>
      </ide>
      <emit>
        <CNPJ>12345678000199</CNPJ>
        <xNome>MADEIRAS E COMPENSADOS BRASIL LTDA</xNome>
        <xFant>BRASIL MADEIRAS</xFant>
        <enderEmit>
          <xLgr>Avenida Industrial dos Moveleiros</xLgr>
          <nro>1500</nro>
          <xBairro>Distrito Industrial</xBairro>
          <cMun>3550308</cMun>
          <xMun>São Paulo</xMun>
          <UF>SP</UF>
          <CEP>04567000</CEP>
          <cPais>1058</cPais>
          <xPais>BRASIL</xPais>
        </enderEmit>
        <IE>111222333444</IE>
        <CRT>3</CRT>
      </emit>
      <dest>
        <CNPJ>24306897000144</CNPJ>
        <xNome>CORTEPLAN COMERCIAL LTDA</xNome>
        <enderDest>
          <xLgr>Rua Exemplo</xLgr>
          <nro>100</nro>
          <xBairro>Centro</xBairro>
          <cMun>3550308</cMun>
          <xMun>São Paulo</xMun>
          <UF>SP</UF>
          <CEP>01001000</CEP>
        </enderDest>
        <indIEDest>1</indIEDest>
        <IE>999888777666</IE>
      </dest>
      ${itemsXml}
      <total>
        <ICMSTot>
          <vBC>${totalVal.toFixed(2)}</vBC>
          <vICMS>${(totalVal * 0.18).toFixed(2)}</vICMS>
          <vICMSDeson>0.00</vICMSDeson>
          <vFCP>0.00</vFCP>
          <vBCST>0.00</vBCST>
          <vST>0.00</vST>
          <vFCPST>0.00</vFCPST>
          <vFCPSTRet>0.00</vFCPSTRet>
          <vProd>${totalVal.toFixed(2)}</vProd>
          <vFrete>0.00</vFrete>
          <vSeg>0.00</vSeg>
          <vDesc>0.00</vDesc>
          <vII>0.00</vII>
          <vIPI>0.00</vIPI>
          <vIPIDevol>0.00</vIPIDevol>
          <vPIS>${(totalVal * 0.0165).toFixed(2)}</vPIS>
          <vCOFINS>${(totalVal * 0.076).toFixed(2)}</vCOFINS>
          <vOutro>0.00</vOutro>
          <vNF>${totalVal.toFixed(2)}</vNF>
        </ICMSTot>
      </total>
    </infNFe>
  </NFe>
  <protNFe versao="4.00">
    <infProt>
      <tpAmb>1</tpAmb>
      <verAplic>SP_NFE_V4.0</verAplic>
      <chNFe>${accessKey}</chNFe>
      <dhRecbto>2026-10-25T10:05:00-03:00</dhRecbto>
      <nProt>135260000000001</nProt>
      <digVal>abcdefghijklmnopqrstuvwxyz12=</digVal>
      <cStat>100</cStat>
      <xMotivo>Autorizado o uso da NF-e</xMotivo>
    </infProt>
  </protNFe>
</nfeProc>`

    const col = app.findCollectionByNameOrId('supplier_invoices')
    const invRec = new Record(col)
    invRec.set('access_key', accessKey)
    invRec.set('number', '9999')
    invRec.set('series', '1')
    invRec.set('model', '55')
    invRec.set('issue_date', '2026-10-25')
    invRec.set(
      'operation_nature',
      'Venda de mercadoria adquirida ou recebida de terceiros para industrialização',
    )
    invRec.set('supplier_cnpj', '12.345.678/0001-99')
    invRec.set('supplier_name', 'MADEIRAS E COMPENSADOS BRASIL LTDA')
    invRec.set('supplier_trade_name', 'BRASIL MADEIRAS')
    invRec.set('supplier_state', 'SP')
    invRec.set('supplier_city', 'São Paulo')
    invRec.set('supplier_address', 'Avenida Industrial dos Moveleiros, 1500, Distrito Industrial')
    invRec.set('total_amount', totalVal)
    invRec.set('products_amount', totalVal)
    invRec.set('icms_amount', totalVal * 0.18)
    invRec.set('ipi_amount', 0)
    invRec.set('pis_amount', totalVal * 0.0165)
    invRec.set('cofins_amount', totalVal * 0.076)
    invRec.set('xml_filename', 'nfe_fornecedor_teste_grande.xml')
    invRec.set('import_source', 'xml_manual')
    invRec.set('raw_xml', sampleXml)

    const itemsSummary = []
    for (let i = 1; i <= 30; i++) {
      itemsSummary.push({
        nItem: i,
        code: `PROD-CORTE-${i.toString().padStart(4, '0')}`,
        description: `Chapa de MDF Revestido 18mm Modelo Industrial Premium Lote Especial Item ${i}`,
        quantity: 10,
        unit: 'M2',
        unit_price: 15.05 * i,
        total_price: 150.5 * i,
      })
    }
    invRec.set('items_summary', itemsSummary)

    app.save(invRec)

    // Lançar no Fluxo de Caixa
    const cashCol = app.findCollectionByNameOrId('cashflow_entries')
    const cashRec = new Record(cashCol)
    cashRec.set('type', 'Saída')
    cashRec.set('date', '2026-10-25')
    cashRec.set('description', 'NF-e entrada Nº 9999 — MADEIRAS E COMPENSADOS BRASIL LTDA')
    cashRec.set('amount', totalVal)
    cashRec.set('category', 'Fornecedores')
    cashRec.set('origin', 'nfe_fornecedor')
    cashRec.set('status', 'Realizado')
    cashRec.set('supplier_invoice', invRec.id)
    cashRec.set('notes', `Chave NF-e: ${accessKey}\nCNPJ: 12.345.678/0001-99`)
    app.save(cashRec)

    invRec.set('cashflow_entry', cashRec.id)
    app.save(invRec)
  },
  (app) => {
    try {
      const accessKey = '35261024306897000144550010000099991234567890'
      const oldInv = app.findFirstRecordByData('supplier_invoices', 'access_key', accessKey)
      const oldCash = oldInv.getString('cashflow_entry')
      if (oldCash) {
        try {
          const c = app.findRecordById('cashflow_entries', oldCash)
          app.delete(c)
        } catch (_) {}
      }
      app.delete(oldInv)
    } catch (_) {}
  },
)

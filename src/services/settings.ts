import pb from '@/lib/pocketbase/client'
import type { AppSettingRecord, CompanySettings, TaxSettings } from '@/types'

export const settingsService = {
  async getAll(): Promise<AppSettingRecord[]> {
    return pb.collection('app_settings').getFullList<AppSettingRecord>()
  },

  async getByKey<T = any>(key: string): Promise<T | null> {
    try {
      const record = await pb
        .collection('app_settings')
        .getFirstListItem<AppSettingRecord>(`setting_key = "${key}"`)
      return record.value as T
    } catch {
      return null
    }
  },

  async setByKey(key: string, value: any, description?: string): Promise<AppSettingRecord> {
    try {
      const existing = await pb
        .collection('app_settings')
        .getFirstListItem<AppSettingRecord>(`setting_key = "${key}"`)
      return await pb.collection('app_settings').update<AppSettingRecord>(existing.id, {
        value,
        ...(description ? { description } : {}),
      })
    } catch {
      return await pb.collection('app_settings').create<AppSettingRecord>({
        setting_key: key,
        value,
        description: description || '',
      })
    }
  },

  async getCompanySettings(): Promise<CompanySettings | null> {
    return this.getByKey('company_info') as Promise<CompanySettings | null>
  },

  async saveCompanySettings(data: CompanySettings): Promise<AppSettingRecord> {
    return this.setByKey('company_info', data, 'Dados cadastrais da Corteplan')
  },

  async getTaxSettings(): Promise<TaxSettings | null> {
    return this.getByKey('default_taxes') as Promise<TaxSettings | null>
  },

  async saveTaxSettings(data: TaxSettings): Promise<AppSettingRecord> {
    return this.setByKey('default_taxes', data, 'Impostos padrão e condições comerciais')
  },
}

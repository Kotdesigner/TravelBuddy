// Vor-Abfahrt-Checkliste (vorbefüllt für Deutschland → Australien) + Dokumenttypen.
import { t } from './i18n.js'

export const VORBEREITUNG = [
  {
    gruppe: t('Wochen vorher'), items: [
      { id: 'flug', text: t('✈️ Flüge gebucht') },
      { id: 'eta', text: t('🛂 eTA / Visum für Australien beantragt') },
      { id: 'versicherung', text: t('🏥 Auslandskrankenversicherung abgeschlossen') },
      { id: 'impfung', text: t('💉 Impfungen geprüft / aufgefrischt') },
      { id: 'pass', text: t('🪪 Reisepass gültig (> 6 Monate über Reiseende)') },
      { id: 'fuehrerschein', text: t('🚗 Internationaler Führerschein besorgt') },
      { id: 'kreditkarte', text: t('💳 Kreditkarte ohne Auslandsgebühr') },
      { id: 'sim', text: t('📱 SIM / Roaming für Australien geklärt') },
      { id: 'bank', text: t('🏦 Bank über Auslandsreise informiert') },
      { id: 'miete', text: t('🚐 Camper / Mietwagen gebucht') },
    ],
  },
  {
    gruppe: t('Kurz vorher'), items: [
      { id: 'packen', text: t('🎒 Packen (siehe Packliste)') },
      { id: 'apotheke', text: t('💊 Reiseapotheke zusammenstellen') },
      { id: 'adapter', text: t('🔌 Reiseadapter (Australien Typ I)') },
      { id: 'backup', text: t('💾 App-Backup exportiert') },
      { id: 'dokukopie', text: t('📄 Dokumente digital + Papierkopien') },
      { id: 'offlinekarten', text: t('📲 Offline-Karten & Regionen geladen') },
      { id: 'geld', text: t('💵 Etwas Bargeld (AUD) besorgt') },
      { id: 'zuhause', text: t('🏠 Zuhause geregelt (Post, Pflanzen, Schlüssel)') },
    ],
  },
  {
    gruppe: t('Abreisetag'), items: [
      { id: 'handgepaeck', text: t('🛂 Pass, Tickets, Geldbeutel griffbereit') },
      { id: 'powerbank', text: t('🔋 Powerbank & Kabel geladen') },
      { id: 'transfer', text: t('🚕 Transfer zum Flughafen') },
    ],
  },
]

export const DOKUMENT_TYPEN = [
  'Reisepass', 'eTA / Visum', 'Auslandskrankenversicherung', 'Int. Führerschein',
  'Impfpass', 'Kreditkarte', 'Flugticket', 'Camper / Mietwagen',
]

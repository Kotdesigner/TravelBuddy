// Einmal je Gerät beim ersten Besuch von „Orte“: woher die Bilder kommen und wie man bessere hinzufügt.
import { je } from './i18n.js'
import { frage } from './dialog.js'

const KEY = 'tb-orte-hinweis'

export function zeigeOrteHinweis() {
  try {
    if (localStorage.getItem(KEY)) return
    localStorage.setItem(KEY, '1')
  } catch { return }
  frage({
    titel: je('Kurz von mir, deinem TravelBuddy 🦘', 'A quick word from me, your TravelBuddy 🦘'),
    text: je('Zu den meisten Orten habe ich frei lizenzierte Fotos gefunden. Einige treffen den Ort nicht ganz, und für ein paar Orte gab es gar keins, dort zeige ich ein Symbolbild der Region. Du hast etwas Schöneres? Tippe auf „Besseres Bild“ oder „Bild ändern“. Dort öffnest du die Google-Bildersuche und fügst einen Screenshot hinzu oder lädst dein eigenes Foto hoch. Es bleibt nur bei dir auf dem Gerät.',
      'For most places I found freely licensed photos. Some do not quite match, and for a few places there was none at all, so I show a sample picture of the region. Got something nicer? Tap “Better picture” or “Change picture”. There you can open Google image search and add a screenshot, or upload your own photo. It stays on your device only.'),
    ja: je('Alles klar', 'Got it'), nein: '',
  })
}

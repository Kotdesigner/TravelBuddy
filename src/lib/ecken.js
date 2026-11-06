// Rundung der Bildschirmecken, damit der Lichtrand (NetzRahmen) genau am Gerät anliegt.
// Das iPhone verrät seine Eckrundung nicht. Die Bildschirmgröße in Punkten verrät aber das Modell.
// Werte in CSS-Pixeln (= Punkte), gerundet nach Apples Gerätemaßen.

const IPHONE = [
  // [schmale Seite, lange Seite, Rundung]
  [320, 568, 0], [375, 667, 0], [414, 736, 0],          // SE, 8, 8 Plus: eckig
  [375, 812, 39], [414, 896, 41], [360, 780, 44],       // X, XS, 11 Pro · XR, 11, Max · 12/13 mini
  [390, 844, 47], [428, 926, 53],                       // 12 bis 14, 12 bis 14 Pro Max/Plus
  [393, 852, 55], [430, 932, 55],                       // 14 Pro bis 16, Plus, Pro Max
  [402, 874, 62], [440, 956, 62], [420, 912, 62],       // 16 Pro, 17, 17 Pro, Pro Max, Air
]

/**
 * Eckrundung für den Lichtrand.
 * @param {{breite:number, hoehe:number, ios:boolean, ipad:boolean}} g  Bildschirm in CSS-Pixeln
 * @returns {number} Radius in px; 0 = eckig
 */
export function bildschirmEcke({ breite = 0, hoehe = 0, ios = false, ipad = false } = {}) {
  const a = Math.min(breite, hoehe), b = Math.max(breite, hoehe)
  if (!a || !b) return 0
  if (ipad) return b >= 1133 ? 18 : 0      // neuere iPads mit runden Ecken, ältere mit Home-Taste eckig
  if (ios) {
    const treffer = IPHONE.find(([x, y]) => Math.abs(x - a) <= 2 && Math.abs(y - b) <= 2)
    if (treffer) return treffer[2]
    return b / a > 2 ? 55 : 0               // unbekanntes neues iPhone: schmal und hoch heißt runde Ecken
  }
  return b / a > 1.9 ? 28 : 0               // Android-Handy: meist leicht gerundet
}

// Die Namen der Wetter-Gefahren folgen der Sprache, der interne Typ bleibt gleich.
import assert from 'node:assert/strict'

globalThis.__SPRACHE = 'en'
const { typName, bewerte } = await import('../src/lib/gefahren.js')

const tag = { time: ['2030-01-01'], temperature_2m_max: [45], precipitation_sum: [90], wind_gusts_10m_max: [95], weather_code: [96] }
const typen = bewerte({ daily: tag }).gefahren.map((g) => g.typ)
assert.deepEqual([...typen].sort(), ['Gewitter', 'Hitze', 'Sturm', 'Überflutung'])
assert.deepEqual(typen.map(typName).sort(), ['Flooding', 'Heat', 'Storm', 'Thunderstorm'])
assert.equal(typName('Starkregen'), 'Heavy rain')
assert.equal(typName('Unbekannt'), 'Unbekannt')
console.log('✓ Gefahren-Namen auf Englisch')

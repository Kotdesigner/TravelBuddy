// Notizen im Tagebuch: am Tag, bei der Etappe, am Ende, abgewählte gar nicht.
import assert from 'node:assert/strict'
import { verteileNotizen, notizDatum } from '../src/lib/notizen-verteilung.js'

const kap = [{ id: 'a', tage: [{ datum: '2030-05-01', journal: [{}] }, { datum: '2030-05-02', journal: [] }] }, { id: 'b', tage: [{ datum: '2030-05-05', journal: [{}] }] }]
const n = (id, tag, extra = {}) => ({ id, tsLokal: `${tag}T10:00`, ...extra })
const v = verteileNotizen([
  n('tag', '2030-05-01'), n('etappeTag', '2030-05-05', { etappeId: 'b' }), n('etappe', '2030-05-20', { etappeId: 'a' }),
  n('fremd', '2030-05-01', { etappeId: 'b' }), n('rest', '2030-06-01'), n('aus', '2030-05-01', { imLogbuch: false }), n('weg', '2030-06-01', { etappeId: 'gibtsnicht' }),
], kap)
assert.deepEqual(v.tag.get('2030-05-01').map((x) => x.id), ['tag'])
assert.deepEqual(v.tag.get('2030-05-05').map((x) => x.id), ['etappeTag'])
assert.deepEqual(v.etappe.get('a').map((x) => x.id), ['etappe'])
assert.deepEqual(v.etappe.get('b').map((x) => x.id), ['fremd'])
assert.deepEqual(v.rest.map((x) => x.id), ['rest', 'weg'])
assert.equal(notizDatum({ tsLokal: '2030-05-01T23:59' }), '2030-05-01')
console.log('✓ Notizen-Verteilung')

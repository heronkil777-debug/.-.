const fs = require('fs');
global.window = {};
require('../www/js/data.js');
const { CATS, DICS } = window.STOP_DATA;
const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
let words=0, bad=[], dup=[], total=0;
const check = (label, dict) => {
  for (const [L, str] of Object.entries(dict)) {
    const list = str.split('|').map(s=>s.trim()).filter(Boolean);
    const seen = new Set();
    for (const w of list) {
      words++;
      if (w.includes('? nao')) { bad.push([label,L,w,'marcador ?']); continue; }
      if (w.length < 2) { bad.push([label,L,w,'muito curta']); continue; }
      if (norm(w)[0] !== L.toLowerCase()) bad.push([label,L,w,'letra errada']);
      if (seen.has(norm(w))) dup.push([label,L,w]); seen.add(norm(w));
    }
  }
};
for (const c of CATS) { total++; if (c.ref) { if(!DICS[c.ref]) bad.push([c.id,'-','-','ref inexistente']); continue;} check(c.id, c.d); }
for (const [k,v] of Object.entries(DICS)) check('DIC:'+k, v);
console.log('categorias:', total, '| palavras (com dup):', words);
console.log('letras por categoria:');
for (const c of CATS) { const dict = c.ref ? DICS[c.ref] : c.d; if(!dict) continue; console.log(' ', c.id.padEnd(12), Object.keys(dict).length, 'letras'); }
console.log('\nPROBLEMAS ('+bad.length+'):'); bad.forEach(b=>console.log('  ', b.join(' | ')));
console.log('\nDUPLICADAS ('+dup.length+'):'); dup.forEach(b=>console.log('  ', b.join(' | ')));

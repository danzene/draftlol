'use strict';
/* Mini-framework de teste sem dependências. */

let passed = 0, failed = 0;
const fails = [];

function test(name, fn){
  try { fn(); passed++; process.stdout.write('.'); }
  catch(e){ failed++; fails.push([name, e]); process.stdout.write('F'); }
}
function assert(cond, msg){ if(!cond) throw new Error(msg || 'assertion failed'); }
function assertEq(a, b, msg){ if(a !== b) throw new Error((msg||'eq')+`: esperado ${b}, veio ${a}`); }
function assertClose(a, b, eps, msg){
  if(Math.abs(a-b) > (eps==null?1e-9:eps)) throw new Error((msg||'close')+`: esperado ~${b}, veio ${a}`);
}
function assertBetween(x, lo, hi, msg){
  if(!(x >= lo && x <= hi)) throw new Error((msg||'between')+`: ${x} fora de [${lo}, ${hi}]`);
}
function assertThrows(fn, msg){
  let threw = false;
  try { fn(); } catch(e){ threw = true; }
  if(!threw) throw new Error((msg||'throws')+': esperava exceção, não lançou');
}
function summary(){
  console.log(`\n\n${passed} passou, ${failed} falhou`);
  fails.forEach(([n,e])=>console.log(`  ✗ ${n}: ${e.message}`));
  if(failed) process.exit(1);
  console.log('✓ todos os testes passaram');
}

module.exports = { test, assert, assertEq, assertClose, assertBetween, assertThrows, summary };

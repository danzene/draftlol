'use strict';
const cfg  = require('../config.js');
const util = require('../util.js');
const prob = require('../probability.js');

module.exports = function(h){
  const { test, assert, assertEq, assertClose, assertBetween } = h;

  test('poderes iguais → 50% (compostura máxima)', ()=>{
    assertClose(prob.matchWinProbability(300, 300, 100), 0.5, 1e-9, 'empate');
  });

  test('favorito > 50% e azarão < 50%', ()=>{
    assert(prob.matchWinProbability(340, 300, 100) > 0.5, 'favorito');
    assert(prob.matchWinProbability(300, 340, 100) < 0.5, 'azarão');
  });

  test('probabilidade é simétrica: p(A,B) + p(B,A) = 1', ()=>{
    const ab = prob.matchWinProbability(330, 300, 80);
    const ba = prob.matchWinProbability(300, 330, 80);
    assertClose(ab + ba, 1.0, 1e-9, 'simetria');
  });

  test('nunca chega a 100% mesmo com diferença enorme', ()=>{
    const p = prob.matchWinProbability(5000, 0, 100);
    assert(p <= cfg.probability.clampHi, 'passou do teto');
    assert(p < 1.0, 'chegou a 100%');
  });

  test('nunca chega a 0% mesmo perdendo feio', ()=>{
    const p = prob.matchWinProbability(0, 5000, 100);
    assert(p >= cfg.probability.clampLo, 'abaixo do piso');
    assert(p > 0.0, 'chegou a 0%');
  });

  test('compostura baixa gera mais upset (prob mais perto de 50%)', ()=>{
    const favHigh = prob.matchWinProbability(360, 300, 100); // elenco frio
    const favLow  = prob.matchWinProbability(360, 300, 0);   // elenco verde
    assert(favLow < favHigh, 'compostura baixa deveria reduzir o favoritismo');
    assert(favLow > 0.5, 'favorito ainda é favorito, só que menos');
  });

  test('composureSharpness varia entre min e max', ()=>{
    assertClose(prob.composureSharpness(0), cfg.probability.composureMin, 1e-9, 'sharp@0');
    assertClose(prob.composureSharpness(100), cfg.probability.composureMax, 1e-9, 'sharp@100');
    assertBetween(prob.composureSharpness(50),
      cfg.probability.composureMin, cfg.probability.composureMax, 'sharp@50');
  });

  test('teamMatchProbability usa a fase e a compostura média das equipes', ()=>{
    const A = { early:320, mid:330, late:300, composure:80 };
    const B = { early:300, mid:300, late:340, composure:40 };
    const pMid = prob.teamMatchProbability(A, B, 'mid');
    const pLate= prob.teamMatchProbability(A, B, 'late');
    assert(pMid > 0.5, 'A mais forte no mid');
    assert(pLate < 0.5, 'B mais forte no late');
  });

  test('rollMatch é determinístico com rnd semeado', ()=>{
    const r1 = util.seeded('x'); const r2 = util.seeded('x');
    const a = prob.rollMatch(0.5, r1);
    const b = prob.rollMatch(0.5, r2);
    assertEq(a, b, 'mesma semente, mesmo resultado');
  });

  test('rollMatch favorece o favorito ao longo de muitas amostras', ()=>{
    const rnd = util.seeded('mc'); let wins=0; const N=4000;
    const p = prob.matchWinProbability(360, 300, 100);
    for(let i=0;i<N;i++) if(prob.rollMatch(p, rnd)) wins++;
    const rate = wins / N;
    assertBetween(rate, p-0.05, p+0.05, 'frequência ≈ probabilidade');
  });
};

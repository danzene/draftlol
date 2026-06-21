'use strict';
/* =======================================================================
   career/probability.js — probabilidade de vitória + variância por compostura.

   1) Probabilidade base = logística da diferença de poder (mesma curva do
      genTimeline, escalada para o poder de TIME do modo carreira).
   2) A compostura média das duas equipes "afia" o resultado:
        sharpness alto (compostura alta) → favorito se impõe (menos sorte)
        sharpness baixo (compostura baixa) → puxa pra 50/50 → mais upsets
      O upset vale para os DOIS lados — o resultado fica mais perto de moeda.
   3) Nunca 0% nem 100% (clamp).
   ======================================================================= */

const Career = (typeof globalThis!=='undefined'&&globalThis.Career)||{};
const cfg  = (typeof require!=='undefined') ? require('./config.js') : Career.config;
const util = (typeof require!=='undefined') ? require('./util.js')   : Career.util;

/* Sharpness ∈ [composureMin, composureMax] conforme a compostura média (0–100).
   1.0 = expressão total da diferença de poder; baixo = mais aleatório. */
function composureSharpness(compAvg){
  const c = util.clamp(compAvg, 0, 100) / 100;
  const p = cfg.probability;
  return p.composureMin + (p.composureMax - p.composureMin) * c;
}

/* Probabilidade de A vencer, dada a diferença de poder e a compostura média.
   Determinística (sem rnd): é a chance esperada. */
function matchWinProbability(powerA, powerB, compAvg){
  const base = 1 / (1 + Math.exp(-((powerA - powerB) * cfg.probability.logisticK)));
  const sharp = composureSharpness(compAvg == null ? 100 : compAvg);
  const p = 0.5 + (base - 0.5) * sharp;
  return util.clamp(p, cfg.probability.clampLo, cfg.probability.clampHi);
}

/* Conveniência: recebe dois resultados de poderTime e uma fase.
   A compostura do confronto é a média das compostura das duas equipes. */
function teamMatchProbability(teamPowerA, teamPowerB, phase){
  const pA = teamPowerA[phase], pB = teamPowerB[phase];
  const compAvg = ((teamPowerA.composure || 0) + (teamPowerB.composure || 0)) / 2;
  return matchWinProbability(pA, pB, compAvg);
}

/* Resolve um confronto: true = A vence. Usa um rnd injetado (determinístico
   quando vem de seeded(...)). A aleatoriedade real do resultado mora aqui;
   a probabilidade acima é só a chance. */
function rollMatch(prob, rnd){
  const r = (typeof rnd === 'function') ? rnd : Math.random;
  return r() < prob;
}

const __api={composureSharpness,matchWinProbability,teamMatchProbability,rollMatch};
if(typeof module!=='undefined'&&module.exports)module.exports=__api;
if(typeof globalThis!=='undefined'){(globalThis.Career=globalThis.Career||{}).probability=__api;}

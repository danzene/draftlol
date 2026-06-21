'use strict';
/* =======================================================================
   career/test-match.js — testes da engine de partida de carreira.

   Cobre: probabilidade, rollMatch, compostura, buildAiRoster,
          matchRewards, playerXpToLevel, careerPowerBias e determinismo.

   Uso: node career/test-match.js
   ======================================================================= */

const h       = require('./tests/_harness.js');
const cfg     = require('./config.js');
const util    = require('./util.js');
const players = require('./players.js');
const power   = require('./power.js');
const prob    = require('./probability.js');
const match   = require('./match.js');

/* ── Utilitários de teste ── */

/* Campeão mock na escala 0-100 que career/power.js espera */
const mockChamp = (arch, str) => ({arch, power:{early:str, mid:str, late:str}});

/* Monta 5 picks para um time completo */
function buildTeam(rarity, champStr, compostura){
  return ['top','jungle','mid','adc','support'].map(role=>{
    let p = players.getCatalog().find(x=>x.role===role&&x.rarity===rarity)
         || players.getCatalog().find(x=>x.role===role)
         || players.getCatalog()[0];
    if(compostura!=null) p = {...p, attrs:{...p.attrs, compostura}};
    return {player: p, champion: mockChamp('teamfight', champStr)};
  });
}

/* Simula N partidas e retorna taxa de vitória do time A */
function winRate(picksA, picksB, n, seed){
  const pwA  = power.poderTime(picksA);
  const pwB  = power.poderTime(picksB);
  const winP = prob.teamMatchProbability(pwA, pwB, 'avg');
  const rng  = util.seeded(seed||'wr-default');
  let wins = 0;
  for(let i=0; i<n; i++) if(prob.rollMatch(winP, rng)) wins++;
  return wins/n;
}

/* ── Testes de probabilidade e rollMatch ── */

h.test('time forte (champ=80,lendario) vence fraco (champ=20,comum) >65%', ()=>{
  const wr = winRate(buildTeam('lendario',80), buildTeam('comum',20), 2000, 't1');
  h.assertBetween(wr, 0.65, 0.98, 'win rate forte vs fraco');
});

h.test('times iguais ficam perto de 50%', ()=>{
  const wr = winRate(buildTeam('raro',50), buildTeam('raro',50), 2000, 't2');
  h.assertBetween(wr, 0.40, 0.60, 'win rate igual vs igual');
});

/* ── Seed determinístico ── */
h.test('mesmo seed → mesmos resultados (20 rolagens)', ()=>{
  const rA = util.seeded('det'), rB = util.seeded('det');
  for(let i=0; i<20; i++){
    const a = prob.rollMatch(0.6, rA);
    const b = prob.rollMatch(0.6, rB);
    h.assert(a===b, `resultado ${i} divergiu: ${a}≠${b}`);
  }
});

/* ── Efeito de compostura ── */
h.test('alta compostura: time mais forte domina mais que com baixa compostura', ()=>{
  // Time A (fraco champ=40) vs time B (forte champ=70)
  // Alta compostura → menos variância → fraco perde mais → wrHighComp < wrLowComp
  const wrHigh = winRate(buildTeam('raro',40,90), buildTeam('raro',70,90), 1000, 'hc');
  const wrLow  = winRate(buildTeam('raro',40, 5), buildTeam('raro',70, 5), 1000, 'lc');
  h.assert(wrHigh <= wrLow,
    `alta compostura deveria dar menos upset ao fraco: ${(wrHigh*100).toFixed(1)}% vs ${(wrLow*100).toFixed(1)}%`);
});

/* ── buildAiRoster ── */
h.test('buildAiRoster retorna 5 jogadores', ()=>{
  const rng = util.seeded('ai-1');
  const roster = match.buildAiRoster(50, rng);
  h.assertEq(roster.length, 5, 'tamanho do elenco');
});

h.test('buildAiRoster: um jogador por rota (na ordem ROLES)', ()=>{
  const rng = util.seeded('ai-2');
  const roster = match.buildAiRoster(50, rng);
  match.ROLES.forEach((r,i)=>{
    h.assertEq(roster[i].role, r, `rota ${r}`);
  });
});

h.test('buildAiRoster é determinístico com mesmo seed', ()=>{
  const r1 = match.buildAiRoster(50, util.seeded('x'));
  const r2 = match.buildAiRoster(50, util.seeded('x'));
  h.assert(r1.every((p,i)=>p.id===r2[i].id), 'ids devem coincidir');
});

/* ── matchRewards ── */
h.test('rewards vitória = pePerMatch + peWinBonus', ()=>{
  const rows = [{player_id:'a', xp:100, level:1}];
  const r = match.matchRewards(rows, true);
  h.assertEq(r.peGained, cfg.economy.pePerMatch + cfg.economy.peWinBonus, 'peGained vitória');
});

h.test('rewards derrota = pePerMatch', ()=>{
  const rows = [{player_id:'a', xp:0, level:1}];
  const r = match.matchRewards(rows, false);
  h.assertEq(r.peGained, cfg.economy.pePerMatch, 'peGained derrota');
});

h.test('matchRewards: XP acumulado corretamente', ()=>{
  const rows = [{player_id:'a', xp:100, level:1}];
  const r = match.matchRewards(rows, true);
  h.assertEq(r.playerUpdates[0].newXp, 100 + r.peGained, 'newXp');
});

/* ── playerXpToLevel ── */
h.test('playerXpToLevel: level 1 a xp=0',   ()=>h.assertEq(match.playerXpToLevel(0),   1, 'xp=0'));
h.test('playerXpToLevel: level 1 a xp=199', ()=>h.assertEq(match.playerXpToLevel(199), 1, 'xp=199'));
h.test('playerXpToLevel: level 2 a xp=200', ()=>h.assertEq(match.playerXpToLevel(200), 2, 'xp=200'));
h.test('playerXpToLevel: level 3 a xp=400', ()=>h.assertEq(match.playerXpToLevel(400), 3, 'xp=400'));

/* ── careerPowerBias ── */
h.test('bias em 50% = 0', ()=>{
  h.assertClose(match.careerPowerBias(0.5), 0, 1e-9, 'bias 50%');
});
h.test('bias em 70% > 0', ()=>{
  h.assert(match.careerPowerBias(0.7) > 0, 'bias 70%');
});
h.test('bias em 30% < 0', ()=>{
  h.assert(match.careerPowerBias(0.3) < 0, 'bias 30%');
});
h.test('bias é antissimétrico (70% + 30% ≈ 0)', ()=>{
  h.assertClose(match.careerPowerBias(0.7) + match.careerPowerBias(0.3), 0, 1e-9, 'anti-simetria');
});

h.summary();

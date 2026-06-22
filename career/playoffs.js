'use strict';
/* =======================================================================
   career/playoffs.js — Motor de bracket de playoffs (simples eliminação)
   Suporta brackets de 4, 6 e 8 times. Imutável: toda operação retorna
   um novo bracket sem modificar o original.
   ======================================================================= */

const util = require('./util.js');
const { seeded } = util;

/* ═══════════════════════════════════════════════════════════════════════
   _buildBracket(seeds, bo)
   Monta estrutura interna de matches a partir de array de teams ordenados
   por seed (índice 0 = melhor). Suporta 4, 6 e 8 times.

   Formato de cada match:
   { id, round, teamA, teamB, winner:null, bo, nextMatchId, nextSlot }
   nextSlot: 'A'|'B' — qual slot o vencedor ocupa no próximo match
   ═══════════════════════════════════════════════════════════════════════ */
function _buildBracket(seeds, bo) {
  const n = seeds.length;
  if (![4, 6, 8].includes(n)) throw new Error(`Bracket suporta 4, 6 ou 8 times; recebeu ${n}`);

  const matches = {};
  function addMatch(id, round, a, b, nextId, nextSlot) {
    matches[id] = { id, round, teamA: a || null, teamB: b || null, winner: null, bo, nextMatchId: nextId || null, nextSlot: nextSlot || null };
  }

  if (n === 4) {
    addMatch('SF1', 'SF', seeds[0], seeds[3], 'F', 'A');
    addMatch('SF2', 'SF', seeds[1], seeds[2], 'F', 'B');
    addMatch('F',   'F',  null,     null,     null, null);
    return { matches, roundOrder: ['SF', 'F'] };
  }

  if (n === 6) {
    // Top 2 têm bye para a semi; 3 vs 6, 4 vs 5 na QF
    addMatch('QF1', 'QF', seeds[2], seeds[5], 'SF1', 'B');
    addMatch('QF2', 'QF', seeds[3], seeds[4], 'SF2', 'B');
    addMatch('SF1', 'SF', seeds[0], null,     'F',   'A');
    addMatch('SF2', 'SF', seeds[1], null,     'F',   'B');
    addMatch('F',   'F',  null,     null,     null,  null);
    return { matches, roundOrder: ['QF', 'SF', 'F'] };
  }

  // n === 8
  addMatch('QF1', 'QF', seeds[0], seeds[7], 'SF1', 'A');
  addMatch('QF2', 'QF', seeds[3], seeds[4], 'SF1', 'B');
  addMatch('QF3', 'QF', seeds[1], seeds[6], 'SF2', 'A');
  addMatch('QF4', 'QF', seeds[2], seeds[5], 'SF2', 'B');
  addMatch('SF1', 'SF', null,     null,     'F',   'A');
  addMatch('SF2', 'SF', null,     null,     'F',   'B');
  addMatch('F',   'F',  null,     null,     null,  null);
  return { matches, roundOrder: ['QF', 'SF', 'F'] };
}

/* ═══════════════════════════════════════════════════════════════════════
   generatePlayoffBracket(teams, seed, bo)
   teams: array de times ordenados por seed (index 0 = melhor)
   Retorna objeto bracket pronto para uso.
   ═══════════════════════════════════════════════════════════════════════ */
function generatePlayoffBracket(teams, seed, bo = 5) {
  const { matches, roundOrder } = _buildBracket(teams, bo);
  return { teams, seed, bo, matches, roundOrder };
}

/* ═══════════════════════════════════════════════════════════════════════
   resolvePlayoffMatch(bracket, matchId, winnerTeam)
   Imutável: retorna novo bracket com o match resolvido e o vencedor
   automaticamente inserido no próximo match.
   ═══════════════════════════════════════════════════════════════════════ */
function resolvePlayoffMatch(bracket, matchId, winnerTeam) {
  const matches = { ...bracket.matches };
  const match = { ...matches[matchId], winner: winnerTeam };
  matches[matchId] = match;

  if (match.nextMatchId && matches[match.nextMatchId]) {
    const next = { ...matches[match.nextMatchId] };
    if (match.nextSlot === 'A') next.teamA = winnerTeam;
    else next.teamB = winnerTeam;
    matches[match.nextMatchId] = next;
  }
  return { ...bracket, matches };
}

/* ═══════════════════════════════════════════════════════════════════════
   aiResolveMatch(match, matchSeed)
   Resolve um match IA vs IA pela força dos times (logística).
   Retorna o time vencedor.
   ═══════════════════════════════════════════════════════════════════════ */
function aiResolveMatch(match, matchSeed) {
  const rnd = seeded(matchSeed);
  const { teamA, teamB } = match;
  if (!teamA || !teamB) throw new Error('Match sem ambos os times definidos');
  const pA = 1 / (1 + Math.exp(-0.06 * (teamA.strength - teamB.strength)));
  return rnd() < pA ? teamA : teamB;
}

/* ═══════════════════════════════════════════════════════════════════════
   advanceBracketAI(bracket, playerTeamId, seedPrefix)
   Resolve todos os matches IA vs IA até encontrar um match do player
   ou o bracket terminar. Retorna novo bracket.
   ═══════════════════════════════════════════════════════════════════════ */
function advanceBracketAI(bracket, playerTeamId, seedPrefix = 'ai') {
  let b = bracket;
  let changed = true;
  let iter = 0;
  while (changed && iter < 50) {
    changed = false;
    iter++;
    for (const id of Object.keys(b.matches)) {
      const m = b.matches[id];
      if (m.winner !== null) continue;
      if (!m.teamA || !m.teamB) continue;
      if (m.teamA.id === playerTeamId || m.teamB.id === playerTeamId) continue;
      const winner = aiResolveMatch(m, `${seedPrefix}_${id}`);
      b = resolvePlayoffMatch(b, id, winner);
      changed = true;
      break; // reinicia loop após cada mudança
    }
  }
  return b;
}

/* ═══════════════════════════════════════════════════════════════════════
   getNextPlayerMatch(bracket, playerTeamId)
   Retorna o próximo match em que o player participa e ainda não foi
   resolvido. Retorna null se não houver.
   ═══════════════════════════════════════════════════════════════════════ */
function getNextPlayerMatch(bracket, playerTeamId) {
  for (const id of bracket.roundOrder.flatMap(r =>
    Object.keys(bracket.matches).filter(k => bracket.matches[k].round === r)
  )) {
    const m = bracket.matches[id];
    if (m.winner !== null) continue;
    if (m.teamA?.id === playerTeamId || m.teamB?.id === playerTeamId) return m;
  }
  return null;
}

/* ═══════════════════════════════════════════════════════════════════════
   getBracketWinner(bracket)
   Retorna o time campeão (vencedor da Final) ou null se não decidido.
   ═══════════════════════════════════════════════════════════════════════ */
function getBracketWinner(bracket) {
  return bracket.matches['F']?.winner || null;
}

/* ── Exports ──────────────────────────────────────────────────────────── */
const __api = {
  generatePlayoffBracket,
  resolvePlayoffMatch,
  aiResolveMatch,
  advanceBracketAI,
  getNextPlayerMatch,
  getBracketWinner,
};
if (typeof module !== 'undefined' && module.exports) module.exports = __api;
if (typeof globalThis !== 'undefined') { (globalThis.Career = globalThis.Career || {}).playoffs = __api; }

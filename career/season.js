'use strict';
/* =======================================================================
   career/season.js — Motor de temporada regular 2026
   Gera times, schedules round-robin, resolve partidas e retorna standings.
   Completamente determinístico dado o seed; sem side-effects.
   ======================================================================= */

const util = require('./util.js');
const { seeded, rint, clamp } = util;

/* ── Regiões 2026 ─────────────────────────────────────────────────────── */
const REGIONS_2026 = [
  { id:'LCK',   name:'LCK',   teams:10, playoffSlots:6, fstSlots:2, msiSlots:2, worldsSlots:3, baseStrength:76 },
  { id:'LPL',   name:'LPL',   teams:14, playoffSlots:8, fstSlots:2, msiSlots:2, worldsSlots:3, baseStrength:78 },
  { id:'LEC',   name:'LEC',   teams:10, playoffSlots:6, fstSlots:1, msiSlots:2, worldsSlots:3, baseStrength:68 },
  { id:'LCS',   name:'LCS',   teams:8,  playoffSlots:6, fstSlots:1, msiSlots:2, worldsSlots:3, baseStrength:62 },
  { id:'LCP',   name:'LCP',   teams:8,  playoffSlots:6, fstSlots:1, msiSlots:2, worldsSlots:3, baseStrength:60 },
  { id:'CBLOL', name:'CBLOL', teams:8,  playoffSlots:6, fstSlots:1, msiSlots:1, worldsSlots:2, baseStrength:55 },
];

const REGION_BY_ID = {};
REGIONS_2026.forEach(r => { REGION_BY_ID[r.id] = r; });

/* ── Nomes de times por região ────────────────────────────────────────── */
const TEAM_NAMES = {
  LCK: [
    'T1', 'Gen.G', 'KT Rolster', 'Dplus KIA', 'Kwangdong Freecs',
    'Hanwha Life Esports', 'DRX', 'OKSavingsBank BRION', 'Nongshim RedForce', 'Liiv SANDBOX',
  ],
  LPL: [
    'JDG Esports', 'BiliBili Gaming', 'Top Esports', 'NIP Esports', 'Weibo Gaming',
    'FunPlus Phoenix', 'LNG Esports', 'Team WE', 'ThunderTalk Gaming', "Anyone's Legend",
    'Invictus Gaming', 'Royal Never Give Up', 'Oh My God', 'Dragon Ranger Gaming',
  ],
  LEC: [
    'G2 Esports', 'Fnatic', 'Team Vitality', 'Team BDS', 'MAD Lions',
    'SK Gaming', 'Excel Esports', 'Karmine Corp', 'Team Heretics', 'Astralis',
  ],
  LCS: [
    'Cloud9', 'Team Liquid', '100 Thieves', 'FlyQuest',
    'Evil Geniuses', 'NRG', 'Dignitas', 'Immortals',
  ],
  LCP: [
    'PSG Talon', 'LOUD', 'Paper Rex', 'NAVI',
    'DetonatioN FocusMe', 'Rex Regum Qeon', 'Chiefs Esports', 'Talon Esports',
  ],
  CBLOL: [
    'paiN Gaming', 'LOUD CBLOL', 'Fluxo', 'FURIA',
    'Kabum! e-Sports', 'Red Canids', 'INTZ', 'Vivo Keyd Stars',
  ],
};

/* ── Mapa de torneio por split ────────────────────────────────────────── */
const SPLIT_TOURNAMENT = { 1: 'FST', 2: 'MSI', 3: 'WORLDS' };

/* ═══════════════════════════════════════════════════════════════════════
   generateLeagueTeams(regionId, year, splitNum)
   Retorna array de times com id, name, strength, seed, isPlayer:false.
   Determinístico: mesma entrada → mesma saída.
   ═══════════════════════════════════════════════════════════════════════ */
function generateLeagueTeams(regionId, year, splitNum) {
  const region = REGION_BY_ID[regionId];
  if (!region) throw new Error(`Região desconhecida: ${regionId}`);

  const rnd = seeded(`${regionId}_${year}_S${splitNum}_teams`);
  const names = TEAM_NAMES[regionId] || [];
  const n = region.teams;
  const base = region.baseStrength;

  const teams = [];
  for (let i = 0; i < n; i++) {
    // Times mais antigos no array têm strength base maior (seed 1 = melhor)
    const tier = i / Math.max(n - 1, 1); // 0.0 (top) → 1.0 (bottom)
    const strength = Math.round(clamp(base + 14 - tier * 28 + (rnd() - 0.5) * 8, 20, 99));
    teams.push({
      id: `${regionId}_Y${year}_S${splitNum}_${i}`,
      name: names[i] || `${regionId} Team ${i + 1}`,
      regionId,
      seed: i + 1,
      strength,
      isPlayer: false,
    });
  }
  return teams;
}

/* ═══════════════════════════════════════════════════════════════════════
   generateSchedule(teams, splitSeed)
   Round-robin simples (N-1 rodadas, cada par joga uma vez).
   Usa rotação de Berger: fix index 0, roda os restantes.
   ═══════════════════════════════════════════════════════════════════════ */
function generateSchedule(teams, splitSeed) {
  const n = teams.length;
  if (n < 2) return [];

  const ids = teams.map(t => t.id);
  const pos = ids.map((_, i) => i);
  const rounds = n % 2 === 0 ? n - 1 : n;
  const half = Math.floor(n / 2);
  const schedule = [];

  for (let r = 0; r < rounds; r++) {
    const matches = [];
    for (let i = 0; i < half; i++) {
      matches.push({ homeId: ids[pos[i]], awayId: ids[pos[n - 1 - i]] });
    }
    schedule.push({ round: r + 1, matches });
    // Rotação: mantém pos[0] fixo, move último para pos[1]
    if (n > 2) {
      const last = pos.splice(pos.length - 1, 1)[0];
      pos.splice(1, 0, last);
    }
  }
  return schedule;
}

/* ═══════════════════════════════════════════════════════════════════════
   resolveMatch(strengthA, strengthB, matchSeed)
   Retorna 'A' ou 'B'. Logística com ruído (k=0.05).
   ═══════════════════════════════════════════════════════════════════════ */
function resolveMatch(strengthA, strengthB, matchSeed) {
  const rnd = seeded(matchSeed);
  const pA = 1 / (1 + Math.exp(-0.05 * (strengthA - strengthB)));
  return rnd() < pA ? 'A' : 'B';
}

/* ═══════════════════════════════════════════════════════════════════════
   computeStandings(teams, results)
   results: [{homeId, awayId, winner:'A'|'B'}]
   Retorna array ordenado por wins DESC → losses ASC → strength DESC.
   ═══════════════════════════════════════════════════════════════════════ */
function computeStandings(teams, results) {
  const rec = {};
  teams.forEach(t => { rec[t.id] = { wins: 0, losses: 0, team: t }; });
  results.forEach(r => {
    const winner = r.winner === 'A' ? r.homeId : r.awayId;
    const loser  = r.winner === 'A' ? r.awayId  : r.homeId;
    if (rec[winner]) rec[winner].wins++;
    if (rec[loser])  rec[loser].losses++;
  });
  return Object.values(rec).sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (a.losses !== b.losses) return a.losses - b.losses;
    return b.team.strength - a.team.strength;
  });
}

/* ═══════════════════════════════════════════════════════════════════════
   runRegularSeason(teams, splitSeed)
   Gera schedule, resolve todas as partidas AI, retorna { results, standings }.
   Partidas que envolvem o time do player ficam com winner:null
   (a ser resolvido pela UI via input do player).
   ═══════════════════════════════════════════════════════════════════════ */
function runRegularSeason(teams, splitSeed, playerTeamId = null) {
  const schedule = generateSchedule(teams, splitSeed);
  const teamById = {};
  teams.forEach(t => { teamById[t.id] = t; });

  const results = [];
  schedule.forEach(({ round, matches }) => {
    matches.forEach((m, mi) => {
      const isPlayerMatch = playerTeamId && (m.homeId === playerTeamId || m.awayId === playerTeamId);
      if (isPlayerMatch) {
        results.push({ ...m, winner: null, playerMatch: true });
      } else {
        const tA = teamById[m.homeId];
        const tB = teamById[m.awayId];
        const seed = `${splitSeed}_R${round}_M${mi}`;
        const winner = resolveMatch(tA.strength, tB.strength, seed);
        results.push({ ...m, winner, playerMatch: false });
      }
    });
  });

  const standings = computeStandings(teams, results.filter(r => r.winner !== null));
  return { schedule, results, standings };
}

/* ═══════════════════════════════════════════════════════════════════════
   getQualifiers(standings, n)
   Retorna os top N times dos standings (para playoffs ou intl).
   ═══════════════════════════════════════════════════════════════════════ */
function getQualifiers(standings, n) {
  return standings.slice(0, n).map(s => s.team);
}

/* ═══════════════════════════════════════════════════════════════════════
   buildInternationalField(regionStandings, tournament, playerTeamId)
   regionStandings: { regionId: [{wins, losses, team}] }  (já ordenado)
   tournament: 'FST' | 'MSI' | 'WORLDS'
   Retorna array de times na ordem de seed internacional.
   ═══════════════════════════════════════════════════════════════════════ */
function buildInternationalField(regionStandings, tournament, playerTeamId = null) {
  const slotKey = { FST: 'fstSlots', MSI: 'msiSlots', WORLDS: 'worldsSlots' }[tournament];
  const field = [];
  let intlSeed = 1;

  for (const region of REGIONS_2026) {
    const slots = region[slotKey] || 0;
    const standings = regionStandings[region.id] || [];
    for (let i = 0; i < Math.min(slots, standings.length); i++) {
      const t = standings[i].team || standings[i];
      field.push({
        ...t,
        intlSeed: intlSeed++,
        intlRegion: region.id,
        isPlayer: t.id === playerTeamId,
      });
    }
  }
  return field;
}

/* ═══════════════════════════════════════════════════════════════════════
   initialWorldState(regionId)
   Estado inicial do player ao começar a carreira.
   ═══════════════════════════════════════════════════════════════════════ */
function initialWorldState(regionId) {
  const region = REGION_BY_ID[regionId];
  if (!region) throw new Error(`Região desconhecida: ${regionId}`);
  return {
    version:             2,
    regionId,
    year:                1,
    split:               1,
    phase:               'regular_season', // regular_season | playoffs | international | off_season
    standings:           null,
    regularResults:      null,
    playoffBracket:      null,
    internationalResult: null,
    msiWinner:           null,
    worldsChampion:      null,
    prevWorldsChampion:  null,
    recurringRivals:     [],
    peEarned:            0,
    fichasEarned:        0,
  };
}

/* ═══════════════════════════════════════════════════════════════════════
   advanceToNextSplit(ws)
   Imutável: retorna novo worldState para o split seguinte.
   Ao final do split 3, passa para o ano seguinte.
   ═══════════════════════════════════════════════════════════════════════ */
function advanceToNextSplit(ws) {
  let { year, split, worldsChampion } = ws;
  split++;
  if (split > 3) {
    split = 1;
    year++;
  }
  return {
    ...ws,
    year,
    split,
    phase:               'regular_season',
    standings:           null,
    regularResults:      null,
    playoffBracket:      null,
    internationalResult: null,
    msiWinner:           split === 1 ? null : ws.msiWinner, // reseta MSI no início do ano
    prevWorldsChampion:  split === 1 ? worldsChampion : ws.prevWorldsChampion,
    worldsChampion:      split === 1 ? null : worldsChampion,
  };
}

/* ── Exports ──────────────────────────────────────────────────────────── */
const __api = {
  REGIONS_2026, REGION_BY_ID, TEAM_NAMES, SPLIT_TOURNAMENT,
  generateLeagueTeams, generateSchedule, resolveMatch,
  computeStandings, runRegularSeason, getQualifiers,
  buildInternationalField, initialWorldState, advanceToNextSplit,
};
if (typeof module !== 'undefined' && module.exports) module.exports = __api;
if (typeof globalThis !== 'undefined') { (globalThis.Career = globalThis.Career || {}).season = __api; }

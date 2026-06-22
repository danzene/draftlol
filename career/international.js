'use strict';
/* =======================================================================
   career/international.js — FST, MSI e Worlds
   Cada torneio retorna um objeto de estado completo com histórico
   de rodadas. Todos os resultados AI são determinísticos pelo seed.
   ======================================================================= */

const util     = require('./util.js');
const playoffs = require('./playoffs.js');
const { seeded } = util;
const { generatePlayoffBracket, resolvePlayoffMatch, aiResolveMatch, advanceBracketAI, getBracketWinner } = playoffs;

/* ── helper interno: resolve bracket completo sem player ─────────────── */
function _runBracketAI(teams, seed, bo = 5) {
  let bracket = generatePlayoffBracket(teams, seed, bo);
  bracket = advanceBracketAI(bracket, '__none__', seed);
  return bracket;
}

/* ═══════════════════════════════════════════════════════════════════════
   FST — First Stand Tournament (Split 1)
   8 times, simples eliminação BO5, sem play-in.
   ═══════════════════════════════════════════════════════════════════════ */
function generateFST(teams, seed) {
  if (teams.length !== 8) throw new Error(`FST precisa de 8 times; recebeu ${teams.length}`);
  return {
    tournament: 'FST',
    seed,
    bracket: generatePlayoffBracket(teams, seed, 5),
  };
}

function runFSTAI(fst, playerTeamId = null) {
  const bracket = advanceBracketAI(fst.bracket, playerTeamId || '__none__', fst.seed);
  return { ...fst, bracket };
}

/* ═══════════════════════════════════════════════════════════════════════
   MSI — Mid-Season Invitational (Split 2)
   11 times: Play-In (4 times, simples elim BO5, 1 avança) +
             Bracket (7 diretos + 1 play-in winner = 8 times)
   Os 4 times com menor intlSeed vão ao Play-In.
   ═══════════════════════════════════════════════════════════════════════ */
function generateMSI(teams, seed) {
  if (teams.length !== 11) throw new Error(`MSI precisa de 11 times; recebeu ${teams.length}`);

  // Últimos 4 por intlSeed → Play-In; primeiros 7 → direto ao bracket
  const sorted     = [...teams].sort((a, b) => (a.intlSeed || a.seed) - (b.intlSeed || b.seed));
  const direct     = sorted.slice(0, 7);
  const playIn     = sorted.slice(7);   // seeds 8-11

  // Play-In: semi (8v11, 9v10) + final entre perdedores não; aqui: 1 winner avança
  // Implementado como bracket de 4 times simples
  const playInBracket = generatePlayoffBracket(playIn, seed + '_playin', 5);

  return {
    tournament: 'MSI',
    seed,
    direct,
    playIn,
    playInBracket,
    playInWinner: null,
    bracket: null,       // montado após play-in terminar
  };
}

function runMSIPlayInAI(msi, playerTeamId = null) {
  const playInBracket = advanceBracketAI(msi.playInBracket, playerTeamId || '__none__', msi.seed + '_playin');
  const playInWinner  = getBracketWinner(playInBracket);

  let bracket = null;
  if (playInWinner) {
    const bracketTeams = [...msi.direct, playInWinner]
      .sort((a, b) => (a.intlSeed || a.seed) - (b.intlSeed || b.seed));
    bracket = generatePlayoffBracket(bracketTeams, msi.seed + '_bracket', 5);
  }
  return { ...msi, playInBracket, playInWinner, bracket };
}

function runMSIBracketAI(msi, playerTeamId = null) {
  if (!msi.bracket) throw new Error('Bracket do MSI ainda não foi montado (play-in não terminou?)');
  const bracket = advanceBracketAI(msi.bracket, playerTeamId || '__none__', msi.seed + '_bracket');
  return { ...msi, bracket };
}

/* ═══════════════════════════════════════════════════════════════════════
   WORLDS — Campeonato Mundial (Split 3)
   Play-In (4 times, dupla elim simplificada, 1 avança)
   Swiss Stage (16 times = 15 diretos + 1 play-in winner, 5 rodadas)
   Knockout (8 times, simples elim BO5)
   ═══════════════════════════════════════════════════════════════════════ */

/* -- Swiss helpers -- */
function _initSwiss(teams) {
  return {
    teams: teams.map((t, i) => ({ ...t, swissSeed: i + 1, wins: 0, losses: 0 })),
    rounds: [],
    qualified: [],  // IDs definidos APÓS 5 rodadas
    eliminated: [],
  };
}

// Emparelha todos os times ativos por proximidade de record (greedy, evita rematches).
function _pairSwissRound(state, roundNum) {
  // Ordena por wins DESC, losses ASC, seed ASC
  const sorted = [...state.teams].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (a.losses !== b.losses) return a.losses - b.losses;
    return a.swissSeed - b.swissSeed;
  });

  const prevMatchups = new Set();
  state.rounds.forEach(r => r.matches.forEach(m => {
    prevMatchups.add(`${m.teamAId}|${m.teamBId}`);
    prevMatchups.add(`${m.teamBId}|${m.teamAId}`);
  }));

  const used = new Set();
  const matches = [];

  for (let i = 0; i < sorted.length; i++) {
    if (used.has(sorted[i].id)) continue;
    let bestJ = -1;
    // Preferência: mesmo record, não-rematch, mais próximo na ordem
    for (let j = i + 1; j < sorted.length; j++) {
      if (used.has(sorted[j].id)) continue;
      const key = `${sorted[i].id}|${sorted[j].id}`;
      if (!prevMatchups.has(key)) { bestJ = j; break; }
      if (bestJ === -1) bestJ = j; // aceita rematch como último recurso
    }
    if (bestJ !== -1) {
      matches.push({ id: `swiss_R${roundNum}_${matches.length}`, teamAId: sorted[i].id, teamBId: sorted[bestJ].id, winnerId: null });
      used.add(sorted[i].id);
      used.add(sorted[bestJ].id);
    }
  }
  return matches;
}

// Resolve matches e atualiza wins/losses. Sem eliminação antecipada.
function _resolveSwissRound(state, matches, seed) {
  const rndFn = seeded(seed);
  const teamById = {};
  state.teams.forEach(t => { teamById[t.id] = t; });

  const resolvedMatches = matches.map(m => {
    const tA = teamById[m.teamAId];
    const tB = teamById[m.teamBId];
    const pA = 1 / (1 + Math.exp(-0.05 * (tA.strength - tB.strength)));
    const winnerId = rndFn() < pA ? m.teamAId : m.teamBId;
    return { ...m, winnerId };
  });

  const newTeams = state.teams.map(t => ({ ...t }));
  const newTeamById = {};
  newTeams.forEach(t => { newTeamById[t.id] = t; });
  resolvedMatches.forEach(m => {
    const loserId = m.teamAId === m.winnerId ? m.teamBId : m.teamAId;
    newTeamById[m.winnerId].wins++;
    newTeamById[loserId].losses++;
  });

  return {
    ...state,
    teams: newTeams,
    rounds: [...state.rounds, { round: state.rounds.length + 1, matches: resolvedMatches }],
  };
}

// Roda 5 rodadas Swiss (IA completa). Top 8 por vitórias avançam ao knockout.
function runSwissAI(swissState, seed, playerTeamId = null) {
  let state = swissState;

  for (let r = 1; r <= 5; r++) {
    const matches = _pairSwissRound(state, r);

    // Se o player está nesta rodada, resolve os outros AI e pausa
    if (playerTeamId && matches.some(m => m.teamAId === playerTeamId || m.teamBId === playerTeamId)) {
      const teamById = {};
      state.teams.forEach(t => { teamById[t.id] = t; });
      const aiMatches = matches.map(m => {
        if (m.teamAId === playerTeamId || m.teamBId === playerTeamId) return m;
        const tA = teamById[m.teamAId], tB = teamById[m.teamBId];
        const rnd = seeded(seed + `_R${r}_${m.id}`);
        const pA = 1 / (1 + Math.exp(-0.05 * (tA.strength - tB.strength)));
        return { ...m, winnerId: rnd() < pA ? m.teamAId : m.teamBId };
      });
      state = {
        ...state,
        rounds: [...state.rounds, { round: r, matches: aiMatches }],
        pendingPlayerMatch: matches.find(m => m.teamAId === playerTeamId || m.teamBId === playerTeamId),
      };
      break;
    }

    state = _resolveSwissRound(state, matches, seed + `_R${r}`);
  }

  // Classifica top 8 por wins DESC, swissSeed ASC
  const sorted = [...state.teams].sort((a, b) => b.wins !== a.wins ? b.wins - a.wins : a.swissSeed - b.swissSeed);
  const qualified  = sorted.slice(0, 8).map(t => t.id);
  const eliminated = sorted.slice(8).map(t => t.id);
  return { ...state, qualified, eliminated };
}

/* -- Play-In dupla eliminação simplificada (4 → 1 avança) -- */
function _runPlayInDE(teams, seed) {
  // WB: semi (0v3, 1v2), WB final (winners)
  // LB: semi (losers de WB semi), LB final (losers de WB final vs winner de LB semi)
  // Grand Final: WB final winner vs LB final winner
  const rnd = seeded(seed);
  function resolve(a, b) {
    const pA = 1 / (1 + Math.exp(-0.05 * (a.strength - b.strength)));
    return rnd() < pA ? a : b;
  }

  const [s1, s2, s3, s4] = teams; // seed 1 (melhor) a 4
  const wbS1w = resolve(s1, s4);  const wbS1l = wbS1w === s1 ? s4 : s1;
  const wbS2w = resolve(s2, s3);  const wbS2l = wbS2w === s2 ? s3 : s2;
  const wbFw  = resolve(wbS1w, wbS2w); const wbFl = wbFw === wbS1w ? wbS2w : wbS1w;
  const lbSw  = resolve(wbS1l, wbS2l);
  const lbFw  = resolve(lbSw, wbFl);
  const gfW   = resolve(wbFw, lbFw);

  return {
    teams,
    matches: [
      { round:'WB-SF', teamA:s1,     teamB:s4,   winner:wbS1w },
      { round:'WB-SF', teamA:s2,     teamB:s3,   winner:wbS2w },
      { round:'LB-SF', teamA:wbS1l,  teamB:wbS2l,winner:lbSw  },
      { round:'WB-F',  teamA:wbS1w,  teamB:wbS2w,winner:wbFw  },
      { round:'LB-F',  teamA:lbSw,   teamB:wbFl, winner:lbFw  },
      { round:'GF',    teamA:wbFw,   teamB:lbFw, winner:gfW   },
    ],
    winner: gfW,
  };
}

/* ═══════════════════════════════════════════════════════════════════════
   generateWorlds(teams, seed)
   teams: 19 times ordenados por intlSeed
   ═══════════════════════════════════════════════════════════════════════ */
function generateWorlds(teams, seed) {
  if (teams.length < 17 || teams.length > 20)
    throw new Error(`Worlds precisa de 17-20 times; recebeu ${teams.length}`);

  const sorted  = [...teams].sort((a, b) => (a.intlSeed || a.seed) - (b.intlSeed || b.seed));
  const n       = sorted.length;
  const playIn  = sorted.slice(n - 4);   // 4 piores seeds
  const direct  = sorted.slice(0, n - 4);// restantes → Swiss direto

  return {
    tournament: 'WORLDS',
    seed,
    direct,
    playIn,
    playInResult:  null,
    playInWinner:  null,
    swiss:         null, // montado após play-in
    knockout:      null, // montado após Swiss
  };
}

function runWorldsPlayInAI(worlds, playerTeamId = null) {
  // Simplified: se player está no play-in, precisa de interação da UI
  // Para AI completa:
  const playInResult = _runPlayInDE(worlds.playIn, worlds.seed + '_playin');
  const playInWinner = playInResult.winner;

  const swissTeams = [...worlds.direct, playInWinner]
    .sort((a, b) => (a.intlSeed || a.seed) - (b.intlSeed || b.seed))
    .map((t, i) => ({ ...t, swissSeed: i + 1, wins: 0, losses: 0 }));

  const swiss = _initSwiss(swissTeams);
  return { ...worlds, playInResult, playInWinner, swiss };
}

function runWorldsSwissAI(worlds, playerTeamId = null) {
  if (!worlds.swiss) throw new Error('Swiss não iniciado (play-in não terminou?)');
  const swiss = runSwissAI(worlds.swiss, worlds.seed + '_swiss', playerTeamId);
  return { ...worlds, swiss };
}

function runWorldsKnockoutAI(worlds, playerTeamId = null) {
  if (!worlds.swiss) throw new Error('Swiss não concluído');
  const { qualified, teams: swissTeams } = worlds.swiss;

  const koTeams = qualified
    .map(id => swissTeams.find(t => t.id === id))
    .filter(Boolean)
    .sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      return a.swissSeed - b.swissSeed;
    })
    .slice(0, 8);

  let knockout = generatePlayoffBracket(koTeams, worlds.seed + '_ko', 5);
  knockout = advanceBracketAI(knockout, playerTeamId || '__none__', worlds.seed + '_ko');
  return { ...worlds, knockout };
}

/* ── Exports ──────────────────────────────────────────────────────────── */
const __api = {
  generateFST, runFSTAI,
  generateMSI, runMSIPlayInAI, runMSIBracketAI,
  generateWorlds, runWorldsPlayInAI, runWorldsSwissAI, runWorldsKnockoutAI,
  // internals exportados para testes
  _initSwiss, _pairSwissRound, _resolveSwissRound, runSwissAI,
};
if (typeof module !== 'undefined' && module.exports) module.exports = __api;
if (typeof globalThis !== 'undefined') { (globalThis.Career = globalThis.Career || {}).international = __api; }

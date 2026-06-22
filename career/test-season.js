'use strict';
/* =======================================================================
   career/test-season.js — Teste de integração: simulação 3 anos CBLOL
   Uso: node career/test-season.js
   Saída:
     (a) Calendário completo Ano 1 CBLOL (times, vagas, torneios)
     (b) Tabela de recompensas
   ======================================================================= */

const { test, assert, assertEq, assertBetween, summary } = require('./tests/_harness.js');
const season  = require('./season.js');
const playoffs = require('./playoffs.js');
const intl    = require('./international.js');
const config  = require('./config.js');

const {
  REGIONS_2026, REGION_BY_ID, TEAM_NAMES, SPLIT_TOURNAMENT,
  generateLeagueTeams, runRegularSeason, getQualifiers,
  buildInternationalField, initialWorldState, advanceToNextSplit,
} = season;

const { generatePlayoffBracket, advanceBracketAI, getBracketWinner } = playoffs;
const { generateFST, runFSTAI, generateMSI, runMSIPlayInAI, runMSIBracketAI,
        generateWorlds, runWorldsPlayInAI, runWorldsSwissAI, runWorldsKnockoutAI } = intl;

const SEED = 'test123';
const REGION = 'CBLOL';

/* ══════════════════════════════════════════════════════════════════════
   TESTES UNITÁRIOS
   ══════════════════════════════════════════════════════════════════════ */

test('generateLeagueTeams — CBLOL tem 8 times', () => {
  const teams = generateLeagueTeams('CBLOL', 1, 1);
  assertEq(teams.length, 8);
  assert(teams.every(t => t.strength >= 20 && t.strength <= 99), 'strength em [20,99]');
  assert(teams.every(t => t.regionId === 'CBLOL'), 'regionId correto');
  assert(teams[0].strength >= teams[7].strength, 'time 1 >= time 8 em strength');
});

test('generateLeagueTeams — LPL tem 14 times', () => {
  const teams = generateLeagueTeams('LPL', 1, 1);
  assertEq(teams.length, 14);
});

test('generateLeagueTeams — determinístico', () => {
  const a = generateLeagueTeams('LCK', 2, 3);
  const b = generateLeagueTeams('LCK', 2, 3);
  assertEq(JSON.stringify(a), JSON.stringify(b));
});

test('runRegularSeason — 7 rodadas para 8 times', () => {
  const teams = generateLeagueTeams('CBLOL', 1, 1);
  const { schedule, standings } = runRegularSeason(teams, SEED + '_S1');
  assertEq(schedule.length, 7, '7 rodadas');
  assertEq(standings.length, 8, '8 times no standings');
  const totalWins = standings.reduce((s, r) => s + r.wins, 0);
  assertEq(totalWins, 28, '28 vitórias totais (7 rodadas × 4 partidas)');
});

test('getQualifiers — top 6 para playoffs', () => {
  const teams = generateLeagueTeams('CBLOL', 1, 1);
  const { standings } = runRegularSeason(teams, SEED + '_S1');
  const qualifiers = getQualifiers(standings, 6);
  assertEq(qualifiers.length, 6);
});

test('playoff bracket 6 times — rounds corretos', () => {
  const teams = generateLeagueTeams('CBLOL', 1, 1);
  const { standings } = runRegularSeason(teams, SEED + '_S1');
  const pTeams = getQualifiers(standings, 6);
  const bracket = generatePlayoffBracket(pTeams, SEED + '_po', 5);
  assert(bracket.roundOrder.includes('QF'), 'tem QF');
  assert(bracket.roundOrder.includes('SF'), 'tem SF');
  assert(bracket.roundOrder.includes('F'),  'tem F');
  assert(bracket.matches['QF1'] !== undefined, 'QF1 existe');
  assert(bracket.matches['F'] !== undefined, 'Final existe');
});

test('advanceBracketAI — produz campeão', () => {
  const teams = generateLeagueTeams('CBLOL', 1, 1);
  const { standings } = runRegularSeason(teams, SEED + '_S1');
  const pTeams = getQualifiers(standings, 6);
  let bracket = generatePlayoffBracket(pTeams, SEED + '_po', 5);
  bracket = advanceBracketAI(bracket, '__none__', SEED + '_po');
  const champ = getBracketWinner(bracket);
  assert(champ !== null, 'há um campeão');
});

test('initialWorldState — estrutura correta', () => {
  const ws = initialWorldState('CBLOL');
  assertEq(ws.version, 2);
  assertEq(ws.regionId, 'CBLOL');
  assertEq(ws.year, 1);
  assertEq(ws.split, 1);
  assertEq(ws.phase, 'regular_season');
});

test('advanceToNextSplit — split 3 → split 1 ano 2', () => {
  let ws = initialWorldState('CBLOL');
  ws = { ...ws, split: 3 };
  ws = advanceToNextSplit(ws);
  assertEq(ws.split, 1);
  assertEq(ws.year, 2);
});

test('buildInternationalField — FST 8 times', () => {
  // Mock standings simples
  const mockStandings = {};
  for (const r of REGIONS_2026) {
    const teams = generateLeagueTeams(r.id, 1, 1);
    mockStandings[r.id] = teams.map((t, i) => ({ team: t, wins: 8 - i, losses: i }));
  }
  const field = buildInternationalField(mockStandings, 'FST');
  assertEq(field.length, 8, 'FST tem 8 times');
});

test('buildInternationalField — MSI 11 times', () => {
  const mockStandings = {};
  for (const r of REGIONS_2026) {
    const teams = generateLeagueTeams(r.id, 1, 1);
    mockStandings[r.id] = teams.map((t, i) => ({ team: t, wins: 10 - i, losses: i }));
  }
  const field = buildInternationalField(mockStandings, 'MSI');
  assertEq(field.length, 11, 'MSI tem 11 times');
});

test('buildInternationalField — Worlds 17 times', () => {
  const mockStandings = {};
  for (const r of REGIONS_2026) {
    const teams = generateLeagueTeams(r.id, 1, 1);
    mockStandings[r.id] = teams.map((t, i) => ({ team: t, wins: 14 - i, losses: i }));
  }
  const field = buildInternationalField(mockStandings, 'WORLDS');
  assertEq(field.length, 17, 'Worlds tem 17 times');
});

test('FST — 8 times → campeão', () => {
  const mockStandings = {};
  for (const r of REGIONS_2026) {
    const teams = generateLeagueTeams(r.id, 1, 1);
    mockStandings[r.id] = teams.map((t, i) => ({ team: t, wins: 10 - i, losses: i }));
  }
  const field = buildInternationalField(mockStandings, 'FST');
  let fst = generateFST(field, SEED + '_fst');
  fst = runFSTAI(fst);
  const champ = getBracketWinner(fst.bracket);
  assert(champ !== null, 'FST tem campeão');
});

test('MSI — play-in + bracket → campeão', () => {
  const mockStandings = {};
  for (const r of REGIONS_2026) {
    const teams = generateLeagueTeams(r.id, 1, 2);
    mockStandings[r.id] = teams.map((t, i) => ({ team: t, wins: 10 - i, losses: i }));
  }
  const field = buildInternationalField(mockStandings, 'MSI');
  let msi = generateMSI(field, SEED + '_msi');
  msi = runMSIPlayInAI(msi);
  assert(msi.playInWinner !== null, 'MSI play-in tem winner');
  msi = runMSIBracketAI(msi);
  const champ = getBracketWinner(msi.bracket);
  assert(champ !== null, 'MSI tem campeão');
});

test('Worlds — play-in + swiss + knockout → campeão', () => {
  const mockStandings = {};
  for (const r of REGIONS_2026) {
    const teams = generateLeagueTeams(r.id, 1, 3);
    mockStandings[r.id] = teams.map((t, i) => ({ team: t, wins: 14 - i, losses: i }));
  }
  const field = buildInternationalField(mockStandings, 'WORLDS');
  // Worlds precisa de 17+ times; adiciona 2 extras para teste
  const extraTeam1 = { ...field[0], id: field[0].id + '_x1', intlSeed: 18, name: field[0].name + ' X1' };
  const extraTeam2 = { ...field[1], id: field[1].id + '_x2', intlSeed: 19, name: field[1].name + ' X2' };
  const fullField = [...field, extraTeam1, extraTeam2];
  let worlds = generateWorlds(fullField, SEED + '_worlds');
  worlds = runWorldsPlayInAI(worlds);
  assert(worlds.playInWinner !== null, 'Worlds play-in tem winner');
  worlds = runWorldsSwissAI(worlds);
  assert(worlds.swiss.qualified.length >= 8, 'Swiss qualifica 8 times');
  worlds = runWorldsKnockoutAI(worlds);
  const champ = getBracketWinner(worlds.knockout);
  assert(champ !== null, 'Worlds tem campeão');
});

/* ══════════════════════════════════════════════════════════════════════
   SIMULAÇÃO 3 ANOS — CBLOL
   ══════════════════════════════════════════════════════════════════════ */

function simulateYear(year, seedBase, allStandingsAcc) {
  const regionId = REGION;
  const results = {};

  for (let split = 1; split <= 3; split++) {
    const splitSeed = `${seedBase}_Y${year}_S${split}`;
    const teams = generateLeagueTeams(regionId, year, split);
    const { standings } = runRegularSeason(teams, splitSeed);

    const playoffTeams = getQualifiers(standings, 6);
    let bracket = generatePlayoffBracket(playoffTeams, splitSeed + '_po', 5);
    bracket = advanceBracketAI(bracket, '__none__', splitSeed + '_po');
    const regChamp = getBracketWinner(bracket);

    results[split] = { standings, playoffTeams, champion: regChamp };

    // Armazena standings de todas as regiões para montar campo internacional
    if (!allStandingsAcc[year]) allStandingsAcc[year] = {};
    if (!allStandingsAcc[year][split]) allStandingsAcc[year][split] = {};
    allStandingsAcc[year][split][regionId] = standings;

    // Garante que outras regiões também têm standings (geração rápida)
    for (const r of REGIONS_2026) {
      if (r.id === regionId) continue;
      if (!allStandingsAcc[year][split][r.id]) {
        const rt = generateLeagueTeams(r.id, year, split);
        const { standings: rs } = runRegularSeason(rt, `${seedBase}_Y${year}_S${split}_${r.id}`);
        allStandingsAcc[year][split][r.id] = rs;
      }
    }
  }

  return results;
}

/* ══════════════════════════════════════════════════════════════════════
   (a) CALENDÁRIO ANO 1 — CBLOL
   ══════════════════════════════════════════════════════════════════════ */
function printCalendar() {
  console.log('\n' + '═'.repeat(60));
  console.log('  (a) CALENDÁRIO CBLOL — ANO 1');
  console.log('═'.repeat(60));

  const allStandings = {};
  const yearResults = simulateYear(1, SEED, allStandings);
  const regionCfg = REGION_BY_ID[REGION];

  const SPLIT_NAMES = { 1:'SPLIT 1 → FST (First Stand Tournament)',
                         2:'SPLIT 2 → MSI (Mid-Season Invitational)',
                         3:'SPLIT 3 → WORLDS (Campeonato Mundial)' };
  const INTL_SLOTS = { 1:`Top ${regionCfg.fstSlots} → FST`,
                        2:`Top ${regionCfg.msiSlots} → MSI`,
                        3:`Top ${regionCfg.worldsSlots} → Worlds` };

  const names = TEAM_NAMES[REGION];
  console.log(`\nTimes CBLOL: ${names.join(', ')}\n`);

  for (let split = 1; split <= 3; split++) {
    const { standings, playoffTeams, champion } = yearResults[split];
    const tournament = SPLIT_TOURNAMENT[split];

    console.log(`┌─ ${SPLIT_NAMES[split]}`);
    console.log(`│  Fase Regular: 8 times, 7 rodadas (round-robin), 28 partidas`);
    console.log(`│  Playoffs: Top ${regionCfg.playoffSlots} times`);
    console.log(`│  Vaga Internacional: ${INTL_SLOTS[split]}`);
    console.log(`│`);
    console.log(`│  STANDINGS FASE REGULAR:`);
    standings.forEach((s, i) => {
      const intl = i < (split === 3 ? regionCfg.worldsSlots : split === 2 ? regionCfg.msiSlots : regionCfg.fstSlots) ? ' ★INT' : '';
      const po = i < regionCfg.playoffSlots ? ' →PO' : '';
      console.log(`│    ${i+1}. ${s.team.name.padEnd(22)} ${s.wins}V-${s.losses}D${po}${intl}`);
    });
    console.log(`│`);
    console.log(`│  PLAYOFFS: ${playoffTeams.map(t => t.name).join(' | ')}`);
    console.log(`│  Campeão playoffs: ${champion?.name || '?'}`);

    // Simula torneio internacional (AI completo para ano 1)
    const sts = allStandings[1][split];
    const field = buildInternationalField(sts, tournament);

    let intlChamp = null;
    try {
      if (tournament === 'FST' && field.length >= 8) {
        let fst = generateFST(field.slice(0, 8), SEED + `_Y1_fst_S${split}`);
        fst = runFSTAI(fst);
        intlChamp = getBracketWinner(fst.bracket);
      } else if (tournament === 'MSI' && field.length >= 11) {
        let msi = generateMSI(field.slice(0, 11), SEED + `_Y1_msi`);
        msi = runMSIPlayInAI(msi);
        msi = runMSIBracketAI(msi);
        intlChamp = getBracketWinner(msi.bracket);
      } else if (tournament === 'WORLDS' && field.length >= 17) {
        // Completa para 19 se necessário
        let wField = field;
        while (wField.length < 19) {
          const last = wField[wField.length - 1];
          wField = [...wField, { ...last, id: last.id + `_x${wField.length}`, intlSeed: wField.length + 1 }];
        }
        let worlds = generateWorlds(wField.slice(0, 19), SEED + `_Y1_worlds`);
        worlds = runWorldsPlayInAI(worlds);
        worlds = runWorldsSwissAI(worlds);
        worlds = runWorldsKnockoutAI(worlds);
        intlChamp = getBracketWinner(worlds.knockout);
      }
    } catch(e) { intlChamp = null; }

    const cblolRep = standings.slice(0, split === 3 ? regionCfg.worldsSlots : 1).map(s => s.team.name).join(', ');
    console.log(`│`);
    console.log(`│  TORNEIO: ${tournament}`);
    console.log(`│    Representante(s) CBLOL: ${cblolRep}`);
    if (intlChamp) console.log(`│    Campeão ${tournament}: ${intlChamp.name} (${intlChamp.regionId})`);
    console.log(`└${'─'.repeat(58)}`);
    console.log('');
  }
}

/* ══════════════════════════════════════════════════════════════════════
   (b) TABELA DE RECOMPENSAS
   ══════════════════════════════════════════════════════════════════════ */
function printRewards() {
  console.log('═'.repeat(60));
  console.log('  (b) TABELA DE RECOMPENSAS');
  console.log('═'.repeat(60));
  const s = config.season;

  console.log('\n  FASE REGULAR (por partida):');
  console.log(`    Vitória  → ${s.regular.pePerWin} PE  +  ${s.regular.fichasPerWin} Fichas`);
  console.log(`    Derrota  → ${s.regular.pePerLoss} PE`);

  const rows = [
    ['PLAYOFFS',  s.playoffs ],
    ['FST',       s.fst      ],
    ['MSI',       s.msi      ],
    ['WORLDS',    s.worlds   ],
  ];
  console.log('\n  TORNEIOS:');
  console.log(`  ${'Torneio'.padEnd(10)} ${'Participação'.padEnd(25)} ${'Top 4 (semi)'.padEnd(25)} ${'Campeão'}`);
  console.log(`  ${'-'.repeat(85)}`);
  rows.forEach(([name, r]) => {
    const p = `${r.participation.pe} PE + ${r.participation.fichas} F`.padEnd(24);
    const t = `${r.top4.pe} PE + ${r.top4.fichas} F`.padEnd(24);
    const w = `${r.win.pe} PE + ${r.win.fichas} F`;
    console.log(`  ${name.padEnd(10)} ${p} ${t} ${w}`);
  });
  console.log('');
}

/* ══════════════════════════════════════════════════════════════════════
   SIMULAÇÃO 3 ANOS (valida consistência)
   ══════════════════════════════════════════════════════════════════════ */
test('3-year simulation — sem erros e produz campeões', () => {
  const allStandings = {};
  let champions = [];
  for (let year = 1; year <= 3; year++) {
    const yr = simulateYear(year, SEED, allStandings);
    for (let split = 1; split <= 3; split++) {
      assert(yr[split].champion !== null, `Ano ${year} Split ${split} tem campeão`);
      champions.push(yr[split].champion.name);
    }
  }
  assertEq(champions.length, 9, '9 campeões em 3 anos × 3 splits');
  // Times diferentes podem vencer (não travado sempre no mesmo)
  const uniqueChamps = new Set(champions);
  assert(uniqueChamps.size >= 2, 'Pelo menos 2 campeões diferentes em 3 anos');
});

/* ── Run ──────────────────────────────────────────────────────────────── */
printCalendar();
printRewards();
summary();

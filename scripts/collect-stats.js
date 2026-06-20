// scripts/collect-stats.js
// Coleta winrates e matchups reais via Riot API oficial.
// REGRA: RIOT_API_KEY só existe em process.env — NUNCA hardcode.
//
// Uso:
//   RIOT_API_KEY=RGAPI-xxx node scripts/collect-stats.js
//
// Saída: data/stats-snapshot.json

'use strict';
const fs   = require('fs');
const path = require('path');

// ============================================================
// CONFIGURAÇÃO — ajuste aqui antes de rodar
// ============================================================
const PLATFORMS            = ['br1', 'na1', 'euw1', 'kr'];
const SUMMONERS_PER_PLAT   = 60;   // summoners amostrados por plataforma
const MAX_CALLS            = 1500; // orçamento total de chamadas à API
const CALL_DELAY_MS        = 1250; // ~48 calls/min — seguro abaixo de 50/min

// ============================================================
// MAPEAMENTOS
// ============================================================
const PLATFORM_TO_CLUSTER = {
  br1:'americas', na1:'americas', la1:'americas', la2:'americas',
  kr:'asia',      jp1:'asia',
  euw1:'europe',  eun1:'europe', tr1:'europe', ru:'europe',
  oc1:'sea',      ph2:'sea', sg2:'sea', th2:'sea', tw2:'sea', vn2:'sea',
};

const TEAM_POS = {
  TOP:'top', JUNGLE:'jungle', MIDDLE:'mid', BOTTOM:'adc', UTILITY:'support',
};

// ============================================================
// ESTADO
// ============================================================
const KEY = process.env.RIOT_API_KEY;
if (!KEY) {
  console.error('ERRO: variável RIOT_API_KEY não definida.\nExemplo: RIOT_API_KEY=RGAPI-xxx node scripts/collect-stats.js');
  process.exit(1);
}

let callCount   = 0;
let matchesSeen = new Set(); // evita buscar a mesma partida duas vezes
const stats = {
  generatedAt : null,
  sampleGames : 0,
  byChampion  : {},  // { ChampName: { role: { games, wins } } }
  byMatchup   : {},  // { role: { "ChampA-ChampB": { games, winsA } } }
};

// ============================================================
// HTTP helpers
// ============================================================
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function riotGet(url) {
  if (callCount >= MAX_CALLS) throw Object.assign(new Error('budget'), { code: 'BUDGET' });

  await sleep(CALL_DELAY_MS);
  callCount++;

  let resp;
  try {
    // Headers NÃO são logados — chave permanece oculta
    resp = await fetch(url, { headers: { 'X-Riot-Token': KEY } });
  } catch (e) {
    throw new Error(`fetch falhou: ${e.message}`);
  }

  if (resp.status === 429) {
    // Respeitar Retry-After obrigatório
    const wait = (parseInt(resp.headers.get('retry-after') || '5', 10) + 2) * 1000;
    console.log(`  429 rate-limit — aguardando ${wait / 1000}s...`);
    await sleep(wait);
    callCount--; // não consumir orçamento na tentativa bloqueada
    return riotGet(url);
  }

  if (resp.status === 404) throw Object.assign(new Error('not_found'), { status: 404 });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} em ${url.replace(/\?.*/, '')}`);
  return resp.json();
}

// ============================================================
// Funções de domínio
// ============================================================
async function getSummonerIds(platform) {
  const base = `https://${platform}.api.riotgames.com/lol/league/v4`;
  const queues = ['challengerleagues', 'grandmasterleagues', 'masterleagues'];
  const ids = new Set();

  for (const q of queues) {
    try {
      const data = await riotGet(`${base}/${q}/by-queue/RANKED_SOLO_5x5`);
      const entries = data.entries || [];
      for (const e of entries) {
        if (e.summonerId) ids.add(e.summonerId);
        if (ids.size >= SUMMONERS_PER_PLAT * 2) break; // buffer para deduplicação
      }
    } catch (e) {
      if (e.code === 'BUDGET') throw e;
      console.warn(`  aviso: ${platform} ${q} — ${e.message}`);
    }
    if (ids.size >= SUMMONERS_PER_PLAT * 2) break;
  }

  return [...ids].slice(0, SUMMONERS_PER_PLAT);
}

async function getPuuid(platform, summonerId) {
  const data = await riotGet(
    `https://${platform}.api.riotgames.com/lol/summoner/v4/summoners/${summonerId}`,
  );
  return data.puuid;
}

async function getMatchIds(cluster, puuid) {
  const data = await riotGet(
    `https://${cluster}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?count=10&queue=420`,
  );
  return Array.isArray(data) ? data : [];
}

function recordChampion(name, role, win) {
  if (!stats.byChampion[name]) stats.byChampion[name] = {};
  if (!stats.byChampion[name][role]) stats.byChampion[name][role] = { games: 0, wins: 0 };
  stats.byChampion[name][role].games++;
  if (win) stats.byChampion[name][role].wins++;
}

function recordMatchup(role, champA, champB, winsA) {
  if (!stats.byMatchup[role]) stats.byMatchup[role] = {};
  const key = `${champA}-${champB}`;
  if (!stats.byMatchup[role][key]) stats.byMatchup[role][key] = { games: 0, winsA: 0 };
  stats.byMatchup[role][key].games++;
  if (winsA) stats.byMatchup[role][key].winsA++;
}

async function processMatch(cluster, matchId) {
  const data = await riotGet(
    `https://${cluster}.api.riotgames.com/lol/match/v5/matches/${matchId}`,
  );

  const participants = data?.info?.participants;
  if (!Array.isArray(participants) || participants.length < 10) return;

  // Agrupa por teamId + posição
  const byTeam = { 100: {}, 200: {} };
  for (const p of participants) {
    const role = TEAM_POS[p.teamPosition];
    if (!role || !p.championName) continue;
    const tid = p.teamId === 100 ? 100 : 200;
    byTeam[tid][role] = { champ: p.championName, win: !!p.win };
  }

  for (const role of ['top', 'jungle', 'mid', 'adc', 'support']) {
    const blue = byTeam[100][role];
    const red  = byTeam[200][role];
    if (!blue || !red) continue;

    recordChampion(blue.champ, role, blue.win);
    recordChampion(red.champ,  role, red.win);
    // matchup: blue como "A", red como "B"
    recordMatchup(role, blue.champ, red.champ, blue.win);
  }
  stats.sampleGames++;
}

// ============================================================
// Loop principal
// ============================================================
async function main() {
  console.log(`DraftLoL — collect-stats.js`);
  console.log(`Plataformas: ${PLATFORMS.join(', ')} | Budget: ${MAX_CALLS} calls | Delay: ${CALL_DELAY_MS}ms`);
  console.log(`Início: ${new Date().toISOString()}\n`);

  for (const plat of PLATFORMS) {
    if (callCount >= MAX_CALLS) { console.log('Budget esgotado, encerrando.'); break; }
    const cluster = PLATFORM_TO_CLUSTER[plat];
    console.log(`[${plat}] buscando summoners...`);

    let summonerIds;
    try { summonerIds = await getSummonerIds(plat); }
    catch (e) {
      if (e.code === 'BUDGET') break;
      console.warn(`  erro ao buscar league ${plat}: ${e.message}`); continue;
    }
    console.log(`  ${summonerIds.length} summoners obtidos`);

    const matchIds = [];
    for (const sid of summonerIds) {
      if (callCount >= MAX_CALLS) break;
      try {
        const puuid = await getPuuid(plat, sid);
        const ids   = await getMatchIds(cluster, puuid);
        for (const id of ids) {
          if (!matchesSeen.has(id)) { matchesSeen.add(id); matchIds.push({ id, cluster }); }
        }
      } catch (e) {
        if (e.code === 'BUDGET') break;
        if (e.status !== 404) console.warn(`  aviso summoner/match-ids: ${e.message}`);
      }
    }
    console.log(`  ${matchIds.length} partidas novas para processar`);

    for (const { id, cluster: cl } of matchIds) {
      if (callCount >= MAX_CALLS) break;
      try { await processMatch(cl, id); }
      catch (e) {
        if (e.code === 'BUDGET') break;
        if (e.status !== 404) console.warn(`  aviso match ${id}: ${e.message}`);
      }
    }
    console.log(`  partidas processadas até agora: ${stats.sampleGames} | calls usadas: ${callCount}`);
  }

  stats.generatedAt = new Date().toISOString();

  const outDir  = path.join(__dirname, '..', 'data');
  const outFile = path.join(outDir, 'stats-snapshot.json');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(stats, null, 2), 'utf8');

  console.log(`\n=== Concluído ===`);
  console.log(`  Partidas amostradas : ${stats.sampleGames}`);
  console.log(`  Campeões com dados  : ${Object.keys(stats.byChampion).length}`);
  console.log(`  Calls à API usadas  : ${callCount} / ${MAX_CALLS}`);
  console.log(`  Arquivo gerado      : ${outFile}`);
}

main().catch(e => {
  // Nunca imprimir e.stack ou headers completos — podem conter tokens de autenticação
  console.error('Erro fatal:', e.message || String(e));
  process.exit(1);
});

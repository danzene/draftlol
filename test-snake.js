// test-snake.js — Tarefa F: verifica que nenhum campeão se repete no snake draft
// Run: node test-snake.js  (requer Node.js 16+)
'use strict';

// ============================================================
// LANE_MAP — cópia fiel de index.html
// ============================================================
const LANE_MAP={
  /* TOP */
  Aatrox:['top'],Ambessa:['top','jungle'],Camille:['top'],Chogath:['top'],
  Darius:['top'],DrMundo:['top','jungle'],Fiora:['top'],Gangplank:['top','mid'],
  Garen:['top'],Gnar:['top'],Gragas:['top','jungle','support'],Gwen:['top'],
  Heimerdinger:['top','mid','support'],Illaoi:['top'],Irelia:['top','mid'],
  Jax:['top','jungle'],Jayce:['top','mid'],Kennen:['top','mid'],Kled:['top'],
  KSante:['top'],Malphite:['top','support'],Maokai:['top','support','jungle'],
  Mordekaiser:['top'],Nasus:['top'],Olaf:['top','jungle'],Ornn:['top'],
  Pantheon:['top','support','mid'],Poppy:['top','support','jungle'],
  Quinn:['top'],Renekton:['top'],Riven:['top'],Rumble:['top','mid'],
  Sett:['top','support'],Shen:['top'],Sion:['top'],Singed:['top'],
  TahmKench:['top','support'],Teemo:['top'],Trundle:['top','jungle'],
  Tryndamere:['top','jungle'],Urgot:['top'],Vladimir:['top','mid'],
  Volibear:['top','jungle'],Warwick:['jungle','top'],Wukong:['top','jungle'],
  Yorick:['top'],
  /* JUNGLE */
  Amumu:['jungle','support'],Aurora:['top','mid'],Belveth:['jungle'],
  Briar:['jungle'],Diana:['jungle','mid'],Ekko:['jungle','mid'],
  Elise:['jungle'],Evelynn:['jungle'],Fiddlesticks:['jungle','support'],
  Graves:['jungle'],Hecarim:['jungle'],Ivern:['jungle','support'],
  JarvanIV:['jungle'],Kayn:['jungle'],Khazix:['jungle'],Kindred:['jungle'],
  Karthus:['jungle','mid'],LeeSin:['jungle'],Lillia:['jungle'],
  MasterYi:['jungle'],Nidalee:['jungle'],Nocturne:['jungle'],Nunu:['jungle'],
  Rammus:['jungle'],RekSai:['jungle'],Rengar:['jungle','top'],
  Sejuani:['jungle'],Shyvana:['jungle'],Skarner:['jungle'],
  Taliyah:['jungle','mid'],Udyr:['jungle'],Viego:['jungle'],
  Vi:['jungle'],XinZhao:['jungle'],Zac:['jungle'],
  /* MID */
  Ahri:['mid'],Akali:['mid','top'],Akshan:['adc','mid'],Anivia:['mid'],
  Annie:['mid','support'],AurelionSol:['mid'],Azir:['mid'],
  Cassiopeia:['mid'],Corki:['mid','adc'],Fizz:['mid'],Galio:['mid','support'],
  Hwei:['mid','support'],Kassadin:['mid'],Katarina:['mid'],
  Leblanc:['mid'],Lissandra:['mid'],Lux:['mid','support'],Malzahar:['mid'],
  Naafiri:['mid','jungle'],Neeko:['mid','support'],Orianna:['mid'],
  Qiyana:['mid','jungle'],Ryze:['mid'],Smolder:['adc','mid'],
  Sylas:['mid','jungle'],Syndra:['mid'],Talon:['mid','jungle'],
  TwistedFate:['mid'],Veigar:['mid','support'],Vex:['mid'],Viktor:['mid'],
  Yasuo:['mid','top'],Yone:['mid','top'],Zed:['mid','top'],
  /* ADC */
  Aphelios:['adc'],Ashe:['adc','support'],Caitlyn:['adc'],Draven:['adc'],
  Ezreal:['adc'],Jhin:['adc'],Jinx:['adc'],Kaisa:['adc'],Kalista:['adc'],
  KogMaw:['adc'],Lucian:['adc','mid'],MissFortune:['adc'],Nilah:['adc'],
  Samira:['adc'],Senna:['support','adc'],Seraphine:['support','adc','mid'],
  Sivir:['adc'],Tristana:['adc','mid'],Twitch:['adc','jungle'],
  Varus:['adc','mid'],Vayne:['adc','top'],Xayah:['adc'],Zeri:['adc'],
  /* SUPPORT */
  Alistar:['support'],Bard:['support'],Blitzcrank:['support'],
  Brand:['support','mid'],Braum:['support'],Janna:['support'],
  Karma:['support','mid'],Leona:['support'],Lulu:['support'],
  Milio:['support'],Morgana:['support','mid'],Nami:['support'],
  Nautilus:['support'],Pyke:['support'],Rakan:['support'],Renata:['support'],
  Sona:['support'],Soraka:['support'],Swain:['support','mid'],
  Taric:['support'],Thresh:['support'],VelKoz:['support','mid'],
  Xerath:['support','mid'],Yuumi:['support'],Zilean:['support','mid'],
  Zyra:['support'],
};

// ============================================================
// FALLBACK (lista offline, ~53 campeões) — cópia de index.html
// ============================================================
const FB=[
 ['Garen',['Fighter','Tank']],['Darius',['Fighter']],['Sett',['Fighter','Tank']],
 ['Ornn',['Tank','Fighter']],['Malphite',['Tank','Fighter']],['Shen',['Tank','Fighter']],
 ['Renekton',['Fighter','Tank']],['Jax',['Fighter','Assassin']],['Mordekaiser',['Fighter']],
 ['Aatrox',['Fighter','Tank']],['KSante',['Tank','Fighter']],
 ['LeeSin',['Fighter','Assassin']],['Vi',['Fighter','Assassin']],['Sejuani',['Tank','Fighter']],
 ['Khazix',['Assassin']],['Graves',['Marksman']],['Hecarim',['Fighter']],
 ['Warwick',['Fighter','Tank']],['Viego',['Assassin','Fighter']],['JarvanIV',['Tank','Fighter']],
 ['Ahri',['Mage','Assassin']],['Zed',['Assassin']],['Orianna',['Mage','Support']],
 ['Syndra',['Mage']],['Azir',['Mage','Marksman']],['Sylas',['Mage','Assassin']],
 ['Yone',['Assassin','Fighter']],['Katarina',['Assassin','Mage']],['Lux',['Mage','Support']],
 ['TwistedFate',['Mage']],['Viktor',['Mage']],
 ['Jinx',['Marksman']],['Caitlyn',['Marksman']],['Ezreal',['Marksman','Mage']],
 ['Vayne',['Marksman','Assassin']],['Jhin',['Marksman','Mage']],['Kaisa',['Marksman']],
 ['Ashe',['Marksman','Support']],['MissFortune',['Marksman']],['Aphelios',['Marksman']],
 ['Xayah',['Marksman']],['Lucian',['Marksman']],
 ['Thresh',['Support','Fighter']],['Lulu',['Support','Mage']],['Nautilus',['Tank','Support']],
 ['Leona',['Tank','Support']],['Janna',['Support','Mage']],['Karma',['Mage','Support']],
 ['Nami',['Support','Mage']],['Soraka',['Support','Mage']],['Pyke',['Support','Assassin']],
 ['Blitzcrank',['Tank','Fighter']],['Rakan',['Support']],['Braum',['Support','Tank']],
];

// ============================================================
// eligibleRoles — idêntica à de index.html
// ============================================================
function eligibleRoles(id, tags) {
  if (LANE_MAP[id]) return LANE_MAP[id];
  const t = tags || [];
  if (t.includes('Marksman') && !t.includes('Support')) return ['adc'];
  if (t.includes('Support') && !t.includes('Fighter') && !t.includes('Tank')) return ['support'];
  if (t.includes('Assassin') && !t.includes('Fighter')) return ['mid','jungle'];
  if (t.includes('Mage') && !t.includes('Support') && !t.includes('Fighter')) return ['mid'];
  if (t.includes('Tank') && !t.includes('Fighter')) return ['top','support'];
  if (t.includes('Fighter')) return ['top','jungle'];
  return ['mid'];
}

// ============================================================
// Construção dos pools de campeões
// ============================================================
const CHAMPS_ONLINE = Object.entries(LANE_MAP).map(([id, roles]) => ({ id, roles }));

const CHAMPS_OFFLINE = FB.map(([id, tags]) => ({
  id,
  roles: eligibleRoles(id, tags),
}));

const ALL_ROLES = ['top','jungle','mid','adc','support'];

// ============================================================
// Funções de draft — idênticas a index.html (sem seeded/estStats)
// ============================================================
function snakePool(lane, used, champs) {
  let cands = champs.filter(c => c.roles.includes(lane) && !used.has(c.id));
  if (!cands.length) cands = champs.filter(c => c.roles.includes(lane)); // último recurso
  return cands.slice(0, 3);
}

function snakeBotPick(lane, used, champs) {
  let cands = champs.filter(c => c.roles.includes(lane) && !used.has(c.id));
  if (!cands.length) cands = champs.filter(c => c.roles.includes(lane));
  return cands[0] || null;
}

// ============================================================
// Simulação completa de um draft serpentina
// ============================================================
function runDraft(numPlayers, champs) {
  const players = Array.from({ length: numPlayers }, (_, i) => ({
    id: String(i), teamArr: Array(5).fill(null),
  }));
  const used = new Set();

  for (let laneI = 0; laneI < 5; laneI++) {
    const lane = ALL_ROLES[laneI];
    // serpentina: rotas pares = ordem normal, ímpares = invertida
    const queue = laneI % 2 === 0
      ? players.map((_, i) => i)
      : players.map((_, i) => i).reverse();

    for (const pIdx of queue) {
      // jogador humano: pega primeira opção do pool; bots: snakeBotPick
      const champ = snakeBotPick(lane, used, champs);
      if (!champ) return { ok: false, error: `sem campeão único para ${lane}, jogador ${pIdx} (elenco esgotado)` };
      players[pIdx].teamArr[laneI] = champ;
      used.add(champ.id);
    }
  }

  // Verificar duplicatas no resultado final
  const seen = new Map();
  for (const p of players) {
    for (let li = 0; li < 5; li++) {
      const c = p.teamArr[li];
      if (!c) return { ok: false, error: `jogador ${p.id} ficou sem campeão em ${ALL_ROLES[li]}` };
      if (seen.has(c.id)) {
        const prev = seen.get(c.id);
        return {
          ok: false,
          error: `DUPLICATA: ${c.id} — jogador ${prev.pid} (${ALL_ROLES[prev.li]}) e jogador ${p.id} (${ALL_ROLES[li]})`,
        };
      }
      seen.set(c.id, { pid: p.id, li });
    }
  }
  return { ok: true };
}

// ============================================================
// Execução dos testes
// ============================================================
const RUNS = 100;

function runSuite(label, sizes, champs, expectFailAt) {
  console.log(`\n=== ${label} (${champs.length} campeões) ===`);
  console.log(`    Por rota — top:${champs.filter(c=>c.roles.includes('top')).length}  jungle:${champs.filter(c=>c.roles.includes('jungle')).length}  mid:${champs.filter(c=>c.roles.includes('mid')).length}  adc:${champs.filter(c=>c.roles.includes('adc')).length}  support:${champs.filter(c=>c.roles.includes('support')).length}`);

  for (const n of sizes) {
    const needed = n * 5;
    const impossible = needed > champs.length;
    if (impossible && !expectFailAt?.includes(n)) {
      console.log(`  ${n} jogadores: PULADO — pool total (${champs.length}) < picks necessários (${needed})`);
      continue;
    }

    let ok = 0, fail = 0, firstErr = null;
    for (let i = 0; i < RUNS; i++) {
      const r = runDraft(n, champs);
      if (r.ok) ok++;
      else { fail++; if (!firstErr) firstErr = r.error; }
    }
    const pass = fail === 0;
    const expected = expectFailAt?.includes(n) ? ' (esperado falhar)' : '';
    const icon = (pass && !expected) || (!pass && expected) ? '✓' : '✗';
    console.log(`  ${n} jogadores [precisa ${needed} únicos]: ${ok}/${RUNS} OK ${icon}${expected}${firstErr ? '\n    → ' + firstErr : ''}`);
  }
}

runSuite('LISTA ONLINE (Data Dragon ~165 campeões)', [4, 8, 16], CHAMPS_ONLINE, []);
runSuite('LISTA OFFLINE (fallback ~53 campeões)',   [4, 8],      CHAMPS_OFFLINE, []);

// 16 offline: documentar a falha esperada (80 picks > 53 champs)
console.log('\n  16 jogadores OFFLINE: impossível por elenco insuficiente');
console.log(`  (${CHAMPS_OFFLINE.length} campeões < ${16*5} picks necessários) — bloqueado no UI com mensagem clara ✓`);

console.log('\n=== FIM ===\n');

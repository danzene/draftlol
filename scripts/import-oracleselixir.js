// scripts/import-oracleselixir.js
// Importa dados de pro play do Oracle's Elixir e gera data/pro-matchups.json.
//
// Dados de Oracle's Elixir — disponibilizados publicamente para uso por analistas
// e fãs, não afiliado à Riot Games. Fonte: https://oracleselixir.com
//
// Uso: node scripts/import-oracleselixir.js [caminho-do-csv]
//   Ex: node scripts/import-oracleselixir.js ~/Downloads/2025_LoL_esports_match_data.csv
//
// Se nenhum argumento for passado, o script tenta baixar o arquivo de 2025 automaticamente.
// Confirme a URL atual em https://oracleselixir.com/tools/downloads se falhar.

'use strict';
const fs    = require('fs');
const path  = require('path');
const https = require('https');

// ============================================================
// CONFIGURAÇÃO
// ============================================================
const MIN_GAMES = 5; // mínimo de confrontos para incluir matchup (pro play tem menos volume)
const MIN_CHAMP_GAMES = 3; // mínimo de games para incluir WR individual de campeão

// URLs por ano — o script tenta 2025 primeiro, depois 2024 como fallback
const DOWNLOAD_URLS = [
  'https://oracleselixir-downloadable-match-data.s3-us-west-2.amazonaws.com/2025_LoL_esports_match_data_from_OraclesElixir.csv',
  'https://oracleselixir-downloadable-match-data.s3-us-west-2.amazonaws.com/2024_LoL_esports_match_data_from_OraclesElixir.csv',
];

// ============================================================
// Mapeamento de posição Oracle's Elixir → rotas do DraftLoL
// ============================================================
const POS_MAP = { top:'top', jng:'jungle', mid:'mid', bot:'adc', sup:'support' };

// ============================================================
// Normalização de nomes: Oracle's Elixir → Data Dragon ID
// OE usa nomes de exibição; DD usa IDs sem espaços/apóstrofes,
// com casos especiais (Wukong→MonkeyKing, etc.)
// ============================================================
const OE_TO_DD = {
  // Nomes especiais que NÃO seguem a regra de "remover espaços/apóstrofes"
  'Wukong':          'MonkeyKing',
  'Nunu & Willump':  'Nunu',
  'Renata Glasc':    'Renata',
  'LeBlanc':         'Leblanc',
  // Apelidos alternativos vistos em alguns CSVs do OE
  'Nunu and Willump':'Nunu',
  'Fiddlesticks':    'Fiddlesticks',
};

function toDD(oeName) {
  if (!oeName) return '';
  const n = oeName.trim();
  if (OE_TO_DD[n]) return OE_TO_DD[n];
  // Regra genérica: remove espaços, apóstrofes, pontos e '&'
  // Preserva capitalização original (ex: "Twisted Fate" → "TwistedFate")
  return n.replace(/[\s'.&]/g, '');
}

// ============================================================
// Parser CSV simples (suporta campos com vírgula entre aspas)
// ============================================================
function parseCSVLine(line) {
  const cols = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === ',' && !inQ) { cols.push(cur); cur = ''; continue; }
    cur += ch;
  }
  cols.push(cur);
  return cols;
}

// ============================================================
// Download com streaming e redirect automático
// ============================================================
function tryDownload(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, resp => {
      if (resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location) {
        file.close(); fs.unlinkSync(destPath);
        return tryDownload(resp.headers.location, destPath).then(resolve).catch(reject);
      }
      if (resp.statusCode !== 200) {
        file.close();
        try { fs.unlinkSync(destPath); } catch(_) {}
        return reject(new Error(`HTTP ${resp.statusCode}`));
      }
      resp.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', err => { file.close(); try { fs.unlinkSync(destPath); } catch(_) {} reject(err); });
  });
}

async function downloadFirst(urls, destPath) {
  for (const url of urls) {
    try {
      console.log(`  Tentando: ${url}`);
      await tryDownload(url, destPath);
      console.log(`  ✓ Download concluído`);
      return url;
    } catch (e) {
      console.warn(`  ✗ Falhou (${e.message}) — tentando próxima URL...`);
    }
  }
  throw new Error(
    'Nenhuma URL funcionou.\n' +
    'Baixe o CSV manualmente em: https://oracleselixir.com/tools/downloads\n' +
    'E rode: node scripts/import-oracleselixir.js caminho/para/arquivo.csv'
  );
}

// ============================================================
// Processamento do CSV
// ============================================================
function processCSV(csvPath) {
  const byMatchup  = {}; // { role: { "ChampA-ChampB": { games, winsA } } }
  const byChampion = {}; // { champId: { role: { games, wins } } }

  const lines = fs.readFileSync(csvPath, 'utf8').split('\n');
  if (lines.length < 2) throw new Error('CSV vazio ou inválido');

  const header = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
  const col    = name => header.indexOf(name);

  const iGameId   = col('gameid');
  const iSide     = col('side');
  const iPosition = col('position');
  const iChampion = col('champion');
  const iResult   = col('result');

  if ([iGameId, iSide, iPosition, iChampion, iResult].some(i => i < 0)) {
    throw new Error(
      `Colunas não encontradas. Header: ${header.slice(0, 15).join(', ')}...\n` +
      'Esperado: gameid, side, position, champion, result'
    );
  }

  // Agrupa linhas por gameid → coleta ambos os lados de cada rota
  const games = new Map();
  let skipped = 0;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = parseCSVLine(line);
    const gameId  = cols[iGameId]?.trim();
    const side    = cols[iSide]?.trim().toLowerCase();
    const pos     = POS_MAP[cols[iPosition]?.trim().toLowerCase()];
    const rawName = cols[iChampion]?.trim();
    const champId = toDD(rawName);
    const result  = parseInt(cols[iResult]?.trim(), 10);

    if (!gameId || !pos || !champId || isNaN(result)) { skipped++; continue; }

    if (!games.has(gameId)) games.set(gameId, { blue:{}, red:{} });
    const g = games.get(gameId);
    const entry = { champId, win: result === 1 };
    if (side === 'blue' || side === 'b') g.blue[pos] = entry;
    else                                  g.red[pos]  = entry;
  }
  if (skipped > 0) console.log(`  (${skipped} linhas ignoradas — dados incompletos)`);

  // Calcula matchups e WR individual por campeão/rota
  for (const [, g] of games) {
    for (const role of ['top', 'jungle', 'mid', 'adc', 'support']) {
      const blue = g.blue[role];
      const red  = g.red[role];

      // WR individual — blue side
      if (blue?.champId) {
        if (!byChampion[blue.champId]) byChampion[blue.champId] = {};
        if (!byChampion[blue.champId][role]) byChampion[blue.champId][role] = { games:0, wins:0 };
        byChampion[blue.champId][role].games++;
        if (blue.win) byChampion[blue.champId][role].wins++;
      }
      // WR individual — red side
      if (red?.champId) {
        if (!byChampion[red.champId]) byChampion[red.champId] = {};
        if (!byChampion[red.champId][role]) byChampion[red.champId][role] = { games:0, wins:0 };
        byChampion[red.champId][role].games++;
        if (red.win) byChampion[red.champId][role].wins++;
      }

      // Matchup counter (blue.champ vs red.champ na mesma rota)
      if (!blue?.champId || !red?.champId) continue;
      if (!byMatchup[role]) byMatchup[role] = {};
      const key = `${blue.champId}-${red.champId}`;
      if (!byMatchup[role][key]) byMatchup[role][key] = { games:0, winsA:0 };
      byMatchup[role][key].games++;
      if (blue.win) byMatchup[role][key].winsA++;
    }
  }

  // Filtrar matchups com poucos games
  for (const role of Object.keys(byMatchup)) {
    for (const key of Object.keys(byMatchup[role])) {
      if (byMatchup[role][key].games < MIN_GAMES) delete byMatchup[role][key];
    }
  }

  // Filtrar campeões com poucos games (em cada rota)
  for (const champId of Object.keys(byChampion)) {
    for (const role of Object.keys(byChampion[champId])) {
      if (byChampion[champId][role].games < MIN_CHAMP_GAMES)
        delete byChampion[champId][role];
    }
    if (Object.keys(byChampion[champId]).length === 0) delete byChampion[champId];
  }

  return { byMatchup, byChampion, gamesProcessed: games.size };
}

// ============================================================
// Main
// ============================================================
async function main() {
  const csvArg = process.argv[2];
  let csvPath;

  if (csvArg) {
    csvPath = path.resolve(csvArg);
    if (!fs.existsSync(csvPath)) {
      console.error(`Arquivo não encontrado: ${csvPath}`);
      process.exit(1);
    }
    console.log(`Usando arquivo local: ${csvPath}`);
  } else {
    const tmp = path.join(require('os').tmpdir(), 'oracleselixir.csv');
    console.log("Baixando CSV de Oracle's Elixir...");
    await downloadFirst(DOWNLOAD_URLS, tmp);
    csvPath = tmp;
  }

  console.log('Processando CSV (pode levar alguns segundos para arquivos grandes)...');
  const { byMatchup, byChampion, gamesProcessed } = processCSV(csvPath);

  const outDir  = path.join(__dirname, '..', 'data');
  const outFile = path.join(outDir, 'pro-matchups.json');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const output = {
    source        : 'oracleselixir',
    attribution   : "Dados de Oracle's Elixir, disponibilizados publicamente para uso por analistas e fãs — não afiliado à Riot Games. oracleselixir.com",
    generatedAt   : new Date().toISOString(),
    gamesProcessed,
    byMatchup,
    byChampion,
  };
  fs.writeFileSync(outFile, JSON.stringify(output, null, 2), 'utf8');

  const totalMatchups = Object.values(byMatchup)
    .reduce((s, r) => s + Object.keys(r).length, 0);
  const totalChamps   = Object.keys(byChampion).length;

  console.log('\n=== Concluído ===');
  console.log(`  Partidas processadas : ${gamesProcessed}`);
  console.log(`  Matchups de counter  : ${totalMatchups} (mín. ${MIN_GAMES} games)`);
  console.log(`  Campeões com WR      : ${totalChamps} (mín. ${MIN_CHAMP_GAMES} games)`);
  console.log(`  Arquivo              : ${outFile}`);
  console.log('\nPró-tip: commite data/pro-matchups.json para o site usar os dados em produção.');
}

main().catch(e => { console.error('Erro:', e.message); process.exit(1); });

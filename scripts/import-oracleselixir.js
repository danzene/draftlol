// scripts/import-oracleselixir.js
// Importa dados de pro play do Oracle's Elixir e gera data/pro-matchups.json.
//
// Dados de Oracle's Elixir — disponibilizados publicamente para uso por analistas
// e fãs, não afiliado à Riot Games. Fonte: https://oracleselixir.com
//
// Uso: node scripts/import-oracleselixir.js [caminho-do-csv]
//   Ex: node scripts/import-oracleselixir.js ~/Downloads/2024_LoL_esports_match_data.csv
//
// Se nenhum argumento for passado, o script tenta baixar o arquivo diretamente.
// Confirme a URL atual em https://oracleselixir.com/tools/downloads antes de rodar.

'use strict';
const fs   = require('fs');
const path = require('path');
const https = require('https');

// ============================================================
// CONFIGURAÇÃO
// ============================================================
// URL do CSV mais recente. Verifique em oracleselixir.com/tools/downloads.
// Exemplo para 2024 (confirme se ainda está ativo antes de usar):
const DOWNLOAD_URL =
  'https://oracleselixir-downloadable-match-data.s3-us-west-2.amazonaws.com/2024_LoL_esports_match_data_from_OraclesElixir.csv';

const MIN_GAMES = 5; // mínimo de confrontos para incluir no matchup (pro play tem menos volume)

// ============================================================
// Mapeamento de posição Oracle's Elixir → rotas do DraftLoL
// ============================================================
const POS_MAP = { top:'top', jng:'jungle', mid:'mid', bot:'adc', sup:'support' };

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
// Download com streaming
// ============================================================
function download(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, resp => {
      if (resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location) {
        file.close();
        fs.unlinkSync(destPath);
        return download(resp.headers.location, destPath).then(resolve).catch(reject);
      }
      if (resp.statusCode !== 200) {
        file.close();
        return reject(new Error(`HTTP ${resp.statusCode} ao baixar CSV`));
      }
      resp.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', err => { file.close(); fs.unlinkSync(destPath); reject(err); });
  });
}

// ============================================================
// Processamento do CSV
// ============================================================
function processCSV(csvPath) {
  const byMatchup = {}; // { role: { "ChampA-ChampB": { games, winsA } } }

  const lines = fs.readFileSync(csvPath, 'utf8').split('\n');
  if (lines.length < 2) throw new Error('CSV vazio ou inválido');

  const header = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
  const col = name => header.indexOf(name);

  const iGameId   = col('gameid');
  const iSide     = col('side');
  const iPosition = col('position');
  const iChampion = col('champion');
  const iResult   = col('result');

  if ([iGameId, iSide, iPosition, iChampion, iResult].some(i => i < 0)) {
    throw new Error(`Colunas não encontradas. Header: ${header.slice(0, 12).join(', ')}...\n` +
      'Esperado: gameid, side, position, champion, result');
  }

  // Agrupa linhas por gameid → coleta ambos os lados de cada rota
  const games = new Map();
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = parseCSVLine(line);
    const gameId  = cols[iGameId]?.trim();
    const side    = cols[iSide]?.trim().toLowerCase();   // 'blue' | 'red'
    const pos     = POS_MAP[cols[iPosition]?.trim().toLowerCase()];
    const champ   = cols[iChampion]?.trim();
    const result  = parseInt(cols[iResult]?.trim(), 10); // 1=win, 0=loss

    if (!gameId || !pos || !champ || isNaN(result)) continue;
    if (!games.has(gameId)) games.set(gameId, { blue: {}, red: {} });
    const g = games.get(gameId);
    if (side === 'blue' || side === 'b') g.blue[pos] = { champ, win: result === 1 };
    else                                  g.red[pos]  = { champ, win: result === 1 };
  }

  // Calcula matchups a partir dos jogos agrupados
  for (const [, g] of games) {
    for (const role of ['top', 'jungle', 'mid', 'adc', 'support']) {
      const blue = g.blue[role];
      const red  = g.red[role];
      if (!blue?.champ || !red?.champ) continue;

      if (!byMatchup[role]) byMatchup[role] = {};
      const key = `${blue.champ}-${red.champ}`;
      if (!byMatchup[role][key]) byMatchup[role][key] = { games: 0, winsA: 0 };
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

  return { byMatchup, gamesProcessed: games.size };
}

// ============================================================
// Main
// ============================================================
async function main() {
  const csvArg = process.argv[2];
  let csvPath;

  if (csvArg) {
    csvPath = path.resolve(csvArg);
    if (!fs.existsSync(csvPath)) { console.error(`Arquivo não encontrado: ${csvPath}`); process.exit(1); }
    console.log(`Usando arquivo local: ${csvPath}`);
  } else {
    const tmp = path.join(require('os').tmpdir(), 'oracleselixir.csv');
    console.log(`Baixando CSV de Oracle's Elixir...`);
    console.log(`Fonte: ${DOWNLOAD_URL}`);
    console.log(`(Confirme a URL atual em oracleselixir.com/tools/downloads)`);
    await download(DOWNLOAD_URL, tmp);
    csvPath = tmp;
    console.log(`Download concluído: ${csvPath}`);
  }

  console.log('Processando CSV...');
  const { byMatchup, gamesProcessed } = processCSV(csvPath);

  const outDir  = path.join(__dirname, '..', 'data');
  const outFile = path.join(outDir, 'pro-matchups.json');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const output = {
    source       : 'oracleselixir',
    attribution  : "Dados de Oracle's Elixir, disponibilizados publicamente para uso por analistas e fãs — não afiliado à Riot Games.",
    generatedAt  : new Date().toISOString(),
    gamesProcessed,
    byMatchup,
  };
  fs.writeFileSync(outFile, JSON.stringify(output, null, 2), 'utf8');

  const totalMatchups = Object.values(byMatchup).reduce((s, r) => s + Object.keys(r).length, 0);
  console.log(`\n=== Concluído ===`);
  console.log(`  Partidas processadas : ${gamesProcessed}`);
  console.log(`  Matchups gerados     : ${totalMatchups}`);
  console.log(`  Arquivo              : ${outFile}`);
}

main().catch(e => { console.error('Erro:', e.message); process.exit(1); });

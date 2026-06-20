// api/riot.js
// Proxy seguro para a API OFICIAL da Riot — função serverless (Vercel).
// A chave fica SOMENTE no servidor, em process.env.RIOT_API_KEY.
// O navegador NUNCA vê a chave: ele chama /api/riot, e este código chama a Riot.
//
// Endpoints confirmados (2025, fluxo via PUUID):
//   ACCOUNT-V1 (cluster regional): /riot/account/v1/accounts/by-riot-id/{nome}/{tag} -> puuid
//   SUMMONER-V4 (plataforma):       /lol/summoner/v4/summoners/by-puuid/{puuid}      -> id, nível
//   LEAGUE-V4 (plataforma):         /lol/league/v4/entries/by-summoner/{summonerId} -> rank
//   CHAMPION-MASTERY-V4 (plataforma):/lol/champion-mastery/v4/champion-masteries/by-puuid/{puuid}/top?count=5
//   CHAMPION-ROTATIONS (plataforma): /lol/platform/v3/champion-rotations

const PLATFORM_TO_CLUSTER = {
  br1:'americas', na1:'americas', la1:'americas', la2:'americas',
  kr:'asia', jp1:'asia',
  euw1:'europe', eun1:'europe', tr1:'europe', ru:'europe',
  oc1:'sea', ph2:'sea', sg2:'sea', th2:'sea', tw2:'sea', vn2:'sea'
};

// cache simples em memória (vale enquanto a função estiver "quente")
const cache = new Map();
const cacheGet = k => { const e = cache.get(k); if (e && e.exp > Date.now()) return e.v; cache.delete(k); return null; };
const cacheSet = (k, v, ttl) => cache.set(k, { v, exp: Date.now() + ttl });

async function riot(url, key) {
  const r = await fetch(url, { headers: { 'X-Riot-Token': key } });
  if (r.status === 429) { const e = new Error('rate_limited'); e.status = 429; e.retryAfter = r.headers.get('retry-after') || '5'; throw e; }
  if (!r.ok) { const e = new Error('riot_error'); e.status = r.status; throw e; }
  return r.json();
}

export default async function handler(req, res) {
  // CORS — em produção, troque '*' pelo seu domínio via env ALLOWED_ORIGIN
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const key = process.env.RIOT_API_KEY;
  if (!key) { res.status(500).json({ error: 'RIOT_API_KEY não configurada no servidor' }); return; }

  const { action, riotId, platform = 'br1' } = req.query;
  const plat = PLATFORM_TO_CLUSTER[platform] ? platform : 'br1';
  const cluster = PLATFORM_TO_CLUSTER[plat];

  try {
    // ---- rotação gratuita da semana ----
    if (action === 'rotation') {
      const ck = 'rot:' + plat; const hit = cacheGet(ck); if (hit) return res.json(hit);
      const data = await riot(`https://${plat}.api.riotgames.com/lol/platform/v3/champion-rotations`, key);
      cacheSet(ck, data, 30 * 60 * 1000);
      return res.json(data);
    }

    // ---- perfil real do jogador: rank + maestria ----
    if (action === 'profile') {
      if (!riotId || !riotId.includes('#')) return res.status(400).json({ error: 'Use riotId no formato Nome#TAG' });
      const ck = 'prof:' + plat + ':' + riotId.toLowerCase(); const hit = cacheGet(ck); if (hit) return res.json(hit);

      const [gameName, tagLine] = riotId.split('#');
      const acc = await riot(`https://${cluster}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`, key);
      const summ = await riot(`https://${plat}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${acc.puuid}`, key);
      let ranked = []; try { ranked = await riot(`https://${plat}.api.riotgames.com/lol/league/v4/entries/by-summoner/${summ.id}`, key); } catch (_) {}
      let mastery = []; try { mastery = await riot(`https://${plat}.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/${acc.puuid}/top?count=5`, key); } catch (_) {}

      const out = {
        riotId: `${acc.gameName}#${acc.tagLine}`,
        level: summ.summonerLevel,
        profileIconId: summ.profileIconId,
        ranked: ranked.map(r => ({ queue: r.queueType, tier: r.tier, rank: r.rank, lp: r.leaguePoints, wins: r.wins, losses: r.losses })),
        topMastery: mastery.map(m => ({ championId: m.championId, level: m.championLevel, points: m.championPoints }))
      };
      cacheSet(ck, out, 5 * 60 * 1000);
      return res.json(out);
    }

    return res.status(400).json({ error: 'action inválida — use profile ou rotation' });
  } catch (e) {
    if (e.status === 429) { res.setHeader('Retry-After', e.retryAfter || '5'); return res.status(429).json({ error: 'limite de requisições atingido, tente em instantes' }); }
    if (e.status === 404) return res.status(404).json({ error: 'jogador não encontrado (confira Nome#TAG e a região)' });
    return res.status(e.status || 500).json({ error: 'falha ao consultar a Riot' });
  }
}

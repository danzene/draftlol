// api/config.js
// Expõe a configuração PÚBLICA do Supabase ao front-end.
//
// SUPABASE_URL e SUPABASE_ANON_KEY são SEGURAS para o front-end conhecer —
// a anon key é projetada para ser pública, protegida por Row Level Security no banco.
// Isso é diferente de RIOT_API_KEY, que é um segredo de servidor e NUNCA pode ir ao front.
//
// Servir pelo back-end (em vez de hardcodar no HTML) facilita trocar entre
// o projeto de teste e o de produção apenas mudando as variáveis de ambiente da Vercel.

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache');
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    return res.status(503).json({ error: 'Supabase não configurado no servidor. Defina SUPABASE_URL e SUPABASE_ANON_KEY nas variáveis de ambiente da Vercel.' });
  }

  res.status(200).json({ supabaseUrl: url, supabaseAnonKey: key });
}

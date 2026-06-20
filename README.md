# DraftLoL — backend seguro para a API oficial da Riot

Este pacote adiciona um **backend mínimo** que guarda sua chave da Riot em segredo.
O navegador chama `/api/riot`, e o servidor (e só ele) fala com a Riot. A chave **nunca** vai pro front.

```
[ navegador / draftlol.html ]  →  [ /api/riot.js (servidor, tem a chave) ]  →  [ API da Riot ]
```

## O que a API da Riot entrega (e o que NÃO entrega)

Entrega dados reais de **jogador**: rank, maestria de campeões, histórico de partidas, rotação gratuita.
**Não** entrega winrate/pickrate do meta — isso só existe somando milhões de partidas (op.gg faz isso em escala, e raspar eles é proibido). Por isso o winrate do jogo segue sendo estimativa baseada nos atributos reais do Data Dragon, e a API da Riot é usada para o recurso **"Entrar com seu Riot ID"** (seu rank real + seus campeões mais jogados).

## Passo 1 — Pegar a chave (você faz, eu não toco nela)

1. Acesse `developer.riotgames.com` e entre com sua conta Riot.
2. Aceite os Termos de Serviço de desenvolvedor.
3. Registre seu produto e gere uma **chave pessoal** (Personal). Ela não expira e serve para você e um grupo privado pequeno (seus amigos).
   - A chave de **desenvolvimento** (Development) expira a cada 24h e só serve para testar.
   - Uma chave de **produção** (Production) só é necessária se o site virar público de verdade (passa por análise da Riot).

> ⚠️ Nunca cole sua chave aqui no chat, nem dentro do código, nem no GitHub. Ela vive só como variável de ambiente secreta.

## Passo 2 — Rodar e publicar (Vercel, grátis, integra com GitHub)

1. Suba este projeto + o `draftlol.html` num repositório no GitHub (o Claude Code faz isso por você — veja o prompt no fim).
2. Em `vercel.com`, clique **Add New → Project** e importe o repositório do GitHub.
3. Em **Settings → Environment Variables**, adicione:
   - `RIOT_API_KEY` = sua chave (cole no painel da Vercel, **não** no código)
   - `ALLOWED_ORIGIN` = a URL do seu site (ex.: `https://draftlol.vercel.app`)
4. **Deploy**. A partir daí, todo `git push` no GitHub publica um patch novo automaticamente. É o seu fluxo de atualização.

Testar local: `npm i -g vercel` e depois `vercel dev` (lendo do seu `.env.local`).

## Passo 3 — Usar no front

O `draftlol.html` chama o backend assim (sem nunca ver a chave):

```js
// rank real + campeões mais jogados
const r = await fetch(`/api/riot?action=profile&riotId=${encodeURIComponent('SeuNome#BR1')}&platform=br1`);
const perfil = await r.json();

// rotação gratuita da semana
const rot = await (await fetch('/api/riot?action=rotation&platform=br1')).json();
```

Regiões comuns: `br1` (Brasil), `na1`, `euw1`, `kr`, `la1`, `la2`.

## Regras de segurança (resumo)

- Chave **só** em variável de ambiente. Nunca no código, nunca no front, nunca commitada.
- `.gitignore` já ignora `.env` e `.env.local`.
- Em produção, trave o `ALLOWED_ORIGIN` no seu domínio.
- O proxy só aceita ações conhecidas (`profile`, `rotation`) — sem repassar URLs arbitrárias.
- O jogo em si (Data Dragon) funciona público **sem chave**; só o recurso de Riot ID usa o backend.

## Aviso legal (exigido pela Riot — já está no app)

DraftLoL não é endossado pela Riot Games e não reflete opiniões da Riot Games. League of Legends e suas propriedades são marcas registradas da Riot Games, Inc.

---

## Prompt para colar no Claude Code (VS Code)

> Tenho uma pasta com `draftlol.html` (o jogo, já pronto) e uma pasta `draftlol-backend/` com `api/riot.js`, `.env.example` e `.gitignore`. Quero que você:
> 1. Una tudo num projeto só na raiz do repositório: o `draftlol.html` na raiz (renomeie para `index.html`) e a pasta `api/` na raiz, junto do `.gitignore` e `.env.example`.
> 2. Crie um `.env.local` a partir do `.env.example` (deixe `RIOT_API_KEY` em branco — eu preencho).
> 3. Inicialize o git, faça o primeiro commit e crie um repositório novo no meu GitHub, e dê push.
> 4. Me explique, passo a passo, como importar na Vercel e onde colar a `RIOT_API_KEY` como variável de ambiente secreta (não escreva a chave em lugar nenhum do código).
> 5. No `index.html`, adicione um botão/painel "Entrar com Riot ID" que chama `GET /api/riot?action=profile&riotId=Nome%23TAG&platform=br1` e mostra meu rank e meus 5 campeões de maior maestria. Trate erros (404 jogador não encontrado, 429 limite). Não exponha nenhuma chave no front.
>
> Importante: nunca coloque a chave da Riot no código nem no git. Ela vive só como variável de ambiente.

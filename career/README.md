# DraftLoL — Modo Carreira · Fundação de dados (Fase 1)

Camada **nova e isolada**. Não toca no site (`index.html`), no modo casual online
nem no campeonato contra bots. Aqui só vivem **dados** e **funções puras** —
nada renderiza ainda.

## Arquivos

| Arquivo | O que é |
|---|---|
| `config.js` | **Todos os valores de balanceamento (🎚️) num lugar só.** Ajuste aqui. |
| `util.js` | PRNG determinístico (`hashStr`/`seeded`) e helpers — iguais aos do site. |
| `archetypes.js` | Os 8 arquétipos, rotas, atributos e os mapas rota↔atributo↔fase. |
| `rarity.js` | Raridades, teto de estrelas, teto de atributo por estrela. |
| `players.js` | Catálogo (pokédex) de **72 jogadores** + builder determinístico. |
| `power.js` | `poderPick` / `poderTime` (curva early/mid/late, casa com `genTimeline`). |
| `probability.js` | Probabilidade de vitória + variância pela compostura (upsets). |
| `economy.js` | Duplicata→fragmento/Fichas, fonte isolada de Fichas, gacha. |
| `index.js` | Ponto de entrada único (`require('./career')`). |
| `tests/` + `run-tests.js` | Suíte de testes sem dependências. |

## Rodar os testes

```bash
node career/run-tests.js
```

(Node não está disponível no ambiente onde estes arquivos foram gerados, então a
suíte precisa ser rodada na sua máquina. Saída esperada: `✓ todos os testes passaram`.)

## Decisões de design

- **Catálogo determinístico:** cada jogador é uma entrada fixa `[nome, rota, raridade]`;
  atributos e afinidades são derivados da semente do nome. Mesmo nome → sempre o
  mesmo jogador. Mantém o arquivo enxuto e os invariantes testáveis.
- **Poder por fase:** `poderPick` devolve `{early, mid, late}`. O atributo principal
  muda por rota e fase (Laning no início, Teamfight no late), então a "fonte de poder"
  encaixa direto no modelo de fases que o `genTimeline` já usa.
- **Compostura = variância, não média:** a compostura média das duas equipes "afia"
  o resultado. Alta → favorito se impõe; baixa → puxa pra 50/50 (mais upsets, dos dois
  lados). Nunca 0% nem 100%.
- **Fonte de Fichas isolada:** todo crédito passa por `addFichas(saldo, valor, fonte)`
  com a fonte rotulada. Um gacha **pago** no futuro é só uma nova fonte (`'purchase'`),
  sem refazer o sistema. Nenhum fluxo de pagamento existe nesta fase.

## Compatibilidade

Os módulos exportam via CommonJS (`module.exports`, para os testes em Node) **e**
se registram em `globalThis.Career.*` (para uso futuro no navegador, quando a Fase 3+
montar as telas). Nenhum passo de build é necessário.

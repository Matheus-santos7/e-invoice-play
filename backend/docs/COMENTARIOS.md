# Comentários no backend — guia para manutenção

Este documento define **como comentar** o código em `backend/src` para que outros devs entendam regras de negócio, ordem de emissão e dependências entre módulos.

## O que comentar

| Comentar | Não comentar |
|----------|----------------|
| Cadeia fiscal (remessa → retorno → venda → devolução) | `import`, getters triviais |
| Regras FIFO de saldo de remessa | O que o TypeScript já deixa óbvio |
| Por que `refNFe` aponta para qual documento | Repetir o nome da função |
| Eventos SEFAZ simulados (110111, inutilização) | Cada linha de CRUD simples |
| Pré-condições e erros de domínio (`*Error`) | |
| Transações: o que deve ser atômico | |

## Onde colocar

1. **Cabeçalho do arquivo** (`/** ... */` no topo): propósito do módulo, fluxo principal, arquivos relacionados.
2. **Funções exportadas**: JSDoc curto com `@param` só quando o nome não for claro.
3. **Blocos dentro de transações**: 1 linha antes de passos críticos (ex.: estorno FIFO após devolução).
4. **Rotas** (`routes/*.ts`): comentário de seção `// --- NF-e: leitura ---`.

## Padrão de cabeçalho de módulo

```ts
/**
 * Nome do módulo — uma frase.
 *
 * Contexto:
 * - Ponto 1 de negócio
 * - Ponto 2 (referência a outro service)
 *
 * @see outro-arquivo.ts
 */
```

## Mapa rápido da emissão fiscal

```
emitirNFeRemessa          → saldoDisponivel na remessa física
emitirCadeiaVenda         → retorno (consome FIFO) + venda (ref → retorno) + CT-e venda
emitirDevolucaoVenda      → devolução + estorno FIFO + remessa simbólica
cancelarVenda             → evento 110111 na venda e no retorno + estorno FIFO
inutilizarNumeracao       → faixa sem NF-e emitida (procInutNFe)
```

Persistência auxiliar: tabela `nfe_remessa_consumos` liga **retorno** ↔ **remessas** debitadas.

## Idioma

Comentários em **português**, alinhados ao domínio fiscal brasileiro e aos termos da UI.

## Simulação vs produção

Deixar explícito quando o código **simula** SEFAZ (protocolos fake, XML no frontend): não há transmissão real neste repositório.

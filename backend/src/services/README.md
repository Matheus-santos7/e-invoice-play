# Services — mapa de responsabilidades

| Arquivo | Responsabilidade |
|---------|------------------|
| `remessa-service.ts` | NF-e de remessa física (CFOP 6949), saldo inicial, CT-e remessa |
| `remessa-fifo.ts` | Saldo FIFO entre remessas; consumo no retorno; estorno |
| `venda-chain-service.ts` | Retorno simbólico + venda + CT-e venda (uma transação) |
| `devolucao-service.ts` | Devolução da venda, estorno FIFO, remessa simbólica |
| `cancelamento-service.ts` | Evento 110111; cancela venda e retorno referenciado |
| `inutilizacao-service.ts` | Faixa de numeração inutilizada (sem NF-e na série) |
| `cte-remessa-service.ts` | CT-e vinculado à NF-e de remessa |
| `cte-venda-service.ts` | CT-e vinculado à NF-e de venda |
| `checkout-service.ts` | Checkout direto → `emitirCadeiaVenda` |
| `pedido-service.ts` | Rascunho de pedido + faturamento |
| `timeline-service.ts` | Agrupa NF-es em cadeias para o dashboard |
| `fiscal-service.ts` | Soft delete de NF-e / CT-e |
| `tax-rule-service.ts` | Resolve regra da planilha (origem × destino × tipo) |
| `tax-calculation-service.ts` | Monta item + chama `tax-engine` |
| `fiscal-emitter-settings-service.ts` | Configurações do emissor (hub ML) |

Guia de estilo: [docs/COMENTARIOS.md](../../docs/COMENTARIOS.md).

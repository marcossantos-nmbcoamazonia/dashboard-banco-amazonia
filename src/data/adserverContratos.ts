// Contratos fixos por veículo — fonte: mídia offline / planilha de compra de mídia.
// Tipo "CPM": meta em impressões contratadas.
// Tipo "DIARIA": compramos N diárias (dias com veiculação).
//   - quantidade: número fixo de diárias contratadas (ex: 30)
//   - quantidade: null → dias são calculados automaticamente como os dias corridos
//     do mês a partir do início do publisher até o último dia do mês.
// Um mesmo publisher pode ter CPM + DIARIA → duas linhas na tabela.

export type TipoCompra = "CPM" | "DIARIA" | "CPC"

export interface ContratoVeiculo {
  publisher: string
  tipo: TipoCompra
  // CPM   → impressões contratadas
  // DIARIA → número de diárias contratadas; null = dias corridos do mês desde o início
  // CPC   → cliques contratados
  quantidade: number | null
}

// Mínimo de impressões num dia para contar como uma diária válida
export const DIARIA_MIN_IMPRESSOES = 100

/** Dias corridos de `inicio` (YYYY-MM-DD) até o último dia daquele mês (inclusive). */
export function diasRestantesNoMes(inicio: string): number {
  const d = new Date(inicio + "T00:00:00")
  const ultimoDia = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  return ultimoDia - d.getDate() + 1
}

export const CONTRATOS_CAPITAL_DE_GIRO: ContratoVeiculo[] = [
  // ── Portais regionais ────────────────────────────────────────────────────────
  { publisher: "A CRITICA",                 tipo: "CPM",    quantidade: 70_000   },
  { publisher: "AMAPÁ DIGITAL",             tipo: "DIARIA", quantidade: 30       },
  { publisher: "BNC AMAZONAS",              tipo: "DIARIA", quantidade: 8        },
  { publisher: "BRASIL NA PONTA",           tipo: "CPM",    quantidade: 511_111  },
  { publisher: "CONEXÃO TOCANTINS",         tipo: "CPM",    quantidade: 150_000  },
  { publisher: "CONTILNET NOTÍCIAS",        tipo: "DIARIA", quantidade: 30       },
  { publisher: "D24 AM",                    tipo: "DIARIA", quantidade: 15       },
  { publisher: "DIÁRIO DA AMAZÔNIA",        tipo: "DIARIA", quantidade: 30       },
  { publisher: "RBA - DOL",                 tipo: "DIARIA", quantidade: 10       },
  { publisher: "GAZETA DIGITAL",            tipo: "CPM",    quantidade: 100_000  },
  { publisher: "GAZETA DO CERRADO",         tipo: "DIARIA", quantidade: 50       },
  { publisher: "MIDIANEWS",                 tipo: "DIARIA", quantidade: 15       },
  { publisher: "NEWS RONDONIA",             tipo: "DIARIA", quantidade: 30       },
  { publisher: "O Imparcial Online (MA)",   tipo: "DIARIA", quantidade: 15       },
  { publisher: "O PEQUENO",                 tipo: "DIARIA", quantidade: 20       },
  { publisher: "OLHAR DIRETO",              tipo: "CPM",    quantidade: 300_000  },
  { publisher: "PORTAL FOLHA DA BOA VISTA", tipo: "DIARIA", quantidade: 30       },
  { publisher: "PORTAL IMIRANTE",           tipo: "DIARIA", quantidade: 15       },
  { publisher: "REPÓRTER MT",               tipo: "DIARIA", quantidade: 15       },
  { publisher: "RONDONIA AO VIVO",          tipo: "DIARIA", quantidade: 15       },

  // ── Portais nacionais ────────────────────────────────────────────────────────
  { publisher: "EXAME",              tipo: "CPM",    quantidade: 500_000   },
  { publisher: "EXAME",              tipo: "CPM",    quantidade: 70_019    },
  { publisher: "EXAME",              tipo: "DIARIA", quantidade: null       }, // dias do mês desde início
  { publisher: "FOLHA DE SÃO PAULO", tipo: "CPM",    quantidade: 600_000   },
  { publisher: "FOLHA DE SÃO PAULO", tipo: "DIARIA", quantidade: null       }, // dias do mês desde início
  { publisher: "GLOBO",              tipo: "CPM",    quantidade: 1_562_504  },
  { publisher: "Revista PEGN",       tipo: "CPM",    quantidade: 1_562_504  },
  { publisher: "R7",                 tipo: "CPM",    quantidade: 1_430_800  },
  { publisher: "VEJA",               tipo: "CPM",    quantidade: 801_282    },
  { publisher: "ROMA NEWS",          tipo: "DIARIA", quantidade: 30         },
  { publisher: "GO ON",              tipo: "CPM",    quantidade: 10_000_000 },
  { publisher: "HANDS",              tipo: "CPC",    quantidade: 18_000     },
  { publisher: "ZAP MEDIA",         tipo: "CPC",    quantidade: 18_000     },
]

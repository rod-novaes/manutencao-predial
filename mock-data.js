const MOCK_DATA = {
    categorias: [
        { id: 1, nome: 'Elétrica' },
        { id: 2, nome: 'Hidráulica' },
        { id: 3, nome: 'Climatização' }
    ],
    subcategorias: [
        { 
            id: 1, 
            categoriaId: 1, 
            nome: 'Grupo Gerador', 
            periodicidade: 'Semanal',
            checklist: [
                'Verificar nível do óleo do carter',
                'Verificar tensão das baterias de partida',
                'Testar partida manual em vazio'
            ] 
        },
        { 
            id: 2, 
            categoriaId: 1, 
            nome: 'Quadro de Distribuição', 
            periodicidade: 'Trimestral',
            checklist: [
                'Realizar inspeção visual de componentes',
                'Medir temperatura dos disjuntores com termovisor',
                'Realizar o reaperto de todas as conexões elétricas'
            ] 
        },
        { 
            id: 3, 
            categoriaId: 2, 
            nome: 'Bomba Centrífuga', 
            periodicidade: 'Mensal',
            checklist: [
                'Verificar selo mecânico por vazamentos',
                'Medir amperagem de operação do motor',
                'Verificar alinhamento entre bomba e motor'
            ] 
        },
        { 
            id: 4, 
            categoriaId: 1, 
            nome: 'No-Break', 
            periodicidade: 'Mensal',
            checklist: [
                'Verificar alarmes no painel frontal',
                'Medir tensão de saída e flutuação',
                'Realizar teste de autonomia em modo bateria (simulado)'
            ] 
        }
    ],
    equipamentos: [
      { id: 1, nome: 'Gerador Stemac 01', categoriaId: 1, subcategoriaId: 1, local: 'Subsolo, Sala Geradores', dataUltimaManutencao: '2025-09-03' },
      { id: 2, nome: 'QGBT-01', categoriaId: 1, subcategoriaId: 2, local: 'Subsolo, Sala Elétrica', dataUltimaManutencao: '2025-06-11' },
      { id: 3, nome: 'Bomba D\'água Subsolo', categoriaId: 2, subcategoriaId: 3, local: 'Subsolo, Sala de Bombas', dataUltimaManutencao: '2025-08-11' },
      { id: 4, nome: 'No-Break Sala Cofre', categoriaId: 1, subcategoriaId: 4, local: 'Térreo, Sala Cofre', dataUltimaManutencao: '2025-08-18' }
    ],
    historicoManutencoes: [
        { id: 1, equipamentoId: 1, data: '2025-09-03', observacao: 'Realizada via OS #95' },
        { id: 2, equipamentoId: 2, data: '2025-06-11', observacao: 'Registro de manutenção anterior' },
        { id: 3, equipamentoId: 3, data: '2025-08-11', observacao: 'Registro de manutenção anterior' },
        { id: 4, equipamentoId: 4, data: '2025-08-18', observacao: 'Registro de manutenção anterior' }
    ]
};
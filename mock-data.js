const MOCK_DATA = {
    grandesAreas: [
        { id: 1, nome: 'Marcenaria' },
        { id: 2, nome: 'Civil' },
        { id: 3, nome: 'Elétrica' },
        { id: 4, nome: 'Mecânica Geral' },
        { id: 5, nome: 'Serralheria' },
        { id: 6, nome: 'Hidrossanitária' },
        { id: 7, nome: 'Eletrônica' },
        { id: 8, nome: 'Mecânica de Refrigeração' },
        { id: 9, nome: 'Climatização' }
    ],
    sistemas: [
        // --- Sistemas de Elétrica (ID 3) ---
        { 
            id: 2, 
            grandeAreaId: 3, 
            nome: 'Quadros de Distribuição', 
            areaResponsavel: 'Equipe de Elétrica',
            checklist: [
                { id: 's2-t1', tarefa: 'Realizar inspeção visual de componentes', periodicidade: 'Trimestral' },
                { id: 's2-t2', tarefa: 'Medir temperatura dos disjuntores com termovisor', periodicidade: 'Trimestral' },
                { id: 's2-t3', tarefa: 'Realizar o reaperto de todas as conexões elétricas', periodicidade: 'Trimestral' }
            ] 
        },
        { 
            id: 8, 
            grandeAreaId: 3, 
            nome: 'Geradores', 
            areaResponsavel: 'Equipe de Elétrica',
            checklist: [
                { id: 's8-t1', tarefa: 'Verificação geral do Grupo Gerador e painéis de controle', periodicidade: 'Semanal' },
                { id: 's8-t2', tarefa: 'Testar o funcionamento dos GMG\'s com carga por 15 minutos', periodicidade: 'Mensal' },
                { id: 's8-t3', tarefa: 'Efetuar análise termográfica interna dos Quadros de Comando', periodicidade: 'Semestral' },
                { id: 's8-t4', tarefa: 'Substituição dos elementos filtrantes e óleo lubrificante', periodicidade: 'Anual' }
            ] 
        },
        // --- Sistemas de Hidráulica (ID 6) ---
        {
            id: 11,
            grandeAreaId: 6,
            nome: 'Bombas de Água Potável',
            areaResponsavel: 'Equipe de Hidráulica',
            checklist: [
                { id: 's11-t1', tarefa: 'Verificar vazamentos nas conexões e selos', periodicidade: 'Mensal' },
                { id: 's11-t2', tarefa: 'Verificar funcionamento das boias automáticas', periodicidade: 'Mensal' }
            ]
        },
        // --- Sistemas de Climatização (ID 9) ---
        {
            id: 13,
            grandeAreaId: 9,
            nome: 'Condensadoras VRF',
            areaResponsavel: 'Equipe de Climatização',
            checklist: [
                { id: 's13-t1', tarefa: 'Verificar e limpar gabinetes e trocadores de calor', periodicidade: 'Mensal' },
                { id: 's13-t2', tarefa: 'Verificar funcionamento do motor ventilador', periodicidade: 'Mensal' },
                { id: 's13-t3', tarefa: 'Medir e registrar tensões e correntes do compressor', periodicidade: 'Mensal' },
                { id: 's13-t4', tarefa: 'Verificar integridade e funcionamento de componentes elétricos', periodicidade: 'Semestral' }
            ]
        },
        {
            id: 14,
            grandeAreaId: 9,
            nome: 'Evaporadoras',
            areaResponsavel: 'Equipe de Climatização',
            checklist: [
                { id: 's14-t1', tarefa: 'Limpeza e desobstrução do filtro de ar', periodicidade: 'Mensal' },
                { id: 's14-t2', tarefa: 'Verificar e limpar bandeja de dreno', periodicidade: 'Mensal' },
                { id: 's14-t3', tarefa: 'Medir e registrar temperatura de insuflamento e retorno', periodicidade: 'Mensal' }
            ]
        },
        {
            id: 15,
            grandeAreaId: 9,
            nome: 'Ventilação e Exaustão',
            areaResponsavel: 'Equipe de Climatização',
            checklist: [
                { id: 's15-t1', tarefa: 'Limpeza geral de exaustores e ventiladores', periodicidade: 'Bimestral' },
                { id: 's15-t2', tarefa: 'Verificar fixação e alinhamento de polias e mancais', periodicidade: 'Bimestral' }
            ]
        }
    ],
    componentes: [
        // Componentes do Backup (Elétrica, Hidráulica)
        { id: 1, nome: 'Gerador Stemac 01 - Ed. Sede', grandeAreaId: 3, sistemaId: 8, criticidade: 'Classe A', edificio: 'Sede', andar: 'Subsolo', sala: 'Sala Geradores', complemento: '', dataInicio: '2025-01-01', tarefasEspecificas: [] },
        { id: 2, nome: 'QGBT-01 - Ed. Sede', grandeAreaId: 3, sistemaId: 2, criticidade: 'Classe A', edificio: 'Sede', andar: 'Subsolo', sala: 'Sala Elétrica', complemento: 'Próximo à entrada principal', dataInicio: '2025-01-01', tarefasEspecificas: [] },
        { id: 3, nome: 'Bomba D\'água Potável 01 - Subsolo', grandeAreaId: 6, sistemaId: 11, criticidade: 'Classe B', edificio: 'Sede', andar: 'Subsolo', sala: 'Casa de Bombas', complemento: '', dataInicio: '2025-01-01', tarefasEspecificas: [] },
        
        // Componentes do Relatório (Climatização)
        { id: 101, nome: 'Condensadora TAG 1A', grandeAreaId: 9, sistemaId: 13, criticidade: 'Classe A', edificio: 'CCJE', andar: 'Terraço', sala: '', complemento: 'Conjunto 1', dataInicio: '2025-01-01', tarefasEspecificas: [] },
        { id: 102, nome: 'Condensadora TAG 1B', grandeAreaId: 9, sistemaId: 13, criticidade: 'Classe A', edificio: 'CCJE', andar: 'Terraço', sala: '', complemento: 'Conjunto 1', dataInicio: '2025-01-01', tarefasEspecificas: [] },
        { id: 103, nome: 'Condensadora TAG 2A', grandeAreaId: 9, sistemaId: 13, criticidade: 'Classe A', edificio: 'CCJE', andar: 'Terraço', sala: '', complemento: 'Conjunto 2', dataInicio: '2025-01-01', tarefasEspecificas: [] },
        { id: 104, nome: 'Evaporadora Teto TAG 3 (Restaurante)', grandeAreaId: 9, sistemaId: 14, criticidade: 'Classe B', edificio: 'CCJE', andar: '1º Pavimento', sala: 'Restaurante', complemento: '', dataInicio: '2025-01-01', tarefasEspecificas: [] },
        { id: 105, nome: 'Evaporadora Piso TAG 14 (Exposições)', grandeAreaId: 9, sistemaId: 14, criticidade: 'Classe B', edificio: 'CCJE', andar: '1º Pavimento', sala: 'Área de Exposições', complemento: '', dataInicio: '2025-01-01', tarefasEspecificas: [] },
        { id: 107, nome: 'Exaustor CL-630-T1', grandeAreaId: 9, sistemaId: 15, criticidade: 'Classe C', edificio: 'CCJE', andar: 'Embasamento', sala: 'Sala de Máquinas', complemento: 'Item 1 - Ventilação', dataInicio: '2025-01-01', tarefasEspecificas: [] },
        { id: 109, nome: 'Condensadora TAG 3B1 (Inoperante)', grandeAreaId: 9, sistemaId: 13, criticidade: 'Classe A', edificio: 'CCJE', andar: 'Terraço', sala: '', complemento: 'Conjunto 3B', dataInicio: '2025-01-01', tarefasEspecificas: [{id: 'c109-t1', tarefa: 'Acompanhar manutenção corretiva de vazamento', periodicidade: 'Semanal'}] }
    ],
    historicoManutencoes: [
        // --- Histórico Denso para Componentes ---

        // Gerador 01 (ID 1)
        { id: 1, componenteId: 1, tarefaId: 's8-t1', data: '2025-09-08', os: '101', obs: 'Verificação semanal OK.' }, // Próxima: 15/09 (Este Mês)
        { id: 2, componenteId: 1, tarefaId: 's8-t2', data: '2025-08-15', os: '092', obs: 'Teste com carga realizado.' }, // Próxima: 15/09 (Este Mês)
        { id: 3, componenteId: 1, tarefaId: 's8-t3', data: '2025-06-20', os: '075', obs: 'Nenhum ponto de aquecimento.' }, // Próxima: 20/12 (Futuro)
        { id: 4, componenteId: 1, tarefaId: 's8-t4', data: '2025-01-15', os: '015', obs: 'Manutenção anual completa.' }, // Próxima: 15/01/2026 (Futuro)

        // QGBT-01 (ID 2)
        { id: 5, componenteId: 2, tarefaId: 's2-t1', data: '2025-06-11', os: '071', obs: 'Inspeção visual OK.' }, // Próxima: 11/09 (Este Mês)
        { id: 6, componenteId: 2, tarefaId: 's2-t2', data: '2025-06-11', os: '071', obs: 'Termografia OK.' }, // Próxima: 11/09 (Este Mês)
        
        // Bomba D'água (ID 3) - ATRASADA
        { id: 8, componenteId: 3, tarefaId: 's11-t1', data: '2025-08-11', os: '091', obs: 'Sem vazamentos.' }, // Próxima: 11/09 (Este Mês)
        { id: 9, componenteId: 3, tarefaId: 's11-t2', data: '2025-07-10', os: '080', obs: 'Boias OK.' }, // Próxima: 10/08 (ATRASADA)

        // Condensadora 1A (ID 101)
        { id: 101, componenteId: 101, tarefaId: 's13-t1', data: '2025-09-02', os: 'OS-901', obs: 'Limpeza mensal realizada.' }, // Próxima: 02/10 (Próximo Mês)
        { id: 103, componenteId: 101, tarefaId: 's13-t4', data: '2025-06-05', os: 'OS-605', obs: 'Verificação semestral OK.' }, // Próxima: 05/12 (Futuro)

        // Condensadora 1B (ID 102)
        { id: 105, componenteId: 102, tarefaId: 's13-t1', data: '2025-08-01', os: 'OS-802', obs: 'Limpeza mensal realizada.' }, // Próxima: 01/09 (ATRASADA)
        { id: 106, componenteId: 102, tarefaId: 's13-t2', data: '2025-09-05', os: 'OS-902', obs: 'Verificação do motor OK.' }, // Próxima: 05/10 (Próximo Mês)

        // Condensadora 2A (ID 103)
        { id: 108, componenteId: 103, tarefaId: 's13-t1', data: '2025-08-01', os: 'OS-803', obs: 'Limpeza mensal realizada.' }, // Próxima: 01/09 (ATRASADA)
        { id: 109, componenteId: 103, tarefaId: 's13-t4', data: '2025-03-10', os: 'OS-310', obs: 'Verificação semestral OK.' }, // Próxima: 10/09 (Este Mês)

        // Evaporadora Teto TAG 3 (ID 104)
        { id: 110, componenteId: 104, tarefaId: 's14-t1', data: '2025-08-20', os: 'OS-820', obs: 'Filtros limpos.' }, // Próxima: 20/09 (Este Mês)

        // Evaporadora Piso TAG 14 (ID 105)
        { id: 112, componenteId: 105, tarefaId: 's14-t2', data: '2025-09-10', os: 'OS-910', obs: 'Bandeja de dreno limpa.' }, // Próxima: 10/10 (Próximo Mês)

        // Exaustor CL-630-T1 (ID 107)
        { id: 115, componenteId: 107, tarefaId: 's15-t1', data: '2025-08-10', os: 'OS-826', obs: 'Limpeza bimestral OK.' }, // Próxima: 10/10 (Próximo Mês)

        // Condensadora 3B1 (ID 109)
        { id: 117, componenteId: 109, tarefaId: 'c109-t1', data: '2025-09-05', os: 'OS-905', obs: 'Acompanhamento semanal.' } // Próxima: 12/09 (Este Mês)
    ]
};
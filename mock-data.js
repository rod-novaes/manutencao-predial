const MOCK_DATA = {
    grandesAreas: [
        { id: 1, nome: 'Marcenaria' },
        { id: 2, nome: 'Civil' },
        { id: 3, nome: 'Elétrica' },
        { id: 4, nome: 'Mecânica Geral' },
        { id: 5, nome: 'Serralheria' },
        { id: 6, nome: 'Hidrossanitária' },
        { id: 7, nome: 'Eletrônica' },
        { id: 8, nome: 'Mecânica de Refrigeração' }
    ],
    sistemas: [
        // --- Sistemas de Elétrica (ID 3) ---
        { 
            id: 1, 
            grandeAreaId: 3, 
            nome: 'Quadros de Automação', 
            areaResponsavel: 'Equipe de Elétrica',
            checklist: [
                { id: 's1-t1', tarefa: 'Inspecionar visualmente e limpar o quadro (aspirar e passar pano)', periodicidade: 'Trimestral' },
                { id: 's1-t2', tarefa: 'Verificar fixações e conexões; refazer isolações defeituosas', periodicidade: 'Trimestral' },
                { id: 's1-t3', tarefa: 'Realizar testes de comunicação com o sistema de supervisão', periodicidade: 'Trimestral' }
            ] 
        },
        { 
            id: 2, 
            grandeAreaId: 3, 
            nome: 'Quadros de Distribuição', 
            areaResponsavel: 'Equipe de Elétrica',
            checklist: [
                { id: 's2-t1', tarefa: 'Verificar a existência de ruídos anormais, elétricos ou mecânicos', periodicidade: 'Trimestral' },
                { id: 's2-t2', tarefa: 'Verificar a presença de aquecimento nos disjuntores termomagnéticos', periodicidade: 'Trimestral' },
                { id: 's2-t3', tarefa: 'Fazer o controle da amperagem dos alimentadores', periodicidade: 'Trimestral' }
            ] 
        },
        { 
            id: 3, 
            grandeAreaId: 3, 
            nome: 'Quadro de Comando e Proteção dos Motores', 
            areaResponsavel: 'Equipe de Elétrica',
            checklist: [
                { id: 's3-t1', tarefa: 'Substituir componentes defeituosos', periodicidade: 'Trimestral' },
                { id: 's3-t2', tarefa: 'Fazer limpeza geral', periodicidade: 'Trimestral' },
                { id: 's3-t3', tarefa: 'Conferir valores das proteções, corrigindo-os de acordo com o projeto', periodicidade: 'Trimestral' }
            ] 
        },
        { 
            id: 4, 
            grandeAreaId: 3, 
            nome: 'Sistema de Iluminação', 
            areaResponsavel: 'Equipe de Elétrica',
            checklist: [
                { id: 's4-t1', tarefa: 'Substituir lâmpadas queimadas', periodicidade: 'Mensal' },
                { id: 's4-t2', tarefa: 'Verificar fiação, substituindo fios com defeitos de isolação', periodicidade: 'Mensal' }
            ] 
        },
        { 
            id: 5, 
            grandeAreaId: 3, 
            nome: 'Tomadas e Interruptores', 
            areaResponsavel: 'Equipe de Elétrica',
            checklist: [
                { id: 's5-t1', tarefa: 'Verificar tomadas e interruptores', periodicidade: 'Trimestral' },
                { id: 's5-t2', tarefa: 'Reapertar conexões e ligações', periodicidade: 'Trimestral' }
            ] 
        },
        { 
            id: 6, 
            grandeAreaId: 3, 
            nome: 'Motores e Bombas', 
            areaResponsavel: 'Equipe de Elétrica',
            checklist: [
                { id: 's6-t1', tarefa: 'Fazer limpeza geral', periodicidade: 'Semestral' },
                { id: 's6-t2', tarefa: 'Fazer engraxamento', periodicidade: 'Semestral' },
                { id: 's6-t3', tarefa: 'Verificar isolação do fio de alimentação', periodicidade: 'Semestral' }
            ] 
        },
        { 
            id: 7, 
            grandeAreaId: 3, 
            nome: 'Ventiladores', 
            areaResponsavel: 'Equipe de Elétrica',
            checklist: [
                { id: 's7-t1', tarefa: 'Efetuar limpeza geral', periodicidade: 'Trimestral' },
                { id: 's7-t2', tarefa: 'Lubrificar partes móveis', periodicidade: 'Trimestral' }
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
        { 
            id: 9, 
            grandeAreaId: 3, 
            nome: 'No-break, Banco de Baterias e Afins', 
            areaResponsavel: 'Equipe de Elétrica',
            checklist: [
                { id: 's9-t1', tarefa: 'Verificar painéis de controle e alarmes ativos', periodicidade: 'Semanal' },
                { id: 's9-t2', tarefa: 'Testar funcionamento do carregador de baterias e inversor com carga', periodicidade: 'Mensal' },
                { id: 's9-t3', tarefa: 'Medir e registrar a tensão de cada elemento do banco de baterias', periodicidade: 'Mensal' }
            ] 
        },
        { 
            id: 10, 
            grandeAreaId: 3, 
            nome: 'Banco de Capacitores', 
            areaResponsavel: 'Equipe de Elétrica',
            checklist: [
                { id: 's10-t1', tarefa: 'Verificar a existência de ruídos anormais, elétricos ou mecânicos', periodicidade: 'Semanal' },
                { id: 's10-t2', tarefa: 'Efetuar a leitura/medir e registrar as tensões de entrada', periodicidade: 'Semanal' },
                { id: 's10-t3', tarefa: 'Efetuar a Análise Termográfica da entrada e saída do sistema', periodicidade: 'Semestral' }
            ] 
        },
        // --- Outros Sistemas ---
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
        {
            id: 12,
            grandeAreaId: 1,
            nome: 'Portas Corta-Fogo',
            areaResponsavel: 'Equipe de Marcenaria',
            checklist: [
                { id: 's12-t1', tarefa: 'Verificar fechamento automático e vedação', periodicidade: 'Trimestral' },
                { id: 's12-t2', tarefa: 'Lubrificar dobradiças e fechaduras', periodicidade: 'Trimestral' }
            ]
        }
    ],
    componentes: [
        { 
            id: 1, 
            nome: 'Gerador 01 - Edifício Sede', 
            grandeAreaId: 3, 
            sistemaId: 8, 
            criticidade: 'Classe A',
            edificio: 'Sede',
            andar: 'Subsolo',
            sala: 'Sala de Geradores',
            complemento: 'Lado Leste',
            dataInicio: '2025-01-01',
            tarefasEspecificas: []
        },
        { 
            id: 2, 
            nome: 'QGBT-01 (Sede)', 
            grandeAreaId: 3, 
            sistemaId: 2, 
            criticidade: 'Classe A',
            edificio: 'Sede',
            andar: 'Subsolo',
            sala: 'Sala Elétrica Principal',
            complemento: '',
            dataInicio: '2025-01-01',
            tarefasEspecificas: [
                { id: 'c2-t1', tarefa: 'Verificar medidor de energia principal da concessionária', periodicidade: 'Mensal' }
            ]
        },
        { 
            id: 3, 
            nome: 'No-Break CPD Principal', 
            grandeAreaId: 3, 
            sistemaId: 9, 
            criticidade: 'Classe A',
            edificio: 'Anexo I',
            andar: '3º Andar',
            sala: 'Data Center',
            complemento: '',
            dataInicio: '2025-02-01',
            tarefasEspecificas: []
        },
        { 
            id: 4, 
            nome: 'Bomba de Água Potável 01', 
            grandeAreaId: 6, 
            sistemaId: 11, 
            criticidade: 'Classe B',
            edificio: 'Sede',
            andar: 'Subsolo',
            sala: 'Casa de Bombas',
            complemento: '',
            dataInicio: '2025-01-15',
            tarefasEspecificas: []
        },
        { 
            id: 5, 
            nome: 'Conjunto Portas Corta-Fogo - 5º Andar', 
            grandeAreaId: 1, 
            sistemaId: 12, 
            criticidade: 'Classe A',
            edificio: 'Sede',
            andar: '5º Andar',
            sala: 'Corredor de Acesso',
            complemento: 'Saídas de Emergência Leste/Oeste',
            dataInicio: '2025-03-01',
            tarefasEspecificas: []
        }
    ],
    historicoManutencoes: [
        // Histórico para Gerador 01 (ID 1)
        { id: 1, componenteId: 1, tarefaId: 's8-t1', data: '2025-09-08', os: '101', obs: 'Verificação semanal OK.' }, // Próxima: 15/09 (Este Mês)
        { id: 2, componenteId: 1, tarefaId: 's8-t2', data: '2025-08-15', os: '092', obs: 'Teste com carga realizado. Tudo normal.' }, // Próxima: 15/09 (Este Mês)
        { id: 3, componenteId: 1, tarefaId: 's8-t3', data: '2025-06-20', os: '075', obs: 'Nenhum ponto de aquecimento detectado.' }, // Próxima: 20/12 (Futuro)

        // Histórico para QGBT-01 (ID 2)
        { id: 4, componenteId: 2, tarefaId: 's2-t1', data: '2025-07-15', os: '081', obs: 'Inspeção visual sem anomalias.' }, // Próxima: 15/10 (Próximo Mês)
        { id: 8, componenteId: 2, tarefaId: 's2-t2', data: '2025-06-30', os: '078', obs: 'Medição de temperatura OK.'}, // Próxima: 30/09 (Este Mês)
        { id: 5, componenteId: 2, tarefaId: 'c2-t1', data: '2025-08-22', os: '095', obs: 'Leitura do medidor registrada.' }, // Próxima: 22/09 (Este Mês)

        // Histórico para No-Break (ID 3) - TAREFA ATRASADA
        { id: 6, componenteId: 3, tarefaId: 's9-t2', data: '2025-08-05', os: '090', obs: 'Teste de funcionamento OK.' }, // Próxima: 05/09 (Atrasada)

        // Histórico para Bomba (ID 4)
        { id: 7, componenteId: 4, tarefaId: 's11-t1', data: '2025-08-18', os: '093', obs: 'Sem vazamentos.' }, // Próxima: 18/09 (Este Mês)
        { id: 9, componenteId: 4, tarefaId: 's11-t2', data: '2025-08-25', os: '096', obs: 'Boias funcionando.'} // Próxima: 25/09 (Este Mês)
    ]
};
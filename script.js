document.addEventListener('DOMContentLoaded', () => {
    // --- ESTADO DA APLICAÇÃO ---
    let activeScreen = 'screen-painel';
    const today = new Date('2025-09-11T12:00:00'); // Data de referência "hoje", NUNCA MUDA
    let calendarDate = new Date(today); // Data para navegação do calendário, PODE MUDAR
    let activeDateFilter = null;
    let editingItemId = null;
    let sortColumn = 'date';
    let sortDirection = 'asc';

    // --- ELEMENTOS DO DOM ---
    const modalContainer = document.getElementById('modal-container');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalFooter = document.getElementById('modal-footer');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const modalOverlay = document.querySelector('.modal-overlay');

    // --- LÓGICA DO MODAL DINÂMICO ---
    function showModal(title, bodyHtml, footerHtml) {
        modalTitle.textContent = title;
        modalBody.innerHTML = bodyHtml;
        modalFooter.innerHTML = footerHtml;
        modalContainer.classList.remove('hidden');
    }

    function closeModal() {
        modalContainer.classList.add('hidden');
        modalBody.innerHTML = '';
        modalFooter.innerHTML = '';
        editingItemId = null;
    }

    modalCloseBtn.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', closeModal);
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modalContainer.classList.contains('hidden')) {
            closeModal();
        }
    });

    // --- LÓGICA CENTRAL DE MANUTENÇÃO ---
    function calculateNextDueDate(lastDate, periodicity) {
        const nextDate = new Date(lastDate);
        switch (periodicity) {
            case 'Semanal': nextDate.setDate(nextDate.getDate() + 7); break;
            case 'Mensal': nextDate.setMonth(nextDate.getMonth() + 1); break;
            case 'Trimestral': nextDate.setMonth(nextDate.getMonth() + 3); break;
            case 'Semestral': nextDate.setMonth(nextDate.getMonth() + 6); break;
            case 'Anual': nextDate.setFullYear(nextDate.getFullYear() + 1); break;
            default: break;
        }
        return nextDate;
    }

    function generateTaskInstances() {
        const upcomingTasks = [];
        MOCK_DATA.componentes.forEach(componente => {
            const sistema = MOCK_DATA.sistemas.find(s => s.id === componente.sistemaId);
            if (!sistema) return;

            const inheritedTasks = sistema.checklist || [];
            const specificTasks = componente.tarefasEspecificas || [];
            const allTasksForComponent = [...inheritedTasks, ...specificTasks];

            allTasksForComponent.forEach(tarefa => {
                const historyForTask = MOCK_DATA.historicoManutencoes
                    .filter(h => h.componenteId === componente.id && h.tarefaId === tarefa.id)
                    .sort((a, b) => new Date(b.data) - new Date(a.data));

                let dueDate;
                if (historyForTask.length > 0) {
                    const lastCompletionDate = new Date(historyForTask[0].data + 'T12:00:00');
                    dueDate = calculateNextDueDate(lastCompletionDate, tarefa.periodicidade);
                } else {
                    const startDate = componente.dataInicio ? componente.dataInicio : today.toISOString().slice(0, 10);
                    dueDate = new Date(startDate + 'T12:00:00');
                }

                const status = dueDate < today ? 'Atrasada' : 'A vencer';

                upcomingTasks.push({
                    componenteId: componente.id,
                    componenteName: componente.nome,
                    tarefaId: tarefa.id,
                    tarefaDescricao: tarefa.tarefa,
                    periodicidade: tarefa.periodicidade,
                    grandeAreaId: componente.grandeAreaId,
                    sistemaId: componente.sistemaId,
                    criticidade: componente.criticidade,
                    date: dueDate,
                    status: status,
                    type: 'upcoming'
                });
            });
        });
        return upcomingTasks;
    }

    function getAllMaintenanceTasksForDisplay() {
        const upcomingAndOverdue = generateTaskInstances();
        const completed = MOCK_DATA.historicoManutencoes.map(hist => {
            const componente = MOCK_DATA.componentes.find(c => c.id === hist.componenteId);
            if (!componente) return null;
            const sistema = MOCK_DATA.sistemas.find(s => s.id === componente.sistemaId);
            let tarefa = sistema ? sistema.checklist.find(t => t.id === hist.tarefaId) : null;
            if (!tarefa && componente.tarefasEspecificas) {
                tarefa = componente.tarefasEspecificas.find(t => t.id === hist.tarefaId);
            }
            return {
                historyId: hist.id,
                componenteId: componente.id,
                componenteName: componente.nome,
                tarefaId: hist.tarefaId,
                tarefaDescricao: tarefa ? tarefa.tarefa : 'Serviço não encontrado',
                periodicidade: tarefa ? tarefa.periodicidade : 'N/A',
                grandeAreaId: componente.grandeAreaId,
                sistemaId: componente.sistemaId,
                criticidade: componente.criticidade,
                date: new Date(hist.data + 'T12:00:00'),
                status: 'Concluída',
                type: 'completed',
                os: hist.os,
                obs: hist.obs
            };
        }).filter(Boolean);
        return [...upcomingAndOverdue, ...completed];
    }

    // --- FUNÇÕES DE CRUD ---
    function getGrandeAreaFormHTML(grandeArea = {}) {
        const grandeAreaName = grandeArea.nome || '';
        return `<form id="grande-area-form"><div class="form-group"><label for="grande-area-name">Nome da Grande Área:</label><input type="text" id="grande-area-name" name="grande-area-name" value="${grandeAreaName}" required></div></form>`;
    }
    function handleAddGrandeArea() {
        editingItemId = null;
        const formHtml = getGrandeAreaFormHTML();
        const footerHtml = `<button class="btn btn-secondary" data-action="cancel-modal">Cancelar</button><button class="btn btn-primary" data-action="save-grande-area">Salvar</button>`;
        showModal('Nova Grande Área', formHtml, footerHtml);
        document.getElementById('grande-area-name').focus();
    }
    function handleEditGrandeArea(id) {
        editingItemId = id;
        const grandeArea = MOCK_DATA.grandesAreas.find(g => g.id === id);
        if (!grandeArea) return;
        const formHtml = getGrandeAreaFormHTML(grandeArea);
        const footerHtml = `<button class="btn btn-secondary" data-action="cancel-modal">Cancelar</button><button class="btn btn-primary" data-action="save-grande-area">Salvar Alterações</button>`;
        showModal('Editar Grande Área', formHtml, footerHtml);
        document.getElementById('grande-area-name').focus();
    }
    function handleDeleteGrandeArea(id) {
        editingItemId = id;
        const grandeArea = MOCK_DATA.grandesAreas.find(g => g.id === id);
        if (!grandeArea) return;
        const bodyHtml = `<p>Você tem certeza que deseja excluir a grande área <strong>"${grandeArea.nome}"</strong>? Esta ação não pode ser desfeita.</p>`;
        const footerHtml = `<button class="btn btn-secondary" data-action="cancel-modal">Cancelar</button><button class="btn btn-danger" data-action="confirm-delete-grande-area">Confirmar Exclusão</button>`;
        showModal('Confirmar Exclusão', bodyHtml, footerHtml);
    }
    function saveGrandeArea() {
        const input = document.getElementById('grande-area-name');
        if (!input.value.trim()) { alert('O nome da grande área não pode estar em branco.'); return; }
        if (editingItemId) {
            const grandeArea = MOCK_DATA.grandesAreas.find(g => g.id === editingItemId);
            grandeArea.nome = input.value;
        } else {
            const newId = MOCK_DATA.grandesAreas.length > 0 ? Math.max(...MOCK_DATA.grandesAreas.map(g => g.id)) + 1 : 1;
            MOCK_DATA.grandesAreas.push({ id: newId, nome: input.value });
        }
        renderListaGrandesAreas();
        closeModal();
    }
    function confirmDeleteGrandeArea() {
        MOCK_DATA.grandesAreas = MOCK_DATA.grandesAreas.filter(g => g.id !== editingItemId);
        renderListaGrandesAreas();
        closeModal();
    }

    function getSistemaFormHTML(sistema = {}) {
        const { nome = '', grandeAreaId = '', areaResponsavel = '', checklist = [{tarefa: '', periodicidade: 'Mensal'}] } = sistema;
        const grandeAreaOptions = MOCK_DATA.grandesAreas.map(ga => `<option value="${ga.id}" ${ga.id === grandeAreaId ? 'selected' : ''}>${ga.nome}</option>`).join('');
        const checklistItems = checklist.map((item) => {
            const selectedPeriodicidade = item.periodicidade || 'Mensal';
            const optionsWithSelected = ['Semanal', 'Mensal', 'Trimestral', 'Semestral', 'Anual'].map(p => `<option value="${p}" ${p === selectedPeriodicidade ? 'selected' : ''}>${p}</option>`).join('');
            return `<div class="checklist-item">
                        <input type="text" class="checklist-item-input" value="${item.tarefa || ''}" placeholder="Descreva o serviço">
                        <select class="checklist-item-periodicity">${optionsWithSelected}</select>
                        <button class="btn btn-danger remove-item-btn" data-action="remove-checklist-item" title="Remover item"><i class="fas fa-trash-alt"></i></button>
                    </div>`;
        }).join('');
        return `<form id="sistema-form">
                    <div class="form-group"><label for="sistema-grande-area">Grande Área:</label><select id="sistema-grande-area" required><option value="">Selecione...</option>${grandeAreaOptions}</select></div>
                    <div class="form-group"><label for="sistema-name">Nome do Sistema:</label><input type="text" id="sistema-name" value="${nome}" required></div>
                    <div class="form-group"><label for="sistema-area-responsavel">Área Responsável:</label><input type="text" id="sistema-area-responsavel" value="${areaResponsavel}"></div>
                    <div class="form-group"><label>Serviços do Plano de Manutenção:</label><div class="checklist-container">${checklistItems}</div><button type="button" class="btn btn-secondary" data-action="add-checklist-item"><i class="fas fa-plus"></i> Adicionar Serviço</button></div>
                </form>`;
    }
    function handleAddSistema() {
        editingItemId = null;
        const formHtml = getSistemaFormHTML();
        const footerHtml = `<button class="btn btn-secondary" data-action="cancel-modal">Cancelar</button><button class="btn btn-primary" data-action="save-sistema">Salvar</button>`;
        showModal('Novo Sistema (Plano de Manutenção)', formHtml, footerHtml);
    }
    function handleEditSistema(id) {
        editingItemId = id;
        const sistema = MOCK_DATA.sistemas.find(s => s.id === id);
        if (!sistema) return;
        const formHtml = getSistemaFormHTML(sistema);
        const footerHtml = `<button class="btn btn-secondary" data-action="cancel-modal">Cancelar</button><button class="btn btn-primary" data-action="save-sistema">Salvar Alterações</button>`;
        showModal('Editar Sistema (Plano de Manutenção)', formHtml, footerHtml);
    }
    function handleDeleteSistema(id) {
        editingItemId = id;
        const sistema = MOCK_DATA.sistemas.find(s => s.id === id);
        if (!sistema) return;
        const bodyHtml = `<p>Você tem certeza que deseja excluir o sistema <strong>"${sistema.nome}"</strong>?</p>`;
        const footerHtml = `<button class="btn btn-secondary" data-action="cancel-modal">Cancelar</button><button class="btn btn-danger" data-action="confirm-delete-sistema">Confirmar Exclusão</button>`;
        showModal('Confirmar Exclusão', bodyHtml, footerHtml);
    }
    function saveSistema() {
        const grandeAreaId = parseInt(document.getElementById('sistema-grande-area').value);
        const nome = document.getElementById('sistema-name').value.trim();
        const areaResponsavel = document.getElementById('sistema-area-responsavel').value.trim();
        const checklistItems = document.querySelectorAll('#sistema-form .checklist-item');
        const checklist = Array.from(checklistItems).map((item, index) => {
            const tarefa = item.querySelector('.checklist-item-input').value.trim();
            const periodicidade = item.querySelector('.checklist-item-periodicity').value;
            if (!tarefa) return null;
            const idPrefix = editingItemId ? `s${editingItemId}` : 'new';
            const id = `${idPrefix}-t${Date.now() + index}`;
            return { id, tarefa, periodicidade };
        }).filter(Boolean);
        if (!nome || !grandeAreaId) { alert('Nome do Sistema e Grande Área são obrigatórios.'); return; }
        const data = { grandeAreaId, nome, areaResponsavel, checklist };
        if (editingItemId) {
            const index = MOCK_DATA.sistemas.findIndex(s => s.id === editingItemId);
            const originalSystem = MOCK_DATA.sistemas[index];
            data.checklist.forEach((newTask) => {
                const existingTask = originalSystem.checklist.find(oldTask => oldTask.tarefa === newTask.tarefa);
                if (existingTask) newTask.id = existingTask.id;
            });
            MOCK_DATA.sistemas[index] = { ...originalSystem, ...data };
        } else {
            const newId = MOCK_DATA.sistemas.length > 0 ? Math.max(...MOCK_DATA.sistemas.map(s => s.id)) + 1 : 1;
            MOCK_DATA.sistemas.push({ id: newId, ...data });
        }
        renderListaSistemas();
        closeModal();
    }
    function confirmDeleteSistema() {
        MOCK_DATA.sistemas = MOCK_DATA.sistemas.filter(s => s.id !== editingItemId);
        renderListaSistemas();
        closeModal();
    }
    function addChecklistItem(container) {
        if (!container) return;
        const newItem = document.createElement('div');
        newItem.className = 'checklist-item';
        const periodicidadeOptions = ['Semanal', 'Mensal', 'Trimestral', 'Semestral', 'Anual'].map(p => `<option value="${p}" ${p === 'Mensal' ? 'selected' : ''}>${p}</option>`).join('');
        newItem.innerHTML = `<input type="text" class="checklist-item-input" placeholder="Descreva o serviço">
                             <select class="checklist-item-periodicity">${periodicidadeOptions}</select>
                             <button class="btn btn-danger remove-item-btn" data-action="remove-checklist-item" title="Remover item"><i class="fas fa-trash-alt"></i></button>`;
        container.appendChild(newItem);
        newItem.querySelector('input').focus();
    }

    function getComponenteFormHTML(componente = {}) {
        const { nome = '', grandeAreaId = '', sistemaId = '', criticidade = 'Classe B', edificio = '', andar = '', sala = '', complemento = '', dataInicio = '', tarefasEspecificas = [] } = componente;
        const grandeAreaOptions = MOCK_DATA.grandesAreas.map(ga => `<option value="${ga.id}" ${ga.id === grandeAreaId ? 'selected' : ''}>${ga.nome}</option>`).join('');
        const criticidadeOptions = ['Classe A', 'Classe B', 'Classe C'].map(c => `<option value="${c}" ${c === criticidade ? 'selected' : ''}>${c}</option>`).join('');
        const tarefasItems = tarefasEspecificas.map((item) => {
            const selectedPeriodicidade = item.periodicidade || 'Mensal';
            const optionsWithSelected = ['Semanal', 'Mensal', 'Trimestral', 'Semestral', 'Anual'].map(p => `<option value="${p}" ${p === selectedPeriodicidade ? 'selected' : ''}>${p}</option>`).join('');
            return `<div class="checklist-item">
                        <input type="text" class="checklist-item-input" value="${item.tarefa || ''}" placeholder="Descreva o serviço específico">
                        <select class="checklist-item-periodicity">${optionsWithSelected}</select>
                        <button class="btn btn-danger remove-item-btn" data-action="remove-checklist-item" title="Remover item"><i class="fas fa-trash-alt"></i></button>
                    </div>`;
        }).join('');
        return `
            <form id="componente-form">
                <div class="form-group">
                    <label for="componente-grande-area">Grande Área:</label>
                    <select id="componente-grande-area" required><option value="">Selecione...</option>${grandeAreaOptions}</select>
                </div>
                <div class="form-group">
                    <label for="componente-sistema">Sistema (Plano de Manutenção):</label>
                    <select id="componente-sistema" required disabled><option value="">Selecione uma grande área primeiro</option></select>
                </div>
                <div class="form-group">
                    <label for="componente-name">Nome do Componente (Identificação Única):</label>
                    <input type="text" id="componente-name" value="${nome}" required>
                </div>
                <div class="form-group">
                    <label for="componente-criticidade">Criticidade:</label>
                    <select id="componente-criticidade">${criticidadeOptions}</select>
                </div>
                <fieldset class="location-fieldset">
                    <legend>Localização</legend>
                    <div class="form-layout">
                        <div class="form-group">
                            <label for="componente-edificio">Edifício:</label>
                            <input type="text" id="componente-edificio" value="${edificio}">
                        </div>
                        <div class="form-group">
                            <label for="componente-andar">Andar/Piso:</label>
                            <input type="text" id="componente-andar" value="${andar}">
                        </div>
                        <div class="form-group">
                            <label for="componente-sala">Sala/Ambiente:</label>
                            <input type="text" id="componente-sala" value="${sala}">
                        </div>
                        <div class="form-group">
                            <label for="componente-complemento">Complemento do Local:</label>
                            <input type="text" id="componente-complemento" value="${complemento}">
                        </div>
                    </div>
                </fieldset>
                <div class="form-group">
                    <label for="componente-data-inicio">Data de Início das Manutenções:</label>
                    <input type="date" id="componente-data-inicio" value="${dataInicio}" required>
                    <small>Primeira data a ser usada como base para agendamentos se não houver histórico.</small>
                </div>
                <div id="inherited-info-container" class="inherited-info-container" style="display: none;"></div>
                <div class="form-group">
                    <label>Serviços Específicos (Opcional):</label>
                    <div class="checklist-container" id="specific-tasks-container">${tarefasItems}</div>
                    <button type="button" class="btn btn-secondary" data-action="add-checklist-item"><i class="fas fa-plus"></i> Adicionar Serviço Específico</button>
                </div>
            </form>
        `;
    }
    function updateSistemaOptions(grandeAreaId, selectedSistemaId = null) {
        const sistemaSelect = document.getElementById('componente-sistema');
        const filteredSistemas = MOCK_DATA.sistemas.filter(s => s.grandeAreaId === grandeAreaId);
        if (filteredSistemas.length > 0) {
            sistemaSelect.innerHTML = '<option value="">Selecione...</option>' + filteredSistemas.map(s => `<option value="${s.id}" ${s.id === selectedSistemaId ? 'selected' : ''}>${s.nome}</option>`).join('');
            sistemaSelect.disabled = false;
        } else {
            sistemaSelect.innerHTML = '<option value="">Nenhum sistema encontrado</option>';
            sistemaSelect.disabled = true;
        }
    }
    function updateInheritedInfo(sistemaId) {
        const infoContainer = document.getElementById('inherited-info-container');
        const sistema = MOCK_DATA.sistemas.find(s => s.id === sistemaId);
        if (sistema) {
            const checklistHtml = sistema.checklist.length > 0 ? `<ul>${sistema.checklist.map(item => `<li>${item.tarefa} (<strong>${item.periodicidade}</strong>)</li>`).join('')}</ul>` : '<p>Nenhum serviço padrão cadastrado.</p>';
            infoContainer.innerHTML = `<h5>Informações Herdadas do Sistema "${sistema.nome}"</h5><p><strong>Área Responsável:</strong> ${sistema.areaResponsavel}</p><p><strong>Serviços Padrão:</strong></p>${checklistHtml}`;
            infoContainer.style.display = 'block';
        } else {
            infoContainer.style.display = 'none';
            infoContainer.innerHTML = '';
        }
    }
    function handleAddComponente() {
        editingItemId = null;
        const formHtml = getComponenteFormHTML({ dataInicio: new Date().toISOString().slice(0, 10) });
        const footerHtml = `<button class="btn btn-secondary" data-action="cancel-modal">Cancelar</button><button class="btn btn-primary" data-action="save-componente">Salvar</button>`;
        showModal('Novo Componente', formHtml, footerHtml);
    }
    function handleEditComponente(id) {
        editingItemId = id;
        const componente = MOCK_DATA.componentes.find(c => c.id === id);
        if (!componente) return;
        const formHtml = getComponenteFormHTML(componente);
        const footerHtml = `<button class="btn btn-secondary" data-action="cancel-modal">Cancelar</button><button class="btn btn-primary" data-action="save-componente">Salvar Alterações</button>`;
        showModal('Editar Componente', formHtml, footerHtml);
        updateSistemaOptions(componente.grandeAreaId, componente.sistemaId);
        updateInheritedInfo(componente.sistemaId);
    }
    function handleDeleteComponente(id) {
        editingItemId = id;
        const componente = MOCK_DATA.componentes.find(c => c.id === id);
        if (!componente) return;
        const bodyHtml = `<p>Você tem certeza que deseja excluir o componente <strong>"${componente.nome}"</strong> e todo o seu histórico de manutenção?</p>`;
        const footerHtml = `<button class="btn btn-secondary" data-action="cancel-modal">Cancelar</button><button class="btn btn-danger" data-action="confirm-delete-componente">Confirmar Exclusão</button>`;
        showModal('Confirmar Exclusão', bodyHtml, footerHtml);
    }
    function saveComponente() {
        const grandeAreaId = parseInt(document.getElementById('componente-grande-area').value);
        const sistemaId = parseInt(document.getElementById('componente-sistema').value);
        const nome = document.getElementById('componente-name').value.trim();
        const criticidade = document.getElementById('componente-criticidade').value;
        const edificio = document.getElementById('componente-edificio').value.trim();
        const andar = document.getElementById('componente-andar').value.trim();
        const sala = document.getElementById('componente-sala').value.trim();
        const complemento = document.getElementById('componente-complemento').value.trim();
        const dataInicio = document.getElementById('componente-data-inicio').value;
        const specificTaskItems = document.querySelectorAll('#specific-tasks-container .checklist-item');
        const tarefasEspecificas = Array.from(specificTaskItems).map((item, index) => {
            const tarefa = item.querySelector('.checklist-item-input').value.trim();
            const periodicidade = item.querySelector('.checklist-item-periodicity').value;
            if (!tarefa) return null;
            const idPrefix = editingItemId ? `c${editingItemId}` : 'new';
            const id = `${idPrefix}-t${Date.now() + index}`;
            return { id, tarefa, periodicidade };
        }).filter(Boolean);
        if (!grandeAreaId || !sistemaId || !nome || !dataInicio) { alert('Grande Área, Sistema, Nome e Data de Início são obrigatórios.'); return; }
        const data = { grandeAreaId, sistemaId, nome, criticidade, edificio, andar, sala, complemento, dataInicio, tarefasEspecificas };
        if (editingItemId) {
            const componente = MOCK_DATA.componentes.find(c => c.id === editingItemId);
            data.tarefasEspecificas.forEach((newTask) => {
                const existingTask = componente.tarefasEspecificas.find(oldTask => oldTask.tarefa === newTask.tarefa);
                if (existingTask) newTask.id = existingTask.id;
            });
            Object.assign(componente, data);
        } else {
            const newId = MOCK_DATA.componentes.length > 0 ? Math.max(...MOCK_DATA.componentes.map(c => c.id)) + 1 : 1;
            MOCK_DATA.componentes.push({ id: newId, ...data });
        }
        renderListaComponentes();
        closeModal();
    }
    function confirmDeleteComponente() {
        MOCK_DATA.componentes = MOCK_DATA.componentes.filter(c => c.id !== editingItemId);
        MOCK_DATA.historicoManutencoes = MOCK_DATA.historicoManutencoes.filter(h => h.componenteId !== editingItemId);
        renderListaComponentes();
        closeModal();
    }

    // --- FUNÇÕES DE RENDERIZAÇÃO ---
    const renderers = {
        'screen-painel': renderPainelManutencao,
        'screen-lista-componentes': renderListaComponentes,
        'screen-lista-grandes-areas': renderListaGrandesAreas,
        'screen-lista-sistemas': renderListaSistemas,
        'screen-manutencoes': renderMaintenancesScreen,
        'screen-configuracoes': () => {},
    };

    function renderPainelManutencao() {
        const allTasks = generateTaskInstances();
        const painelTitle = document.getElementById('painel-main-title');
        const clearFilterBtn = document.getElementById('clear-filter-btn');
    
        const inicioMes = new Date(today.getFullYear(), today.getMonth(), 1);
        const fimMes = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        fimMes.setHours(23, 59, 59, 999);
    
        const inicioProximoMes = new Date(today.getFullYear(), today.getMonth() + 1, 1);
        const fimProximoMes = new Date(today.getFullYear(), today.getMonth() + 2, 0);
        fimProximoMes.setHours(23, 59, 59, 999);
    
        if (activeDateFilter) {
            const dataFormatada = new Date(activeDateFilter + 'T12:00:00').toLocaleDateString('pt-BR');
            painelTitle.textContent = `Serviços para ${dataFormatada}`;
            clearFilterBtn.style.display = 'block';
    
            const tasksOnDay = allTasks.filter(t => t.date.toISOString().slice(0, 10) === activeDateFilter);
    
            const criticasDoDia = tasksOnDay.filter(t => t.status === 'Atrasada');
            const mesDoDia = tasksOnDay.filter(t => t.status === 'A vencer' && t.date >= inicioMes && t.date <= fimMes);
            const proximoMesDoDia = tasksOnDay.filter(t => t.status === 'A vencer' && t.date >= inicioProximoMes && t.date <= fimProximoMes);
    
            renderTaskListToPanel(document.querySelector('#alertas-criticas .lista-os'), criticasDoDia, 'status-critica');
            renderTaskListToPanel(document.querySelector('#alertas-mes .lista-os'), mesDoDia, 'status-mes');
            renderTaskListToPanel(document.querySelector('#alertas-proximo-mes .lista-os'), proximoMesDoDia, 'status-proximo-mes');
            
            renderCalendar();
            return;
        }
    
        painelTitle.textContent = 'Painel de Serviços';
        clearFilterBtn.style.display = 'none';
    
        const criticas = allTasks.filter(t => t.status === 'Atrasada');
        const mes = allTasks.filter(t => t.status === 'A vencer' && t.date >= inicioMes && t.date <= fimMes);
        const proximoMes = allTasks.filter(t => t.status === 'A vencer' && t.date >= inicioProximoMes && t.date <= fimProximoMes);
    
        renderTaskListToPanel(document.querySelector('#alertas-criticas .lista-os'), criticas, 'status-critica');
        renderTaskListToPanel(document.querySelector('#alertas-mes .lista-os'), mes, 'status-mes');
        renderTaskListToPanel(document.querySelector('#alertas-proximo-mes .lista-os'), proximoMes, 'status-proximo-mes');
        renderCalendar();

        // Garante que a seção "Vencendo Este Mês" comece aberta por padrão
        document.getElementById('alertas-mes').classList.add('open');
    }

    function renderTaskListToPanel(ulElement, taskList, cssClass) {
        ulElement.innerHTML = '';
        if (taskList.length === 0) {
            ulElement.innerHTML = '<li>Nenhum serviço encontrado.</li>';
            return;
        }
        const groupedByComponent = taskList.reduce((acc, task) => {
            if (!acc[task.componenteId]) {
                acc[task.componenteId] = { name: task.componenteName, tasks: [] };
            }
            acc[task.componenteId].tasks.push(task);
            return acc;
        }, {});
        Object.values(groupedByComponent).forEach(group => {
            group.tasks.sort((a, b) => a.date - b.date);
            const groupLi = document.createElement('li');
            groupLi.className = `task-group ${cssClass}`;
            const header = document.createElement('div');
            header.className = 'task-group-header';
            header.dataset.action = 'toggle-task-group';
            header.innerHTML = `<span class="component-name">${group.name}</span>
                                <span class="task-count">${group.tasks.length} serviço(s)</span>
                                <i class="fas fa-chevron-down expand-icon"></i>`;
            const sublist = document.createElement('ul');
            sublist.className = 'task-sublist';
            group.tasks.forEach(t => {
                const taskLi = document.createElement('li');
                taskLi.className = 'task-item';
                taskLi.dataset.action = 'complete-task';
                taskLi.dataset.componenteId = t.componenteId;
                taskLi.dataset.tarefaId = t.tarefaId;
                taskLi.innerHTML = `<small>${t.tarefaDescricao}</small><br><small>Vence em: ${t.date.toLocaleDateString('pt-BR')}</small>`;
                sublist.appendChild(taskLi);
            });
            groupLi.appendChild(header);
            groupLi.appendChild(sublist);
            ulElement.appendChild(groupLi);
        });
    }
    
    function renderListaGrandesAreas() {
        const tbody = document.querySelector('#screen-lista-grandes-areas tbody');
        tbody.innerHTML = '';
        MOCK_DATA.grandesAreas.forEach(ga => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${ga.nome}</td><td class="actions"><a href="#" title="Editar" data-action="edit-grande-area" data-id="${ga.id}"><i class="fas fa-pencil-alt"></i></a><a href="#" title="Excluir" data-action="delete-grande-area" data-id="${ga.id}"><i class="fas fa-trash-alt"></i></a></td>`;
            tbody.appendChild(tr);
        });
    }
    
    function renderListaSistemas() {
        const tbody = document.querySelector('#screen-lista-sistemas tbody');
        tbody.innerHTML = '';
        MOCK_DATA.sistemas.forEach(sis => {
            const grandeAreaPai = MOCK_DATA.grandesAreas.find(g => g.id === sis.grandeAreaId);
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${sis.nome}</td><td>${grandeAreaPai ? grandeAreaPai.nome : 'N/A'}</td><td>${sis.areaResponsavel || 'N/A'}</td><td class="actions"><a href="#" title="Editar" data-action="edit-sistema" data-id="${sis.id}"><i class="fas fa-pencil-alt"></i></a><a href="#" title="Excluir" data-action="delete-sistema" data-id="${sis.id}"><i class="fas fa-trash-alt"></i></a></td>`;
            tbody.appendChild(tr);
        });
    }

    function renderListaComponentes() {
        const tbody = document.querySelector('#screen-lista-componentes tbody');
        tbody.innerHTML = '';
        MOCK_DATA.componentes.forEach(comp => {
            const grandeArea = MOCK_DATA.grandesAreas.find(g => g.id === comp.grandeAreaId);
            const sistema = MOCK_DATA.sistemas.find(s => s.id === comp.sistemaId);
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${comp.nome}</td><td>${grandeArea ? grandeArea.nome : 'N/A'}</td><td>${sistema ? sistema.nome : 'N/A'}</td><td>${comp.criticidade}</td><td class="actions"><a href="#" title="Editar" data-action="edit-componente" data-id="${comp.id}"><i class="fas fa-pencil-alt"></i></a><a href="#" title="Excluir" data-action="delete-componente" data-id="${comp.id}"><i class="fas fa-trash-alt"></i></a></td>`;
            tbody.appendChild(tr);
        });
    }

    function renderCalendar() {
        const calendarContainer = document.getElementById('painel-calendario');
        calendarContainer.innerHTML = '';
        const month = calendarDate.getMonth();
        const year = calendarDate.getFullYear();
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const header = document.createElement('div');
        header.className = 'calendar-header';
        header.innerHTML = `<h3>${calendarDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()}</h3><div class="calendar-nav"><button id="prev-month"><i class="fas fa-chevron-left"></i></button><button id="next-month"><i class="fas fa-chevron-right"></i></button></div>`;
        calendarContainer.appendChild(header);
        const grid = document.createElement('div');
        grid.className = 'calendar-grid';
        const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        dayNames.forEach(day => grid.insertAdjacentHTML('beforeend', `<div class="day-name">${day}</div>`));
        for (let i = 0; i < firstDayOfMonth; i++) grid.insertAdjacentHTML('beforeend', '<div class="calendar-day other-month"></div>');
        for (let i = 1; i <= daysInMonth; i++) {
            const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const dayCell = document.createElement('div');
            dayCell.className = 'calendar-day';
            dayCell.textContent = i;
            dayCell.dataset.date = dateString;
            if (dateString === today.toISOString().slice(0, 10)) dayCell.classList.add('today');
            if (dateString === activeDateFilter) dayCell.classList.add('filtered');
            grid.appendChild(dayCell);
        }
        calendarContainer.appendChild(grid);
        populateCalendarWithTasks();
        document.getElementById('prev-month').addEventListener('click', () => { calendarDate.setMonth(calendarDate.getMonth() - 1); renderPainelManutencao(); });
        document.getElementById('next-month').addEventListener('click', () => { calendarDate.setMonth(calendarDate.getMonth() + 1); renderPainelManutencao(); });
    }

    function populateCalendarWithTasks() {
        const tasks = generateTaskInstances();
        tasks.forEach(t => {
            const dateStr = t.date.toISOString().slice(0, 10);
            const dayCell = document.querySelector(`.calendar-day[data-date="${dateStr}"]`);
            if (dayCell && !dayCell.querySelector('.task-dot')) {
                dayCell.classList.add('has-tasks');
                dayCell.insertAdjacentHTML('beforeend', '<div class="task-dot"></div>');
            }
        });
    }
    
    function applyFiltersAndRenderTable() {
        let tasks = getAllMaintenanceTasksForDisplay();
        const filters = {
            grandeAreaId: parseInt(document.getElementById('filter-grande-area').value),
            sistemaId: parseInt(document.getElementById('filter-sistema').value),
            componenteId: parseInt(document.getElementById('filter-componente').value),
            status: document.getElementById('filter-status').value,
            startDate: document.getElementById('filter-data-inicio').value,
            endDate: document.getElementById('filter-data-fim').value,
        };
    
        if (filters.grandeAreaId) tasks = tasks.filter(t => t.grandeAreaId === filters.grandeAreaId);
        if (filters.sistemaId) tasks = tasks.filter(t => t.sistemaId === filters.sistemaId);
        if (filters.componenteId) tasks = tasks.filter(t => t.componenteId === filters.componenteId);
        if (filters.status) tasks = tasks.filter(t => t.status === filters.status);
        if (filters.startDate) tasks = tasks.filter(t => t.date >= new Date(filters.startDate + 'T00:00:00'));
        if (filters.endDate) tasks = tasks.filter(t => t.date <= new Date(filters.endDate + 'T23:59:59'));
    
        tasks.sort((a, b) => {
            const valA = a[sortColumn];
            const valB = b[sortColumn];
            let comparison = 0;
            if (valA > valB) {
                comparison = 1;
            } else if (valA < valB) {
                comparison = -1;
            }
            return sortDirection === 'desc' ? comparison * -1 : comparison;
        });

        const tbody = document.getElementById('maintenance-table-body');
        tbody.innerHTML = '';
        tasks.forEach(t => {
            const statusClass = t.status === 'A vencer' ? 'pendente' : t.status.toLowerCase().replace('í', 'i');
            const tr = document.createElement('tr');
            const dateText = t.status === 'Concluída' ? `Realizada em: ${t.date.toLocaleDateString('pt-BR')}` : t.date.toLocaleDateString('pt-BR');
            let actionButton;
            if (t.status === 'Concluída') {
                actionButton = `<button class="btn btn-secondary" data-action="revert-task" data-history-id="${t.historyId}"><i class="fas fa-undo"></i> Reverter</button>`;
            } else {
                actionButton = `<button class="btn btn-primary" data-action="complete-task" data-componente-id="${t.componenteId}" data-tarefa-id="${t.tarefaId}"><i class="fas fa-check"></i> Concluir</button>`;
            }
            tr.innerHTML = `
                <td>${t.componenteName}</td>
                <td>${t.tarefaDescricao}</td>
                <td>${t.criticidade}</td>
                <td>${dateText}</td>
                <td><span class="status-badge ${statusClass}">${t.status}</span></td>
                <td class="actions">${actionButton}</td>
            `;
            tbody.appendChild(tr);
        });
        updateSortIcons();
    }
    
    function renderMaintenancesScreen() {
        populateMaintenanceFilters();
        applyFiltersAndRenderTable();
    }

    function populateMaintenanceFilters() {
        const gaSelect = document.getElementById('filter-grande-area');
        gaSelect.innerHTML = '<option value="">Todas</option>' + MOCK_DATA.grandesAreas.map(g => `<option value="${g.id}">${g.nome}</option>`).join('');
        document.getElementById('filter-sistema').innerHTML = '<option value="">Todos</option>';
        document.getElementById('filter-sistema').disabled = true;
        document.getElementById('filter-componente').innerHTML = '<option value="">Todos</option>';
        document.getElementById('filter-componente').disabled = true;
    }

    function updateSortIcons() {
        document.querySelectorAll('#maintenance-table th.sortable').forEach(th => {
            th.classList.remove('sorted-asc', 'sorted-desc');
            if (th.dataset.sortKey === sortColumn) {
                th.classList.add(sortDirection === 'asc' ? 'sorted-asc' : 'sorted-desc');
            }
        });
    }

    function handleCompleteTask(componenteId, tarefaId) {
        editingItemId = { componenteId, tarefaId };
        const componente = MOCK_DATA.componentes.find(c => c.id === componenteId);
        const sistema = MOCK_DATA.sistemas.find(s => s.id === componente.sistemaId);
        let tarefa = sistema.checklist.find(t => t.id === tarefaId);
        if (!tarefa) {
            tarefa = componente.tarefasEspecificas.find(t => t.id === tarefaId);
        }
        if (!componente || !tarefa) return;
        const todayStr = today.toISOString().slice(0, 10);
        const bodyHtml = `
            <form id="complete-task-form">
                <p><strong>Componente:</strong> ${componente.nome}</p>
                <p><strong>Serviço:</strong> ${tarefa.tarefa}</p>
                <div class="form-group">
                    <label for="completion-date">Data de Realização:</label>
                    <input type="date" id="completion-date" value="${todayStr}" required>
                </div>
                <div class="form-group">
                    <label for="completion-os">Nº da Ordem de Serviço (OS):</label>
                    <input type="text" id="completion-os" placeholder="Referência da OS externa">
                </div>
                <div class="form-group">
                    <label for="completion-obs">Observações:</label>
                    <textarea id="completion-obs" rows="3"></textarea>
                </div>
            </form>
        `;
        const footerHtml = `<button class="btn btn-secondary" data-action="cancel-modal">Cancelar</button><button class="btn btn-primary" data-action="save-completion">Salvar Conclusão</button>`;
        showModal('Concluir Serviço de Manutenção', bodyHtml, footerHtml);
    }

    function saveCompletion() {
        const { componenteId, tarefaId } = editingItemId;
        const completionDate = document.getElementById('completion-date').value;
        const completionOs = document.getElementById('completion-os').value.trim();
        const completionObs = document.getElementById('completion-obs').value.trim();
        if (!completionDate) { alert('A data de realização é obrigatória.'); return; }
        const newHistoryId = MOCK_DATA.historicoManutencoes.length > 0 ? Math.max(...MOCK_DATA.historicoManutencoes.map(h => h.id)) + 1 : 1;
        MOCK_DATA.historicoManutencoes.push({
            id: newHistoryId,
            componenteId: componenteId,
            tarefaId: tarefaId,
            data: completionDate,
            os: completionOs,
            obs: completionObs || 'Serviço concluído.'
        });
        closeModal();
        if (renderers[activeScreen]) renderers[activeScreen]();
    }

    function handleRevertTask(historyId) {
        editingItemId = historyId;
        const historyEntry = MOCK_DATA.historicoManutencoes.find(h => h.id === historyId);
        if (!historyEntry) return;
        const bodyHtml = `<p>Você tem certeza que deseja reverter esta conclusão? O registro será removido e o serviço voltará a ser agendado com base na execução anterior.</p>`;
        const footerHtml = `<button class="btn btn-secondary" data-action="cancel-modal">Cancelar</button><button class="btn btn-danger" data-action="confirm-revert-task">Confirmar Reversão</button>`;
        showModal('Reverter Conclusão de Serviço', bodyHtml, footerHtml);
    }

    function confirmRevertTask() {
        MOCK_DATA.historicoManutencoes = MOCK_DATA.historicoManutencoes.filter(h => h.id !== editingItemId);
        closeModal();
        if (renderers[activeScreen]) renderers[activeScreen]();
    }

    function handleShowReportModal() {
        const todayStr = today.toISOString().slice(0, 10);
        const bodyHtml = `
            <form id="report-form">
                <p>Selecione o período para gerar o relatório de serviços pendentes.</p>
                <div class="form-layout">
                    <div class="form-group">
                        <label for="report-start-date">Data Inicial:</label>
                        <input type="date" id="report-start-date" value="${todayStr}">
                    </div>
                    <div class="form-group">
                        <label for="report-end-date">Data Final:</label>
                        <input type="date" id="report-end-date">
                    </div>
                </div>
            </form>
        `;
        const footerHtml = `
            <button class="btn btn-secondary" data-action="cancel-modal">Cancelar</button>
            <button class="btn btn-primary" data-action="gerar-relatorio-confirmado">Gerar Relatório</button>
        `;
        showModal('Gerar Relatório de Manutenção', bodyHtml, footerHtml);
    }

    function generateReportPageHTML(tasks, period) {
        const groupedByComponent = tasks.reduce((acc, task) => {
            const componente = MOCK_DATA.componentes.find(c => c.id === task.componenteId);
            if (!acc[task.componenteId]) {
                acc[task.componenteId] = {
                    name: task.componenteName,
                    location: [componente.edificio, componente.andar, componente.sala, componente.complemento].filter(Boolean).join(', '),
                    tasks: []
                };
            }
            acc[task.componenteId].tasks.push(task);
            return acc;
        }, {});
    
        let reportHTML = `
            <!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Relatório de Manutenção Preventiva</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 20px; color: #333; }
                .report-container { max-width: 900px; margin: auto; }
                header { text-align: center; border-bottom: 2px solid #0056b3; padding-bottom: 10px; margin-bottom: 20px; }
                header h1 { margin: 0; color: #0056b3; } header p { margin: 5px 0; }
                .component-section { margin-bottom: 30px; page-break-inside: avoid; }
                .component-section h2 { background-color: #f4f6f9; padding: 10px; border-radius: 5px; margin-bottom: 5px; font-size: 1.2em; }
                .component-section p { margin: 0 0 10px 10px; font-style: italic; color: #6c757d; }
                table { width: 100%; border-collapse: collapse; }
                th, td { border: 1px solid #dee2e6; padding: 8px; text-align: left; font-size: 0.9em; }
                thead { background-color: #f8f9fa; } .obs-col { width: 35%; }
                .print-button { display: block; margin: 20px auto; padding: 10px 20px; font-size: 16px; cursor: pointer; border-radius: 5px; border: 1px solid #0056b3; background-color: #0056b3; color: white; }
                @media print { .print-button { display: none; } body { padding: 0; } }
            </style></head><body><div class="report-container">
                <header><h1>Plano de Manutenção Preventiva</h1><p>${period}</p><p>Gerado em: ${new Date().toLocaleString('pt-BR')}</p></header>
                <button class="print-button" onclick="window.print()">Imprimir Relatório</button>`;
    
        for (const componentId in groupedByComponent) {
            const group = groupedByComponent[componentId];
            group.tasks.sort((a, b) => a.date - b.date);
            reportHTML += `<div class="component-section"><h2>${group.name}</h2><p><strong>Localização:</strong> ${group.location}</p>
                <table><thead><tr><th>Serviço</th><th>Periodicidade</th><th>Data Prevista</th><th>Criticidade</th><th class="obs-col">Observações</th></tr></thead><tbody>`;
            group.tasks.forEach(task => {
                reportHTML += `<tr><td>${task.tarefaDescricao}</td><td>${task.periodicidade}</td><td>${task.date.toLocaleDateString('pt-BR')}</td><td>${task.criticidade}</td><td></td></tr>`;
            });
            reportHTML += `</tbody></table></div>`;
        }
    
        reportHTML += `</div></body></html>`;
    
        const reportWindow = window.open('', '_blank');
        reportWindow.document.write(reportHTML);
        reportWindow.document.close();
    }

    function handleGenerateReportFromModal() {
        const startDate = document.getElementById('report-start-date').value;
        const endDate = document.getElementById('report-end-date').value;
    
        if (!startDate || !endDate) {
            alert('Por favor, selecione a data inicial e a data final.');
            return;
        }
        if (new Date(startDate) > new Date(endDate)) {
            alert('A data inicial não pode ser posterior à data final.');
            return;
        }
    
        const allUpcomingTasks = generateTaskInstances();
        const filteredTasks = allUpcomingTasks.filter(task => {
            const taskDateOnly = new Date(task.date.toISOString().slice(0, 10) + 'T12:00:00');
            const start = new Date(startDate + 'T12:00:00');
            const end = new Date(endDate + 'T12:00:00');
            return taskDateOnly >= start && taskDateOnly <= end;
        });
    
        if (filteredTasks.length === 0) {
            alert('Nenhum serviço pendente encontrado para o período selecionado.');
            return;
        }
    
        const startFormatted = new Date(startDate + 'T12:00:00').toLocaleDateString('pt-BR');
        const endFormatted = new Date(endDate + 'T12:00:00').toLocaleDateString('pt-BR');
        const period = `Período: ${startFormatted} a ${endFormatted}`;
    
        generateReportPageHTML(filteredTasks, period);
        closeModal();
    }

    // --- NAVEGAÇÃO E EVENT LISTENERS GLOBAIS ---
    function navigateTo(screenId) {
        activeScreen = screenId;
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(screenId).classList.add('active');
        document.querySelectorAll('.nav-link').forEach(l => {
            l.classList.remove('active');
            l.classList.remove('parent-active');
        });
        const activeLink = document.querySelector(`.nav-link[data-target="${screenId}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
            const dropdown = activeLink.closest('.dropdown');
            if (dropdown) {
                dropdown.querySelector('a.nav-link').classList.add('parent-active');
            }
        }
        if (renderers[screenId]) renderers[screenId]();
    }
    
    document.body.addEventListener('click', (e) => {
        const target = e.target;
        const navLink = target.closest('.nav-link[data-target]');
        const dropdownLink = target.closest('.dropdown > a.nav-link');
        const calendarDay = target.closest('.calendar-day.has-tasks');
        const actionButton = target.closest('[data-action]');
        if (navLink) { e.preventDefault(); navigateTo(navLink.dataset.target); return; }
        if (dropdownLink) { e.preventDefault(); dropdownLink.parentElement.classList.toggle('open'); }
        if (calendarDay) { activeDateFilter = calendarDay.dataset.date; renderPainelManutencao(); }
        if (actionButton) {
            e.preventDefault();
            const action = actionButton.dataset.action;
            const id = parseInt(actionButton.dataset.id);
            const historyId = parseInt(actionButton.dataset.historyId);
            const componenteId = parseInt(actionButton.dataset.componenteId);
            const tarefaId = actionButton.dataset.tarefaId;
            const startDateInput = document.getElementById('filter-data-inicio');
            const endDateInput = document.getElementById('filter-data-fim');
            const todayForFilters = new Date(today);
            switch(action) {
                case 'voltar': navigateTo('screen-painel'); break;
                case 'clear-filter': activeDateFilter = null; calendarDate = new Date(today); renderPainelManutencao(); break;
                case 'criar-backup': alert('Backup simulado com sucesso!'); break;
                case 'restaurar-backup': if (confirm('Deseja simular a restauração?')) { alert('Dados restaurados! (Simulação)'); } break;
                case 'cancel-modal': closeModal(); break;
                case 'nova-grande-area': handleAddGrandeArea(); break;
                case 'edit-grande-area': handleEditGrandeArea(id); break;
                case 'delete-grande-area': handleDeleteGrandeArea(id); break;
                case 'save-grande-area': saveGrandeArea(); break;
                case 'confirm-delete-grande-area': confirmDeleteGrandeArea(); break;
                case 'novo-sistema': handleAddSistema(); break;
                case 'edit-sistema': handleEditSistema(id); break;
                case 'delete-sistema': handleDeleteSistema(id); break;
                case 'save-sistema': saveSistema(); break;
                case 'confirm-delete-sistema': confirmDeleteSistema(); break;
                case 'add-checklist-item':
                    const formGroup = actionButton.closest('.form-group');
                    if (formGroup) {
                        const container = formGroup.querySelector('.checklist-container');
                        if (container) addChecklistItem(container);
                    }
                    break;
                case 'remove-checklist-item': target.closest('.checklist-item').remove(); break;
                case 'novo-componente': handleAddComponente(); break;
                case 'edit-componente': handleEditComponente(id); break;
                case 'delete-componente': handleDeleteComponente(id); break;
                case 'save-componente': saveComponente(); break;
                case 'confirm-delete-componente': confirmDeleteComponente(); break;
                case 'complete-task': handleCompleteTask(componenteId, tarefaId); break;
                case 'save-completion': saveCompletion(); break;
                case 'revert-task': handleRevertTask(historyId); break;
                case 'confirm-revert-task': confirmRevertTask(); break;
                case 'toggle-task-group':
                    const groupHeader = actionButton.closest('.task-group-header');
                    if (groupHeader) {
                        groupHeader.parentElement.classList.toggle('open');
                    }
                    break;
                case 'toggle-alert-box':
                    actionButton.parentElement.classList.toggle('open');
                    break;
                case 'gerar-relatorio': handleShowReportModal(); break;
                case 'gerar-relatorio-confirmado': handleGenerateReportFromModal(); break;
                case 'filter-week':
                    const firstDayOfWeek = new Date(todayForFilters.setDate(todayForFilters.getDate() - todayForFilters.getDay()));
                    const lastDayOfWeek = new Date(todayForFilters.setDate(todayForFilters.getDate() - todayForFilters.getDay() + 6));
                    startDateInput.value = firstDayOfWeek.toISOString().slice(0, 10);
                    endDateInput.value = lastDayOfWeek.toISOString().slice(0, 10);
                    applyFiltersAndRenderTable();
                    break;
                case 'filter-month':
                    startDateInput.value = new Date(todayForFilters.getFullYear(), todayForFilters.getMonth(), 1).toISOString().slice(0, 10);
                    endDateInput.value = new Date(todayForFilters.getFullYear(), todayForFilters.getMonth() + 1, 0).toISOString().slice(0, 10);
                    applyFiltersAndRenderTable();
                    break;
                case 'filter-next-month':
                    const nextMonthStart = new Date(todayForFilters.getFullYear(), todayForFilters.getMonth() + 1, 1);
                    const nextMonthEnd = new Date(todayForFilters.getFullYear(), todayForFilters.getMonth() + 2, 0);
                    startDateInput.value = nextMonthStart.toISOString().slice(0, 10);
                    endDateInput.value = nextMonthEnd.toISOString().slice(0, 10);
                    applyFiltersAndRenderTable();
                    break;
                case 'clear-all-filters':
                    document.getElementById('maintenance-filters').querySelectorAll('select, input').forEach(el => el.value = '');
                    populateMaintenanceFilters();
                    applyFiltersAndRenderTable();
                    break;
            }
        }
    });
    
    modalBody.addEventListener('change', (e) => {
        const target = e.target;
        if (target.id === 'componente-grande-area') {
            const grandeAreaId = parseInt(target.value);
            updateSistemaOptions(grandeAreaId);
            updateInheritedInfo(null);
        }
        if (target.id === 'componente-sistema') {
            const sistemaId = parseInt(target.value);
            updateInheritedInfo(sistemaId);
        }
    });

    document.getElementById('maintenance-filters').addEventListener('change', (e) => {
        const target = e.target;
        if (target.id === 'filter-grande-area') {
            const gaId = parseInt(target.value);
            const sistemaSelect = document.getElementById('filter-sistema');
            const componenteSelect = document.getElementById('filter-componente');
            componenteSelect.innerHTML = '<option value="">Todos</option>';
            componenteSelect.disabled = true;
            if (gaId) {
                const sistemas = MOCK_DATA.sistemas.filter(s => s.grandeAreaId === gaId);
                sistemaSelect.innerHTML = '<option value="">Todos</option>' + sistemas.map(s => `<option value="${s.id}">${s.nome}</option>`).join('');
                sistemaSelect.disabled = false;
            } else {
                sistemaSelect.innerHTML = '<option value="">Todos</option>';
                sistemaSelect.disabled = true;
            }
        }
        if (target.id === 'filter-sistema') {
             const sistemaId = parseInt(target.value);
             const componenteSelect = document.getElementById('filter-componente');
             if (sistemaId) {
                const componentes = MOCK_DATA.componentes.filter(c => c.sistemaId === sistemaId);
                componenteSelect.innerHTML = '<option value="">Todos</option>' + componentes.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
                componenteSelect.disabled = false;
             } else {
                componenteSelect.innerHTML = '<option value="">Todos</option>';
                componenteSelect.disabled = true;
             }
        }
        applyFiltersAndRenderTable();
    });

    document.getElementById('maintenance-table').querySelector('thead').addEventListener('click', (e) => {
        const headerCell = e.target.closest('th.sortable');
        if (!headerCell) return;
        const newSortColumn = headerCell.dataset.sortKey;
        if (sortColumn === newSortColumn) {
            sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            sortColumn = newSortColumn;
            sortDirection = 'asc';
        }
        applyFiltersAndRenderTable();
    });

    navigateTo('screen-painel');
});
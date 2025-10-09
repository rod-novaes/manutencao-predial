document.addEventListener('DOMContentLoaded', () => {
    // --- ESTADO DA APLICAÇÃO ---
    let appData;
    const APP_DATA_KEY = 'gestorManutencaoData';

    let activeScreen = 'screen-painel';
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normaliza a data para o início do dia
    let calendarDate = new Date(today);
    let activeDateFilter = null;
    let editingItemId = null;
    let sortColumn = 'date';
    let sortDirection = 'asc';
    let pendingLoadedData = null;
    let maintenanceCurrentPage = 1;
    const maintenanceItemsPerPage = 15;
    let chartInstances = {};

    // --- FUNÇÕES DE PERSISTÊNCIA (LOCALSTORAGE) ---
    function getInitialEmptyData() {
        return {
            grandesAreas: [],
            sistemas: [],
            subSistemas: [],
            componentes: [],
            historicoManutencoes: [],
            // Adicionar contadores de ID
            nextGrandeAreaId: 1,
            nextSistemaId: 1,
            nextSubSistemaId: 1,
            nextComponenteId: 1,
            nextHistoricoId: 1
        };
    }

    function saveData() {
        try {
            const dataString = JSON.stringify(appData);
            localStorage.setItem(APP_DATA_KEY, dataString);
        } catch (error)
        {
            console.error("Erro ao salvar os dados no localStorage:", error);
            alert("Não foi possível salvar suas alterações. O armazenamento local pode estar cheio ou indisponível.");
        }
    }

    function loadData() {
        const savedData = localStorage.getItem(APP_DATA_KEY);
        if (savedData) {
            try {
                appData = JSON.parse(savedData);
            } catch (error) {
                console.error("Erro ao carregar os dados do localStorage. Iniciando com dados vazios.", error);
                appData = getInitialEmptyData();
            }
        } else {
            appData = getInitialEmptyData();
        }
        // Garante a retrocompatibilidade para dados salvos sem os contadores
        if (!appData.nextGrandeAreaId) {
            appData.nextGrandeAreaId = appData.grandesAreas.length > 0 ? Math.max(...appData.grandesAreas.map(g => g.id)) + 1 : 1;
        }
        if (!appData.nextSistemaId) {
            appData.nextSistemaId = appData.sistemas.length > 0 ? Math.max(...appData.sistemas.map(s => s.id)) + 1 : 1;
        }
        if (!appData.nextSubSistemaId) {
            appData.nextSubSistemaId = appData.subSistemas.length > 0 ? Math.max(...appData.subSistemas.map(ss => ss.id)) + 1 : 1;
        }
        if (!appData.nextComponenteId) {
            appData.nextComponenteId = appData.componentes.length > 0 ? Math.max(...appData.componentes.map(c => c.id)) + 1 : 1;
        }
        if (!appData.nextHistoricoId) {
            appData.nextHistoricoId = appData.historicoManutencoes.length > 0 ? Math.max(...appData.historicoManutencoes.map(h => h.id)) + 1 : 1;
        }
    }

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
            case 'Bimestral': nextDate.setMonth(nextDate.getMonth() + 2); break;
            case 'Trimestral': nextDate.setMonth(nextDate.getMonth() + 3); break;
            case 'Semestral': nextDate.setMonth(nextDate.getMonth() + 6); break;
            case 'Anual': nextDate.setFullYear(nextDate.getFullYear() + 1); break;
            default: break;
        }
        return nextDate;
    }

    function generateServiceInstances() {
        const upcomingServices = [];

        appData.componentes.forEach(componente => {
            const sistema = appData.sistemas.find(s => s.id === componente.sistemaId);
            if (!sistema) return;

            const subSistema = componente.subSistemaId ? appData.subSistemas.find(ss => ss.id === componente.subSistemaId) : null;

            const inheritedServices = sistema.checklist || [];
            const subSystemServices = subSistema ? subSistema.checklist : [];
            const specificServices = componente.servicosEspecificos || [];
            const allServicesForComponent = [...inheritedServices, ...subSystemServices, ...specificServices];

            allServicesForComponent.forEach(servico => {
                const historyForService = appData.historicoManutencoes
                    .filter(h => h.componenteId === componente.id && h.servicoId === servico.id)
                    .sort((a, b) => new Date(b.data) - new Date(a.data));
                
                if (historyForService.length > 0 && historyForService[0].status === 'Pendente') {
                    return; 
                }

                let lastCompletionDate;
                const lastCompletedEvent = historyForService.find(h => h.status === 'Concluído');

                if (lastCompletedEvent) {
                    lastCompletionDate = new Date(lastCompletedEvent.data + 'T12:00:00');
                } else {
                    const startDate = componente.dataInicio ? componente.dataInicio : today.toISOString().slice(0, 10);
                    lastCompletionDate = new Date(startDate + 'T12:00:00');
                    const dueDate = lastCompletionDate;
                    const status = dueDate < today ? 'Atrasada' : 'A vencer';
                    
                    const year = dueDate.getFullYear();
                    const month = String(dueDate.getMonth() + 1).padStart(2, '0');
                    const osNumero = `${year}-${month}-${componente.id}-${servico.id}`;

                    upcomingServices.push({
                        componenteId: componente.id, componenteName: componente.nome, servicoId: servico.id,
                        servicoDescricao: servico.servico, grandeAreaId: componente.grandeAreaId, sistemaId: componente.sistemaId, 
                        subSistemaId: componente.subSistemaId, criticidade: componente.criticidade, periodicidade: servico.periodicidade,
                        date: dueDate, status: status, type: 'upcoming', osNumero: osNumero
                    });
                    return;
                }
                
                const dueDate = calculateNextDueDate(lastCompletionDate, servico.periodicidade);
                const status = dueDate < today ? 'Atrasada' : 'A vencer';
                
                const year = dueDate.getFullYear();
                const month = String(dueDate.getMonth() + 1).padStart(2, '0');
                const osNumero = `${year}-${month}-${componente.id}-${servico.id}`;

                upcomingServices.push({
                    componenteId: componente.id, componenteName: componente.nome,
                    servicoId: servico.id, servicoDescricao: servico.servico,
                    periodicidade: servico.periodicidade, grandeAreaId: componente.grandeAreaId,
                    sistemaId: componente.sistemaId, subSistemaId: componente.subSistemaId,
                    criticidade: componente.criticidade, date: dueDate,
                    status: status, type: 'upcoming', osNumero: osNumero
                });
            });
        });
        return upcomingServices;
    }

    function getAllMaintenanceServicesForDisplay() {
        const upcomingAndOverdue = generateServiceInstances();
        
        const fromHistory = appData.historicoManutencoes.map(hist => {
            const componente = appData.componentes.find(c => c.id === hist.componenteId);
            if (!componente) return null;
            
            const sistema = appData.sistemas.find(s => s.id === componente.sistemaId);
            const subSistema = componente.subSistemaId ? appData.subSistemas.find(ss => ss.id === componente.subSistemaId) : null;

            let servico = sistema ? sistema.checklist.find(s => s.id === hist.servicoId) : null;
            if (!servico && subSistema) servico = subSistema.checklist.find(s => s.id === hist.servicoId);
            if (!servico && componente.servicosEspecificos) servico = componente.servicosEspecificos.find(s => s.id === hist.servicoId);
            
            return {
                historyId: hist.id,
                componenteId: componente.id,
                componenteName: componente.nome,
                servicoId: hist.servicoId,
                servicoDescricao: servico ? servico.servico : 'Serviço não encontrado',
                periodicidade: servico ? servico.periodicidade : 'N/A',
                grandeAreaId: componente.grandeAreaId,
                sistemaId: componente.sistemaId,
                subSistemaId: componente.subSistemaId,
                criticidade: componente.criticidade,
                date: new Date(hist.data + 'T12:00:00'),
                status: hist.status,
                type: 'from_history',
                osNumero: hist.os,
                obs: hist.obs,
                motivo: hist.motivo,
                motivoDetalhado: hist.motivoDetalhado,
            };
        }).filter(Boolean);

        return [...upcomingAndOverdue, ...fromHistory];
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
        const grandeArea = appData.grandesAreas.find(g => g.id === id);
        if (!grandeArea) return;
        const formHtml = getGrandeAreaFormHTML(grandeArea);
        const footerHtml = `<button class="btn btn-secondary" data-action="cancel-modal">Cancelar</button><button class="btn btn-primary" data-action="save-grande-area">Salvar Alterações</button>`;
        showModal('Editar Grande Área', formHtml, footerHtml);
        document.getElementById('grande-area-name').focus();
    }
    function handleDeleteGrandeArea(id) {
        editingItemId = id;
        const grandeArea = appData.grandesAreas.find(g => g.id === id);
        if (!grandeArea) return;
        const bodyHtml = `<p>Você tem certeza que deseja excluir a grande área <strong>"${grandeArea.nome}"</strong>? Esta ação não pode ser desfeita.</p>`;
        const footerHtml = `<button class="btn btn-secondary" data-action="cancel-modal">Cancelar</button><button class="btn btn-danger" data-action="confirm-delete-grande-area">Confirmar Exclusão</button>`;
        showModal('Confirmar Exclusão', bodyHtml, footerHtml);
    }
    function saveGrandeArea() {
        const input = document.getElementById('grande-area-name');
        if (!input.value.trim()) { alert('O nome da grande área não pode estar em branco.'); return; }
        if (editingItemId) {
            const grandeArea = appData.grandesAreas.find(g => g.id === editingItemId);
            grandeArea.nome = input.value;
        } else {
            const newId = appData.nextGrandeAreaId++; // Usa o contador e o incrementa
            appData.grandesAreas.push({ id: newId, nome: input.value });
        }
        saveData();
        renderListaGrandesAreas();
        closeModal();
    }
    function confirmDeleteGrandeArea() {
        appData.grandesAreas = appData.grandesAreas.filter(g => g.id !== editingItemId);
        saveData();
        renderListaGrandesAreas();
        closeModal();
    }

    function getSistemaFormHTML(sistema = {}) {
        const { nome = '', grandeAreaId = '', areaResponsavel = '', pessoaResponsavel = '', checklist = [{servico: '', periodicidade: 'Mensal'}] } = sistema;
        const grandeAreaOptions = appData.grandesAreas.map(ga => `<option value="${ga.id}" ${ga.id === grandeAreaId ? 'selected' : ''}>${ga.nome}</option>`).join('');
        const checklistItems = checklist.map((item) => {
            const selectedPeriodicidade = item.periodicidade || 'Mensal';
            const optionsWithSelected = ['Semanal', 'Mensal', 'Bimestral', 'Trimestral', 'Semestral', 'Anual'].map(p => `<option value="${p}" ${p === selectedPeriodicidade ? 'selected' : ''}>${p}</option>`).join('');
            return `<div class="checklist-item">
                        <input type="text" class="checklist-item-input" value="${item.servico || ''}" placeholder="Descreva o serviço">
                        <select class="checklist-item-periodicity">${optionsWithSelected}</select>
                        <button class="btn btn-danger remove-item-btn" data-action="remove-checklist-item" title="Remover item"><i class="fas fa-trash-alt"></i></button>
                    </div>`;
        }).join('');
        return `<form id="sistema-form">
                    <div class="form-group"><label for="sistema-grande-area">Grande Área:</label><select id="sistema-grande-area" required><option value="">Selecione...</option>${grandeAreaOptions}</select></div>
                    <div class="form-group"><label for="sistema-name">Nome do Sistema:</label><input type="text" id="sistema-name" value="${nome}" required></div>
                    <div class="form-group"><label for="sistema-area-responsavel">Área Responsável:</label><input type="text" id="sistema-area-responsavel" value="${areaResponsavel}"></div>
                    <div class="form-group"><label for="sistema-pessoa-responsavel">Pessoa Responsável:</label><input type="text" id="sistema-pessoa-responsavel" value="${pessoaResponsavel}"></div>
                    <div class="form-group">
                        <label>Serviços Padrão (Herdados por todos os Componentes deste Sistema):</label>
                        <div class="info-note"><i class="fas fa-info-circle"></i><p>Os serviços aqui cadastrados serão aplicados a <strong>todos</strong> os Componentes e Subsistemas associados a este Sistema.</p></div>
                        <div class="checklist-container">${checklistItems}</div>
                        <button type="button" class="btn btn-secondary" data-action="add-checklist-item"><i class="fas fa-plus"></i> Adicionar Serviço</button>
                    </div>
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
        const sistema = appData.sistemas.find(s => s.id === id);
        if (!sistema) return;
        const formHtml = getSistemaFormHTML(sistema);
        const footerHtml = `<button class="btn btn-secondary" data-action="cancel-modal">Cancelar</button><button class="btn btn-primary" data-action="save-sistema">Salvar Alterações</button>`;
        showModal('Editar Sistema (Plano de Manutenção)', formHtml, footerHtml);
    }
    function handleDeleteSistema(id) {
        editingItemId = id;
        const sistema = appData.sistemas.find(s => s.id === id);
        if (!sistema) return;
        const bodyHtml = `<p>Você tem certeza que deseja excluir o sistema <strong>"${sistema.nome}"</strong>?</p>`;
        const footerHtml = `<button class="btn btn-secondary" data-action="cancel-modal">Cancelar</button><button class="btn btn-danger" data-action="confirm-delete-sistema">Confirmar Exclusão</button>`;
        showModal('Confirmar Exclusão', bodyHtml, footerHtml);
    }
    function saveSistema() {
        const grandeAreaId = parseInt(document.getElementById('sistema-grande-area').value);
        const nome = document.getElementById('sistema-name').value.trim();
        const areaResponsavel = document.getElementById('sistema-area-responsavel').value.trim();
        const pessoaResponsavel = document.getElementById('sistema-pessoa-responsavel').value.trim();
        const checklistItems = document.querySelectorAll('#sistema-form .checklist-item');
        const checklist = Array.from(checklistItems).map((item, index) => {
            const servico = item.querySelector('.checklist-item-input').value.trim();
            const periodicidade = item.querySelector('.checklist-item-periodicity').value;
            if (!servico) return null;
            const idPrefix = editingItemId ? `s${editingItemId}` : 'new';
            const id = `${idPrefix}-t${Date.now() + index}`;
            return { id, servico, periodicidade };
        }).filter(Boolean);
        if (!nome || !grandeAreaId) { alert('Nome do Sistema e Grande Área são obrigatórios.'); return; }
        const data = { grandeAreaId, nome, areaResponsavel, pessoaResponsavel, checklist };
        if (editingItemId) {
            const index = appData.sistemas.findIndex(s => s.id === editingItemId);
            const originalSystem = appData.sistemas[index];
            data.checklist.forEach((newService) => {
                const existingService = originalSystem.checklist.find(oldService => oldService.servico === newService.servico);
                if (existingService) newService.id = existingService.id;
            });
            appData.sistemas[index] = { ...originalSystem, ...data };
        } else {
            const newId = appData.nextSistemaId++;
            appData.sistemas.push({ id: newId, ...data });
        }
        saveData();
        renderListaSistemas();
        closeModal();
    }
    function confirmDeleteSistema() {
        appData.sistemas = appData.sistemas.filter(s => s.id !== editingItemId);
        saveData();
        renderListaSistemas();
        closeModal();
    }

    function getSubSistemaFormHTML(subSistema = {}) {
        const { nome = '', sistemaId = '', checklist = [{servico: '', periodicidade: 'Mensal'}] } = subSistema;
        const sistema = appData.sistemas.find(s => s.id === sistemaId);
        const grandeAreaId = sistema ? sistema.grandeAreaId : '';

        const grandeAreaOptions = appData.grandesAreas.map(ga => `<option value="${ga.id}" ${ga.id === grandeAreaId ? 'selected' : ''}>${ga.nome}</option>`).join('');
        
        const checklistItems = checklist.map((item) => {
            const selectedPeriodicidade = item.periodicidade || 'Mensal';
            const optionsWithSelected = ['Semanal', 'Mensal', 'Bimestral', 'Trimestral', 'Semestral', 'Anual'].map(p => `<option value="${p}" ${p === selectedPeriodicidade ? 'selected' : ''}>${p}</option>`).join('');
            return `<div class="checklist-item">
                        <input type="text" class="checklist-item-input" value="${item.servico || ''}" placeholder="Descreva o serviço">
                        <select class="checklist-item-periodicity">${optionsWithSelected}</select>
                        <button class="btn btn-danger remove-item-btn" data-action="remove-checklist-item" title="Remover item"><i class="fas fa-trash-alt"></i></button>
                    </div>`;
        }).join('');

        return `<form id="subsistema-form">
                    <div class="form-group">
                        <label for="subsistema-grande-area">Grande Área:</label>
                        <select id="subsistema-grande-area" required><option value="">Selecione...</option>${grandeAreaOptions}</select>
                    </div>
                    <div class="form-group">
                        <label for="subsistema-sistema">Sistema Pai:</label>
                        <select id="subsistema-sistema" required disabled><option value="">Selecione uma Grande Área</option></select>
                    </div>
                    <div class="form-group">
                        <label for="subsistema-name">Nome do Subsistema:</label>
                        <input type="text" id="subsistema-name" value="${nome}" required>
                    </div>
                    <div class="form-group">
                        <label>Serviços Específicos do Subsistema:</label>
                        <div class="info-note"><i class="fas fa-info-circle"></i><p>Estes serviços serão aplicados <strong>apenas</strong> aos Componentes associados a este Subsistema, em adição aos serviços do Sistema Pai.</p></div>
                        <div class="checklist-container">${checklistItems}</div>
                        <button type="button" class="btn btn-secondary" data-action="add-checklist-item"><i class="fas fa-plus"></i> Adicionar Serviço</button>
                    </div>
                </form>`;
    }
    function updateSistemaOptionsForSubSistema(grandeAreaId, selectedSistemaId = null) {
        const sistemaSelect = document.getElementById('subsistema-sistema');
        const filteredSistemas = appData.sistemas.filter(s => s.grandeAreaId === grandeAreaId);
        if (grandeAreaId && filteredSistemas.length > 0) {
            sistemaSelect.innerHTML = '<option value="">Selecione...</option>' + filteredSistemas.map(s => `<option value="${s.id}" ${s.id === selectedSistemaId ? 'selected' : ''}>${s.nome}</option>`).join('');
            sistemaSelect.disabled = false;
        } else {
            sistemaSelect.innerHTML = '<option value="">Nenhum sistema encontrado</option>';
            sistemaSelect.disabled = true;
        }
    }
    function handleAddSubSistema() {
        editingItemId = null;
        const formHtml = getSubSistemaFormHTML();
        const footerHtml = `<button class="btn btn-secondary" data-action="cancel-modal">Cancelar</button><button class="btn btn-primary" data-action="save-subsistema">Salvar</button>`;
        showModal('Novo Subsistema', formHtml, footerHtml);
    }
    function handleEditSubSistema(id) {
        editingItemId = id;
        const subSistema = appData.subSistemas.find(ss => ss.id === id);
        if (!subSistema) return;
        
        const formHtml = getSubSistemaFormHTML(subSistema);
        const footerHtml = `<button class="btn btn-secondary" data-action="cancel-modal">Cancelar</button><button class="btn btn-primary" data-action="save-subsistema">Salvar Alterações</button>`;
        showModal('Editar Subsistema', formHtml, footerHtml);
        
        const sistemaPai = appData.sistemas.find(s => s.id === subSistema.sistemaId);
        if (sistemaPai) {
            document.getElementById('subsistema-grande-area').value = sistemaPai.grandeAreaId;
            updateSistemaOptionsForSubSistema(sistemaPai.grandeAreaId, subSistema.sistemaId);
        }
    }
    function handleDeleteSubSistema(id) {
        editingItemId = id;
        const subSistema = appData.subSistemas.find(ss => ss.id === id);
        if (!subSistema) return;
        const bodyHtml = `<p>Você tem certeza que deseja excluir o subsistema <strong>"${subSistema.nome}"</strong>?</p>`;
        const footerHtml = `<button class="btn btn-secondary" data-action="cancel-modal">Cancelar</button><button class="btn btn-danger" data-action="confirm-delete-subsistema">Confirmar Exclusão</button>`;
        showModal('Confirmar Exclusão', bodyHtml, footerHtml);
    }
    function saveSubSistema() {
        const sistemaId = parseInt(document.getElementById('subsistema-sistema').value);
        const nome = document.getElementById('subsistema-name').value.trim();
        const checklistItems = document.querySelectorAll('#subsistema-form .checklist-item');
        const checklist = Array.from(checklistItems).map((item, index) => {
            const servico = item.querySelector('.checklist-item-input').value.trim();
            const periodicidade = item.querySelector('.checklist-item-periodicity').value;
            if (!servico) return null;
            const idPrefix = editingItemId ? `ss${editingItemId}` : 'new';
            const id = `${idPrefix}-t${Date.now() + index}`;
            return { id, servico, periodicidade };
        }).filter(Boolean);

        if (!nome || !sistemaId) { alert('Nome do Subsistema e Sistema Pai são obrigatórios.'); return; }
        const data = { sistemaId, nome, checklist };

        if (editingItemId) {
            const index = appData.subSistemas.findIndex(ss => ss.id === editingItemId);
            appData.subSistemas[index] = { ...appData.subSistemas[index], ...data };
        } else {
            const newId = appData.nextSubSistemaId++;
            appData.subSistemas.push({ id: newId, ...data });
        }
        saveData();
        renderListaSubSistemas();
        closeModal();
    }
    function confirmDeleteSubSistema() {
        appData.subSistemas = appData.subSistemas.filter(ss => ss.id !== editingItemId);
        saveData();
        renderListaSubSistemas();
        closeModal();
    }

    function addChecklistItem(container) {
        if (!container) return;
        const newItem = document.createElement('div');
        newItem.className = 'checklist-item';
        const periodicidadeOptions = ['Semanal', 'Mensal', 'Bimestral', 'Trimestral', 'Semestral', 'Anual'].map(p => `<option value="${p}" ${p === 'Mensal' ? 'selected' : ''}>${p}</option>`).join('');
        newItem.innerHTML = `<input type="text" class="checklist-item-input" placeholder="Descreva o serviço">
                             <select class="checklist-item-periodicity">${periodicidadeOptions}</select>
                             <button class="btn btn-danger remove-item-btn" data-action="remove-checklist-item" title="Remover item"><i class="fas fa-trash-alt"></i></button>`;
        container.appendChild(newItem);
        newItem.querySelector('input').focus();
    }

    function getComponenteFormHTML(componente = {}) {
        const { nome = '', grandeAreaId = '', sistemaId = '', subSistemaId = null, criticidade = 'Classe B', edificio = '', andar = '', sala = '', complemento = '', dataInicio = '', servicosEspecificos = [{ servico: '', periodicidade: 'Mensal' }] } = componente;
        const grandeAreaOptions = appData.grandesAreas.map(ga => `<option value="${ga.id}" ${ga.id === grandeAreaId ? 'selected' : ''}>${ga.nome}</option>`).join('');
        const criticidadeOptions = ['Classe A', 'Classe B', 'Classe C'].map(c => `<option value="${c}" ${c === criticidade ? 'selected' : ''}>${c}</option>`).join('');
        const servicosItems = servicosEspecificos.map((item) => {
            const selectedPeriodicidade = item.periodicidade || 'Mensal';
            const optionsWithSelected = ['Semanal', 'Mensal', 'Bimestral', 'Trimestral', 'Semestral', 'Anual'].map(p => `<option value="${p}" ${p === selectedPeriodicidade ? 'selected' : ''}>${p}</option>`).join('');
            return `<div class="checklist-item">
                        <input type="text" class="checklist-item-input" value="${item.servico || ''}" placeholder="Descreva o serviço específico">
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
                    <select id="componente-sistema" required disabled><option value="">Selecione uma grande área</option></select>
                </div>
                <div class="form-group">
                    <label for="componente-subsistema">Subsistema (Opcional):</label>
                    <select id="componente-subsistema" disabled><option value="">Selecione um Sistema</option></select>
                    <small id="subsistema-helper-text">Selecione um Sistema para ver os Subsistemas disponíveis.</small>
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
                        <div class="form-group"><label for="componente-edificio">Edifício:</label><input type="text" id="componente-edificio" value="${edificio}"></div>
                        <div class="form-group"><label for="componente-andar">Andar/Piso:</label><input type="text" id="componente-andar" value="${andar}"></div>
                        <div class="form-group"><label for="componente-sala">Sala/Ambiente:</label><input type="text" id="componente-sala" value="${sala}"></div>
                        <div class="form-group"><label for="componente-complemento">Complemento do Local:</label><input type="text" id="componente-complemento" value="${complemento}"></div>
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
                    <div class="checklist-container" id="specific-services-container">${servicosItems}</div>
                    <button type="button" class="btn btn-secondary" data-action="add-checklist-item"><i class="fas fa-plus"></i> Adicionar Serviço Específico</button>
                </div>
            </form>
        `;
    }
    function updateSistemaOptions(grandeAreaId, selectedSistemaId = null) {
        const sistemaSelect = document.getElementById('componente-sistema');
        const filteredSistemas = appData.sistemas.filter(s => s.grandeAreaId === grandeAreaId);
        if (filteredSistemas.length > 0) {
            sistemaSelect.innerHTML = '<option value="">Selecione...</option>' + filteredSistemas.map(s => `<option value="${s.id}" ${s.id === selectedSistemaId ? 'selected' : ''}>${s.nome}</option>`).join('');
            sistemaSelect.disabled = false;
        } else {
            sistemaSelect.innerHTML = '<option value="">Nenhum sistema encontrado</option>';
            sistemaSelect.disabled = true;
        }
        updateSubSistemaOptions(null);
    }
    function updateSubSistemaOptions(sistemaId, selectedSubSistemaId = null) {
        const subSistemaSelect = document.getElementById('componente-subsistema');
        const helperText = document.getElementById('subsistema-helper-text');
        if (!sistemaId) {
            subSistemaSelect.innerHTML = '<option value="">Selecione um Sistema</option>';
            subSistemaSelect.disabled = true;
            helperText.textContent = 'Selecione um Sistema para ver os Subsistemas disponíveis.';
            return;
        }
        const filteredSubSistemas = appData.subSistemas.filter(ss => ss.sistemaId === sistemaId);
        if (filteredSubSistemas.length > 0) {
            subSistemaSelect.innerHTML = '<option value="">Nenhum</option>' + filteredSubSistemas.map(ss => `<option value="${ss.id}" ${ss.id === selectedSubSistemaId ? 'selected' : ''}>${ss.nome}</option>`).join('');
            subSistemaSelect.disabled = false;
            helperText.textContent = 'Selecione um Subsistema se este Componente pertencer a um grupo específico.';
        } else {
            subSistemaSelect.innerHTML = '<option value="">Nenhum Subsistema disponível</option>';
            subSistemaSelect.disabled = true;
            helperText.textContent = 'Este Sistema não possui Subsistemas cadastrados.';
        }
    }
    function updateInheritedInfo(sistemaId, subSistemaId) {
        const infoContainer = document.getElementById('inherited-info-container');
        const sistema = appData.sistemas.find(s => s.id === sistemaId);
        const subSistema = subSistemaId ? appData.subSistemas.find(ss => ss.id === subSistemaId) : null;

        if (!sistema) {
            infoContainer.style.display = 'none';
            infoContainer.innerHTML = '';
            return;
        }

        let inheritedHtml = `<h5>Informações Herdadas</h5>`;
        if (sistema) {
            const checklistHtml = sistema.checklist.length > 0 ? `<ul>${sistema.checklist.map(item => `<li>${item.servico} (<strong>${item.periodicidade}</strong>)</li>`).join('')}</ul>` : '<p>Nenhum serviço padrão.</p>';
            inheritedHtml += `<p><strong>Do Sistema "${sistema.nome}":</strong></p>${checklistHtml}`;
        }
        if (subSistema) {
            const checklistHtml = subSistema.checklist.length > 0 ? `<ul>${subSistema.checklist.map(item => `<li>${item.servico} (<strong>${item.periodicidade}</strong>)</li>`).join('')}</ul>` : '<p>Nenhum serviço padrão.</p>';
            inheritedHtml += `<p style="margin-top: 15px;"><strong>Do Subsistema "${subSistema.nome}":</strong></p>${checklistHtml}`;
        }
        
        infoContainer.innerHTML = inheritedHtml;
        infoContainer.style.display = 'block';
    }
    function handleAddComponente() {
        editingItemId = null;
        const formHtml = getComponenteFormHTML({ dataInicio: new Date().toISOString().slice(0, 10) });
        const footerHtml = `<button class="btn btn-secondary" data-action="cancel-modal">Cancelar</button><button class="btn btn-primary" data-action="save-componente">Salvar</button>`;
        showModal('Novo Componente', formHtml, footerHtml);
    }
    function handleEditComponente(id) {
        editingItemId = id;
        const componente = appData.componentes.find(c => c.id === id);
        if (!componente) return;
        const formHtml = getComponenteFormHTML(componente);
        const footerHtml = `<button class="btn btn-secondary" data-action="cancel-modal">Cancelar</button><button class="btn btn-primary" data-action="save-componente">Salvar Alterações</button>`;
        showModal('Editar Componente', formHtml, footerHtml);
        updateSistemaOptions(componente.grandeAreaId, componente.sistemaId);
        updateSubSistemaOptions(componente.sistemaId, componente.subSistemaId);
        updateInheritedInfo(componente.sistemaId, componente.subSistemaId);
    }
    function handleDeleteComponente(id) {
        editingItemId = id;
        const componente = appData.componentes.find(c => c.id === id);
        if (!componente) return;
        const bodyHtml = `<p>Você tem certeza que deseja excluir o componente <strong>"${componente.nome}"</strong> e todo o seu histórico de manutenção?</p>`;
        const footerHtml = `<button class="btn btn-secondary" data-action="cancel-modal">Cancelar</button><button class="btn btn-danger" data-action="confirm-delete-componente">Confirmar Exclusão</button>`;
        showModal('Confirmar Exclusão', bodyHtml, footerHtml);
    }
    function saveComponente() {
        const grandeAreaId = parseInt(document.getElementById('componente-grande-area').value);
        const sistemaId = parseInt(document.getElementById('componente-sistema').value);
        const subSistemaId = parseInt(document.getElementById('componente-subsistema').value) || null;
        const nome = document.getElementById('componente-name').value.trim();
        const criticidade = document.getElementById('componente-criticidade').value;
        const edificio = document.getElementById('componente-edificio').value.trim();
        const andar = document.getElementById('componente-andar').value.trim();
        const sala = document.getElementById('componente-sala').value.trim();
        const complemento = document.getElementById('componente-complemento').value.trim();
        const dataInicio = document.getElementById('componente-data-inicio').value;
        const specificServiceItems = document.querySelectorAll('#specific-services-container .checklist-item');
        const servicosEspecificos = Array.from(specificServiceItems).map((item, index) => {
            const servico = item.querySelector('.checklist-item-input').value.trim();
            const periodicidade = item.querySelector('.checklist-item-periodicity').value;
            if (!servico) return null;
            const idPrefix = editingItemId ? `c${editingItemId}` : 'new';
            const id = `${idPrefix}-t${Date.now() + index}`;
            return { id, servico, periodicidade };
        }).filter(Boolean);
        if (!grandeAreaId || !sistemaId || !nome || !dataInicio) { alert('Grande Área, Sistema, Nome e Data de Início são obrigatórios.'); return; }
        const data = { grandeAreaId, sistemaId, subSistemaId, nome, criticidade, edificio, andar, sala, complemento, dataInicio, servicosEspecificos };
        if (editingItemId) {
            const componente = appData.componentes.find(c => c.id === editingItemId);
            data.servicosEspecificos.forEach((newService) => {
                const existingService = componente.servicosEspecificos.find(oldService => oldService.servico === newService.servico);
                if (existingService) newService.id = existingService.id;
            });
            Object.assign(componente, data);
        } else {
            const newId = appData.nextComponenteId++;
            appData.componentes.push({ id: newId, ...data });
        }
        saveData();
        renderListaComponentes();
        closeModal();
    }
    function confirmDeleteComponente() {
        appData.componentes = appData.componentes.filter(c => c.id !== editingItemId);
        appData.historicoManutencoes = appData.historicoManutencoes.filter(h => h.componenteId !== editingItemId);
        saveData();
        renderListaComponentes();
        closeModal();
    }

    // --- FUNÇÕES DE RENDERIZAÇÃO ---
    const renderers = {
        'screen-painel': renderPainelManutencao,
        'screen-lista-componentes': () => {
            populateComponentFilters();
            renderListaComponentes();
        },
        'screen-lista-grandes-areas': renderListaGrandesAreas,
        'screen-lista-sistemas': () => {
            populateSistemasFilters();
            renderListaSistemas();
        },
        'screen-lista-subsistemas': () => {
            populateSubSistemasFilters();
            renderListaSubSistemas();
        },
        'screen-manutencoes': renderMaintenancesScreen,
        'screen-indicadores': renderIndicadoresScreen,
        'screen-relatorios': () => {},
    };

    function renderPainelManutencao() {
        if (appData.componentes.length === 0) {
            const painelScreen = document.getElementById('screen-painel');
            painelScreen.innerHTML = `
                <div class="card" style="text-align: center; padding: 40px;">
                    <i class="fas fa-rocket" style="font-size: 3em; color: var(--primary-color); margin-bottom: 20px;"></i>
                    <h1 class="screen-title"><span style="font-size: 85%">Bem-vindo ao</span><br>Gestor de Manutenção Predial Preventiva!</h1><br>
                    <p style="font-size: 1.1em; max-width: 600px; margin: 0 auto 25px;">
                        Parece que você está começando agora. O primeiro passo é organizar seus planos de manutenção.
                    </p>
                    <div style="display: flex; justify-content: center; gap: 15px;">
                        <button class="btn btn-primary" data-action="go-to-grandes-areas">
                            <i class="fas fa-tags"></i> Comece cadastrando uma Grande Área
                        </button>
                    </div>
                </div>
            `;
            return;
        }

        const allServices = getAllMaintenanceServicesForDisplay();
        const painelTitle = document.getElementById('painel-main-title');
        const clearFilterBtn = document.getElementById('clear-filter-btn');
    
        const inicioMesCorrente = new Date(today.getFullYear(), today.getMonth(), 1);
        const fimMesCorrente = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        fimMesCorrente.setHours(23, 59, 59, 999);
    
        const inicioProximoMes = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    
        if (activeDateFilter) {
            const dataFormatada = new Date(activeDateFilter + 'T12:00:00').toLocaleDateString('pt-BR');
            painelTitle.textContent = `Serviços para ${dataFormatada}`;
            clearFilterBtn.style.display = 'block';
    
            const servicesOnDay = allServices.filter(s => s.date.toISOString().slice(0, 10) === activeDateFilter);
    
            const criticasDoDia = servicesOnDay.filter(s => s.status === 'Atrasada');
            const pendentesDoDia = servicesOnDay.filter(s => s.status === 'Pendente');
            const mesDoDia = servicesOnDay.filter(s => s.status === 'A vencer' && s.date >= inicioMesCorrente && s.date <= fimMesCorrente);
            const proximoMesDoDia = servicesOnDay.filter(s => s.status === 'A vencer' && s.date >= inicioProximoMes);
    
            renderServiceListToPanel(document.querySelector('#alertas-criticas .lista-os'), criticasDoDia, 'status-critica');
            renderServiceListToPanel(document.querySelector('#alertas-pendentes .lista-os'), pendentesDoDia, 'status-pendente-painel');
            renderServiceListToPanel(document.querySelector('#alertas-mes .lista-os'), mesDoDia, 'status-mes');
            renderServiceListToPanel(document.querySelector('#alertas-proximo-mes .lista-os'), proximoMesDoDia, 'status-proximo-mes');
            
            if (criticasDoDia.length > 0) document.getElementById('alertas-criticas').classList.add('open');
            if (pendentesDoDia.length > 0) document.getElementById('alertas-pendentes').classList.add('open');
            if (mesDoDia.length > 0) document.getElementById('alertas-mes').classList.add('open');
            if (proximoMesDoDia.length > 0) document.getElementById('alertas-proximo-mes').classList.add('open');

            renderCalendar();
            return;
        }
    
        painelTitle.textContent = 'Painel de Serviços';
        clearFilterBtn.style.display = 'none';
    
        const criticas = allServices.filter(s => s.status === 'Atrasada');
        const pendentes = allServices.filter(s => s.status === 'Pendente');
        const mes = allServices.filter(s => s.status === 'A vencer' && s.date >= inicioMesCorrente && s.date <= fimMesCorrente);
        const proximosMeses = allServices.filter(s => s.status === 'A vencer' && s.date >= inicioProximoMes);
    
        renderServiceListToPanel(document.querySelector('#alertas-criticas .lista-os'), criticas, 'status-critica');
        renderServiceListToPanel(document.querySelector('#alertas-pendentes .lista-os'), pendentes, 'status-pendente-painel');
        renderServiceListToPanel(document.querySelector('#alertas-mes .lista-os'), mes, 'status-mes');
        renderServiceListToPanel(document.querySelector('#alertas-proximo-mes .lista-os'), proximosMeses, 'status-proximo-mes');
        renderCalendar();
        
        document.getElementById('alertas-mes').classList.add('open');
    }

    function renderServiceListToPanel(ulElement, serviceList, cssClass) {
        if (!ulElement) return;
        ulElement.innerHTML = '';
        if (serviceList.length === 0) {
            ulElement.innerHTML = '<li>Nenhum serviço encontrado.</li>';
            return;
        }
        const groupedByComponent = serviceList.reduce((acc, service) => {
            if (!acc[service.componenteId]) {
                acc[service.componenteId] = { name: service.componenteName, services: [] };
            }
            acc[service.componenteId].services.push(service);
            return acc;
        }, {});

        const componentKeys = Object.keys(groupedByComponent);
        const limitedKeys = componentKeys.slice(0, 8);

        limitedKeys.forEach(key => {
            const group = groupedByComponent[key];
            group.services.sort((a, b) => a.date - b.date);
            const groupLi = document.createElement('li');
            groupLi.className = `service-group ${cssClass}`;
            const header = document.createElement('div');
            header.className = 'service-group-header';
            header.dataset.action = 'toggle-service-group';
            header.innerHTML = `<span class="component-name">${group.name}</span>
                                <span class="service-count">${group.services.length} serviço(s)</span>
                                <i class="fas fa-chevron-down expand-icon"></i>`;
            const sublist = document.createElement('ul');
            sublist.className = 'service-sublist';
            group.services.forEach(s => {
                const serviceLi = document.createElement('li');
                serviceLi.className = 'service-item';
                serviceLi.dataset.action = 'complete-service';
                serviceLi.dataset.componenteId = s.componenteId;
                serviceLi.dataset.servicoId = s.servicoId;
                serviceLi.dataset.osNumero = s.osNumero; // Adicionado para passar a OS
                const dateText = s.status === 'Pendente' ? `Pendente desde: ${s.date.toLocaleDateString('pt-BR')}` : `Vence em: ${s.date.toLocaleDateString('pt-BR')}`;
                serviceLi.innerHTML = `<small>${s.servicoDescricao}</small><span class="due-date">${dateText}</span>`;
                sublist.appendChild(serviceLi);
            });
            groupLi.appendChild(header);
            groupLi.appendChild(sublist);
            ulElement.appendChild(groupLi);
        });

        if (componentKeys.length > 8) {
            const remainingCount = componentKeys.length - 8;
            const viewAllLi = document.createElement('li');
            const filterType = cssClass.includes('critica') ? 'vencidos' : (cssClass.includes('mes') ? 'este-mes' : (cssClass.includes('pendente') ? 'pendentes' : 'proximo-mes'));
            viewAllLi.innerHTML = `<button class="btn view-all-button" data-action="view-all-services" data-filter="${filterType}">Ver os outros ${remainingCount} componentes...</button>`;
            ulElement.appendChild(viewAllLi);
        }
    }
    
    function renderListaGrandesAreas() {
        const tbody = document.querySelector('#screen-lista-grandes-areas tbody');
        tbody.innerHTML = '';
        appData.grandesAreas.forEach(ga => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${ga.nome}</td><td class="actions"><a href="#" title="Editar" data-action="edit-grande-area" data-id="${ga.id}"><i class="fas fa-pencil-alt"></i></a><a href="#" title="Excluir" data-action="delete-grande-area" data-id="${ga.id}"><i class="fas fa-trash-alt"></i></a></td>`;
            tbody.appendChild(tr);
        });
    }
    
    function renderListaSistemas(sistemas = appData.sistemas) {
        const tbody = document.querySelector('#screen-lista-sistemas tbody');
        tbody.innerHTML = '';
        sistemas.forEach(sis => {
            const grandeAreaPai = appData.grandesAreas.find(g => g.id === sis.grandeAreaId);
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${sis.nome}</td><td>${grandeAreaPai ? grandeAreaPai.nome : 'N/A'}</td><td>${sis.areaResponsavel || 'N/A'}</td><td>${sis.pessoaResponsavel || 'N/A'}</td><td class="actions"><a href="#" title="Editar" data-action="edit-sistema" data-id="${sis.id}"><i class="fas fa-pencil-alt"></i></a><a href="#" title="Excluir" data-action="delete-sistema" data-id="${sis.id}"><i class="fas fa-trash-alt"></i></a></td>`;
            tbody.appendChild(tr);
        });
    }

    function renderListaSubSistemas(subSistemas = appData.subSistemas) {
        const tbody = document.querySelector('#screen-lista-subsistemas tbody');
        tbody.innerHTML = '';
        subSistemas.forEach(sub => {
            const sistemaPai = appData.sistemas.find(s => s.id === sub.sistemaId);
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${sub.nome}</td><td>${sistemaPai ? sistemaPai.nome : 'N/A'}</td><td class="actions"><a href="#" title="Editar" data-action="edit-subsistema" data-id="${sub.id}"><i class="fas fa-pencil-alt"></i></a><a href="#" title="Excluir" data-action="delete-subsistema" data-id="${sub.id}"><i class="fas fa-trash-alt"></i></a></td>`;
            tbody.appendChild(tr);
        });
    }

    function renderListaComponentes(componentes = appData.componentes) {
        const tbody = document.querySelector('#screen-lista-componentes tbody');
        tbody.innerHTML = '';
        componentes.forEach(comp => {
            const grandeArea = appData.grandesAreas.find(g => g.id === comp.grandeAreaId);
            const sistema = appData.sistemas.find(s => s.id === comp.sistemaId);
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${comp.nome}</td><td>${grandeArea ? grandeArea.nome : 'N/A'}</td><td>${sistema ? sistema.nome : 'N/A'}</td><td>${comp.criticidade}</td><td class="actions"><a href="#" title="Editar" data-action="edit-componente" data-id="${comp.id}"><i class="fas fa-pencil-alt"></i></a><a href="#" title="Excluir" data-action="delete-componente" data-id="${comp.id}"><i class="fas fa-trash-alt"></i></a></td>`;
            tbody.appendChild(tr);
        });
    }

    function renderCalendar() {
        const calendarContainer = document.getElementById('painel-calendario');
        if (!calendarContainer) return;
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
        populateCalendarWithServices();
        document.getElementById('prev-month').addEventListener('click', () => { calendarDate.setMonth(calendarDate.getMonth() - 1); renderPainelManutencao(); });
        document.getElementById('next-month').addEventListener('click', () => { calendarDate.setMonth(calendarDate.getMonth() + 1); renderPainelManutencao(); });
    }

    function populateCalendarWithServices() {
        const services = getAllMaintenanceServicesForDisplay().filter(s => s.status !== 'Concluído');
        services.forEach(s => {
            const dateStr = s.date.toISOString().slice(0, 10);
            const dayCell = document.querySelector(`.calendar-day[data-date="${dateStr}"]`);
            if (dayCell && !dayCell.querySelector('.service-dot')) {
                dayCell.classList.add('has-services');
                dayCell.insertAdjacentHTML('beforeend', '<div class="service-dot"></div>');
            }
        });
    }
    
    function applyFiltersAndRenderTable() {
        let services = getAllMaintenanceServicesForDisplay();
        const filters = {
            grandeAreaId: parseInt(document.getElementById('filter-grande-area').value),
            sistemaId: parseInt(document.getElementById('filter-sistema').value),
            subSistemaId: parseInt(document.getElementById('filter-subsistema').value),
            componenteId: parseInt(document.getElementById('filter-componente').value),
            status: document.getElementById('filter-status').value,
            startDate: document.getElementById('filter-data-inicio').value,
            endDate: document.getElementById('filter-data-fim').value,
        };
    
        if (filters.grandeAreaId) services = services.filter(s => s.grandeAreaId === filters.grandeAreaId);
        if (filters.sistemaId) services = services.filter(s => s.sistemaId === filters.sistemaId);
        if (filters.subSistemaId) services = services.filter(s => s.subSistemaId === filters.subSistemaId);
        if (filters.componenteId) services = services.filter(s => s.componenteId === filters.componenteId);
        if (filters.status) services = services.filter(s => s.status === filters.status);
        if (filters.startDate) services = services.filter(s => s.date >= new Date(filters.startDate + 'T00:00:00'));
        if (filters.endDate) services = services.filter(s => s.date <= new Date(filters.endDate + 'T23:59:59'));
    
        services.sort((a, b) => {
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

        const totalItems = services.length;
        const startIndex = (maintenanceCurrentPage - 1) * maintenanceItemsPerPage;
        const endIndex = startIndex + maintenanceItemsPerPage;
        const paginatedServices = services.slice(startIndex, endIndex);

        const tbody = document.getElementById('maintenance-table-body');
        tbody.innerHTML = '';
        paginatedServices.forEach(s => {
            const statusClass = s.status.toLowerCase().replace('í', 'i').replace(' ', '-');
            const tr = document.createElement('tr');
            tr.dataset.action = 'view-service-details';
            tr.dataset.componenteId = s.componenteId;
            tr.dataset.servicoId = s.servicoId;
            tr.dataset.osNumero = s.osNumero; // Adicionado para passar a OS
            if (s.historyId) tr.dataset.historyId = s.historyId;

            let dateText, actionButton;
            switch (s.status) {
                case 'Concluído':
                    dateText = `Realizada em: ${s.date.toLocaleDateString('pt-BR')}`;
                    actionButton = `<button class="btn btn-secondary" data-action="revert-service" data-history-id="${s.historyId}"><i class="fas fa-undo"></i> Reverter</button>`;
                    break;
                case 'Pendente':
                    dateText = `Pendente desde: ${s.date.toLocaleDateString('pt-BR')}`;
                    actionButton = `<button class="btn btn-warning" data-action="complete-service" data-componente-id="${s.componenteId}" data-servico-id="${s.servicoId}" data-os-numero="${s.osNumero}"><i class="fas fa-check-circle"></i> Finalizar</button>`;
                    break;
                default:
                    dateText = s.date.toLocaleDateString('pt-BR');
                    actionButton = `<button class="btn btn-primary" data-action="complete-service" data-componente-id="${s.componenteId}" data-servico-id="${s.servicoId}" data-os-numero="${s.osNumero}"><i class="fas fa-check"></i> Concluir</button>`;
            }
            tr.innerHTML = `
                <td>${s.componenteName}</td>
                <td>${s.servicoDescricao}</td>
                <td>${s.criticidade}</td>
                <td>${dateText}</td>
                <td><span class="status-badge ${statusClass}">${s.status}</span></td>
                <td class="actions">${actionButton}</td>
            `;
            tbody.appendChild(tr);
        });
        updateSortIcons();
        renderPaginationControls(totalItems);
    }

    function renderPaginationControls(totalItems) {
        const controlsContainers = document.querySelectorAll('.pagination-controls');
        const totalPages = Math.ceil(totalItems / maintenanceItemsPerPage);

        if (totalPages <= 1) {
            controlsContainers.forEach(container => container.innerHTML = '');
            return;
        }

        let buttonsHtml = '';
        buttonsHtml += `<button class="page-btn" data-action="go-to-page" data-page="${maintenanceCurrentPage - 1}" ${maintenanceCurrentPage === 1 ? 'disabled' : ''}>Anterior</button>`;
        for (let i = 1; i <= totalPages; i++) {
            buttonsHtml += `<button class="page-btn ${i === maintenanceCurrentPage ? 'active' : ''}" data-action="go-to-page" data-page="${i}">${i}</button>`;
        }
        buttonsHtml += `<button class="page-btn" data-action="go-to-page" data-page="${maintenanceCurrentPage + 1}" ${maintenanceCurrentPage === totalPages ? 'disabled' : ''}>Próximo</button>`;
        controlsContainers.forEach(container => { container.innerHTML = buttonsHtml; });
    }
    
    function renderMaintenancesScreen() {
        populateMaintenanceFilters();
        applyFiltersAndRenderTable();
    }

    function populateMaintenanceFilters() {
        const gaSelect = document.getElementById('filter-grande-area');
        gaSelect.innerHTML = '<option value="">Todas</option>' + appData.grandesAreas.map(g => `<option value="${g.id}">${g.nome}</option>`).join('');
        document.getElementById('filter-sistema').innerHTML = '<option value="">Todos</option>';
        document.getElementById('filter-sistema').disabled = true;
        document.getElementById('filter-subsistema').innerHTML = '<option value="">Todos</option>';
        document.getElementById('filter-subsistema').disabled = true;
        document.getElementById('filter-componente').innerHTML = '<option value="">Todos</option>';
        document.getElementById('filter-componente').disabled = true;
    }

    function populateComponentFilters() {
        const gaSelect = document.getElementById('filter-comp-grande-area');
        gaSelect.innerHTML = '<option value="">Todas</option>' + appData.grandesAreas.map(g => `<option value="${g.id}">${g.nome}</option>`).join('');
        document.getElementById('filter-comp-sistema').innerHTML = '<option value="">Todos</option>';
        document.getElementById('filter-comp-sistema').disabled = true;
        document.getElementById('filter-comp-subsistema').innerHTML = '<option value="">Todos</option>';
        document.getElementById('filter-comp-subsistema').disabled = true;
    }

    function populateSistemasFilters() {
        const gaSelect = document.getElementById('filter-sis-grande-area');
        gaSelect.innerHTML = '<option value="">Todas</option>' + appData.grandesAreas.map(g => `<option value="${g.id}">${g.nome}</option>`).join('');
    }

    function populateSubSistemasFilters() {
        const gaSelect = document.getElementById('filter-subsis-grande-area');
        gaSelect.innerHTML = '<option value="">Todas</option>' + appData.grandesAreas.map(g => `<option value="${g.id}">${g.nome}</option>`).join('');
        document.getElementById('filter-subsis-sistema').innerHTML = '<option value="">Todos</option>';
        document.getElementById('filter-subsis-sistema').disabled = true;
    }

    function updateSortIcons() {
        document.querySelectorAll('#maintenance-table th.sortable').forEach(th => {
            th.classList.remove('sorted-asc', 'sorted-desc');
            if (th.dataset.sortKey === sortColumn) {
                th.classList.add(sortDirection === 'asc' ? 'sorted-asc' : 'sorted-desc');
            }
        });
    }

    function showStatusChoiceModal() {
        const { componenteId, servicoId, osNumero } = editingItemId;
        const bodyHtml = `
            <p>Como você deseja atualizar o status deste serviço?</p>
            <div class="form-actions" style="justify-content: center; gap: 20px;">
                <button class="btn btn-primary" data-action="choose-completed" data-componente-id="${componenteId}" data-servico-id="${servicoId}" data-os-numero="${osNumero}">
                    <i class="fas fa-check-circle"></i> Concluído
                </button>
                <button class="btn btn-secondary" data-action="choose-pending" data-componente-id="${componenteId}" data-servico-id="${servicoId}" data-os-numero="${osNumero}">
                    <i class="fas fa-pause-circle"></i> Pendente
                </button>
            </div>`;
        showModal('Atualizar Status do Serviço', bodyHtml, '');
    }

    function handleCompleteService(componenteId, servicoId, osNumero) {
        componenteId = parseInt(componenteId);
        
        const allServices = getAllMaintenanceServicesForDisplay();
        const service = allServices.find(s => s.componenteId === componenteId && s.servicoId === servicoId && s.osNumero === osNumero && s.status !== 'Concluído');

        if (!service) {
            console.error("Serviço ativo não encontrado para iniciar a ação.", {componenteId, servicoId, osNumero});
            alert("Erro: Serviço ativo não encontrado. Ele pode já ter sido concluído.");
            return;
        }
        
        editingItemId = { componenteId, servicoId, osNumero };
        showStatusChoiceModal();
    }

    function showCompletionForm() {
        const { componenteId, servicoId, osNumero } = editingItemId;
        const allServices = getAllMaintenanceServicesForDisplay();
        const service = allServices.find(s => s.osNumero === osNumero);
        
        const todayStr = today.toISOString().slice(0, 10);
        const bodyHtml = `
            <form id="complete-service-form">
                <p><strong>Componente:</strong> ${service.componenteName}</p>
                <p><strong>Serviço:</strong> ${service.servicoDescricao}</p>
                <p><strong>Nº da Ordem de Serviço (OS):</strong> ${osNumero}</p>
                <div class="form-group">
                    <label for="completion-date">Data de Realização:</label>
                    <input type="date" id="completion-date" value="${todayStr}" required>
                </div>
                <div class="form-group">
                    <label for="completion-obs">Observações:</label>
                    <textarea id="completion-obs" rows="3"></textarea>
                </div>
            </form>`;
        const footerHtml = `<button class="btn btn-secondary" data-action="cancel-modal">Cancelar</button><button class="btn btn-primary" data-action="save-completion">Salvar Conclusão</button>`;
        showModal('Concluir Serviço de Manutenção', bodyHtml, footerHtml);
    }
    
    function showPendingForm() {
        const { componenteId, servicoId, osNumero } = editingItemId;
        const service = getAllMaintenanceServicesForDisplay().find(s => s.osNumero === osNumero);

        const todayStr = today.toISOString().slice(0, 10);
        const bodyHtml = `
            <form id="pending-service-form">
                 <p><strong>Componente:</strong> ${service.componenteName}</p>
                 <p><strong>Serviço:</strong> ${service.servicoDescricao}</p>
                 <p><strong>Nº da Ordem de Serviço (OS):</strong> ${osNumero}</p>
                <div class="form-group">
                    <label for="pending-date">Data da Pendência:</label>
                    <input type="date" id="pending-date" value="${todayStr}" required>
                </div>
                <div class="form-group">
                    <label for="pending-reason">Motivo da Pendência:</label>
                    <select id="pending-reason" required>
                        <option value="">Selecione...</option>
                        <option value="Material insuficiente">Material insuficiente</option>
                        <option value="Clima impróprio">Clima impróprio</option>
                        <option value="Falta de autorização">Falta de autorização</option>
                        <option value="Pessoal insuficiente">Pessoal insuficiente</option>
                        <option value="Outros">Outros</option>
                    </select>
                </div>
                <div class="form-group hidden" id="other-reason-group">
                    <label for="pending-reason-other">Especifique o motivo:</label>
                    <input type="text" id="pending-reason-other" placeholder="Ex: Aguardando peça importada">
                </div>
                <div class="form-group">
                    <label for="pending-details">Detalhes da Pendência (Opcional):</label>
                    <textarea id="pending-details" rows="3" placeholder="Adicione mais informações, se necessário..."></textarea>
                </div>
            </form>`;
        const footerHtml = `<button class="btn btn-secondary" data-action="cancel-modal">Cancelar</button><button class="btn btn-primary" data-action="save-pending-status">Salvar Pendência</button>`;
        showModal('Registrar Pendência', bodyHtml, footerHtml);
    }

    // --- MODIFICAÇÃO INICIADA: saveCompletion ---
    function saveCompletion() {
        const { componenteId, servicoId, osNumero } = editingItemId;
        const completionDate = document.getElementById('completion-date').value;
        const completionObs = document.getElementById('completion-obs').value.trim();
        
        if (!completionDate) { 
            alert('A data de realização é obrigatória.'); 
            return; 
        }

        // Procura se já existe um registro "Pendente" para esta OS no histórico.
        const existingPendingIndex = appData.historicoManutencoes.findIndex(h => h.os === osNumero && h.status === 'Pendente');

        if (existingPendingIndex > -1) {
            // Se encontrou (o serviço estava pendente), ATUALIZA o registro existente.
            const historyEntry = appData.historicoManutencoes[existingPendingIndex];
            historyEntry.status = 'Concluído';
            historyEntry.data = completionDate;
            historyEntry.obs = completionObs || 'Serviço concluído.';
            // As informações de motivo da pendência são mantidas para histórico.
        } else {
            // Se não encontrou (serviço estava "A vencer" ou "Atrasado"), CRIA um novo registro no histórico.
            const newHistoryId = appData.nextHistoricoId++;
            appData.historicoManutencoes.push({
                id: newHistoryId,
                componenteId: componenteId,
                servicoId: servicoId,
                data: completionDate,
                status: 'Concluído',
                os: osNumero,
                obs: completionObs || 'Serviço concluído.'
            });
        }
        
        saveData();
        closeModal();
        if (renderers[activeScreen]) renderers[activeScreen]();
    }
    // --- MODIFICAÇÃO FINALIZADA: saveCompletion ---

    function savePendingStatus() {
        const { componenteId, servicoId, osNumero } = editingItemId;
        const pendingDate = document.getElementById('pending-date').value;
        const reasonCategory = document.getElementById('pending-reason').value;
        const otherReasonInput = document.getElementById('pending-reason-other').value.trim();
        const detailsText = document.getElementById('pending-details').value.trim();

        if (!pendingDate || !reasonCategory) {
            alert('A data e o motivo da pendência são obrigatórios.');
            return;
        }

        let finalMotivo = reasonCategory;
        if (reasonCategory === 'Outros') {
            if (!otherReasonInput) {
                alert('Por favor, especifique o motivo no campo correspondente.');
                document.getElementById('pending-reason-other').focus();
                return;
            }
            finalMotivo = otherReasonInput;
        }

        const newHistoryId = appData.nextHistoricoId++;
        appData.historicoManutencoes.push({
            id: newHistoryId, componenteId: componenteId, servicoId: servicoId,
            data: pendingDate, status: 'Pendente', os: osNumero, 
            motivo: finalMotivo, motivoDetalhado: detailsText
        });
        
        saveData();
        closeModal();
        if (renderers[activeScreen]) renderers[activeScreen]();
    }

    // --- MODIFICAÇÃO INICIADA: handleRevertService ---
    function handleRevertService(historyId) {
        editingItemId = historyId;
        const historyEntry = appData.historicoManutencoes.find(h => h.id === historyId);
        if (!historyEntry) return;

        const componente = appData.componentes.find(c => c.id === historyEntry.componenteId);
        const serviceInfo = getAllMaintenanceServicesForDisplay().find(s => s.historyId === historyId);
        
        const bodyHtml = `
            <form id="revert-service-form">
                <p>Você está revertendo a conclusão do seguinte serviço:</p>
                <p><strong>Componente:</strong> ${componente.nome}</p>
                <p><strong>Serviço:</strong> ${serviceInfo.servicoDescricao}</p>
                <p><strong>OS:</strong> ${historyEntry.os}</p>
                <div class="info-note">
                    <i class="fas fa-info-circle"></i>
                    <p>O status deste serviço será alterado para <strong>Pendente</strong> e qualquer serviço futuro gerado a partir desta conclusão será removido.</p>
                </div>
                <div class="form-group" style="margin-top: 20px;">
                    <label for="revert-reason">Por favor, informe o motivo da reversão:</label>
                    <textarea id="revert-reason" rows="3" required></textarea>
                </div>
            </form>
        `;
        const footerHtml = `<button class="btn btn-secondary" data-action="cancel-modal">Cancelar</button><button class="btn btn-danger" data-action="confirm-revert-service">Confirmar Reversão</button>`;
        showModal('Reverter Conclusão de Serviço', bodyHtml, footerHtml);
    }
    // --- MODIFICAÇÃO FINALIZADA: handleRevertService ---

    // --- MODIFICAÇÃO INICIADA: confirmRevertService ---
    function confirmRevertService() {
        const historyId = editingItemId;
        const revertReason = document.getElementById('revert-reason').value.trim();

        if (!revertReason) {
            alert('O motivo da reversão é obrigatório.');
            return;
        }

        const revertedServiceIndex = appData.historicoManutencoes.findIndex(h => h.id === historyId);
        if (revertedServiceIndex === -1) {
            alert('Erro: Registro histórico não encontrado.');
            closeModal();
            return;
        }

        const revertedServiceRecord = appData.historicoManutencoes[revertedServiceIndex];

        // A lógica de `generateServiceInstances` já impede a geração de um próximo serviço
        // se o último status for "Pendente". Portanto, não precisamos remover manualmente o
        // serviço futuro. Apenas alterar o status do registro revertido é suficiente para
        // que o sistema se auto-corrija na próxima renderização.

        // Altera o registro original de "Concluído" para "Pendente"
        revertedServiceRecord.status = 'Pendente';
        revertedServiceRecord.data = new Date().toISOString().slice(0, 10); // A data da pendência é agora
        revertedServiceRecord.motivo = "Serviço Revertido";
        revertedServiceRecord.motivoDetalhado = revertReason;
        revertedServiceRecord.obs = `Revertido em ${new Date().toLocaleDateString('pt-BR')}. Observação original: ${revertedServiceRecord.obs || 'N/A'}`;

        saveData();
        closeModal();
        if (renderers[activeScreen]) renderers[activeScreen]();
    }
    // --- MODIFICAÇÃO FINALIZADA: confirmRevertService ---

    function handleViewServiceDetails(componenteId, servicoId, historyId) {
        const allServices = getAllMaintenanceServicesForDisplay();
        let service;
        if (historyId) {
            service = allServices.find(s => s.historyId === parseInt(historyId));
        } else {
            // Ajustado para encontrar o serviço projetado correto
            service = allServices.find(s => 
                s.componenteId === parseInt(componenteId) && 
                s.servicoId === servicoId && 
                s.type === 'upcoming'
            );
        }

        if (!service) {
            alert('Detalhes do serviço não encontrados.'); 
            return;
        }

        const componente = appData.componentes.find(c => c.id === service.componenteId);
        const sistema = appData.sistemas.find(s => s.id === componente.sistemaId);
        const grandeArea = appData.grandesAreas.find(g => g.id === componente.grandeAreaId);
        const location = [componente.edificio, componente.andar, componente.sala, componente.complemento].filter(Boolean).join(', ');

        let assetInfoHtml = `
            <fieldset class="location-fieldset details-section">
                <legend>Informações do Ativo</legend>
                <dl class="details-list">
                    <dt>Componente:</dt><dd>${componente.nome}</dd>
                    <dt>Sistema:</dt><dd>${sistema.nome}</dd>
                    <dt>Grande Área:</dt><dd>${grandeArea.nome}</dd>
                    <dt>Localização:</dt><dd>${location || 'Não informada'}</dd>
                    <dt>Criticidade:</dt><dd>${componente.criticidade}</dd>
                </dl>
            </fieldset>
        `;

        let statusInfoHtml = '<fieldset class="location-fieldset details-section">';
        
        switch(service.status) {
            case 'Concluído':
                statusInfoHtml += `
                    <legend>Registro da Última Execução</legend>
                    <dl class="details-list">
                        <dt>Serviço:</dt><dd>${service.servicoDescricao}</dd>
                        <dt>Status:</dt><dd><span class="status-badge concluido">${service.status}</span></dd>
                        <dt>Data de Realização:</dt><dd>${service.date.toLocaleDateString('pt-BR')}</dd>
                        <dt>Nº da OS:</dt><dd>${service.osNumero || 'Não informado'}</dd>
                        <div class="full-width"><dt>Detalhes da Conclusão:</dt><dd><pre>${service.obs || 'Nenhuma observação.'}</pre></dd></div>
                    </dl>`;
                break;
            
            case 'Pendente':
                statusInfoHtml += `
                    <legend>Registro da Última Execução</legend>
                    <dl class="details-list">
                        <dt>Serviço:</dt><dd>${service.servicoDescricao}</dd>
                        <dt>Status:</dt><dd><span class="status-badge pendente">${service.status}</span></dd>
                        <dt>Data da Pendência:</dt><dd>${service.date.toLocaleDateString('pt-BR')}</dd>
                        <dt>Nº da OS:</dt><dd>${service.osNumero || 'N/A'}</dd>
                        <div class="full-width"><dt>Motivo da Pendência:</dt><dd><pre>${service.motivo}</pre></dd></div>`;
                if (service.motivoDetalhado) {
                    statusInfoHtml += `<div class="full-width"><dt>Detalhes da Pendência:</dt><dd><pre>${service.motivoDetalhado}</pre></dd></div>`;
                }
                statusInfoHtml += `</dl>`;
                break;

            default:
                const statusClass = service.status === 'Atrasada' ? 'atrasada' : 'pendente';
                statusInfoHtml += `
                    <legend>Próximo Agendamento</legend>
                    <dl class="details-list">
                        <dt>Serviço:</dt><dd>${service.servicoDescricao}</dd>
                        <dt>Status:</dt><dd><span class="status-badge ${statusClass}">${service.status}</span></dd>
                        <dt>Data Prevista:</dt><dd>${service.date.toLocaleDateString('pt-BR')}</dd>
                        <dt>Periodicidade:</dt><dd>${service.periodicidade}</dd>
                        <dt>Nº da OS:</dt><dd>${service.osNumero || 'N/A'}</dd>
                    </dl>`;
                break;
        }
        statusInfoHtml += '</fieldset>';

        const detailsHtml = assetInfoHtml + statusInfoHtml;
        const footerHtml = `<button class="btn btn-secondary" data-action="cancel-modal">Fechar</button>`;
        showModal('Detalhes do Serviço de Manutenção', detailsHtml, footerHtml);
    }

    // --- LÓGICA DE EXPORTAÇÃO E IMPORTAÇÃO ---
    function handleShowExportPlanModal() {
        const todayStr = today.toISOString().slice(0, 10);
        const areasCheckboxes = appData.grandesAreas.map(area => `
            <div class="checkbox-group">
                <input type="checkbox" id="area-${area.id}" name="report-area" value="${area.id}" checked>
                <label for="area-${area.id}">${area.nome}</label>
            </div>
        `).join('');
        const bodyHtml = `
            <form id="report-form">
                <p>Selecione o período e as áreas para gerar o Plano de Manutenção.</p>
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
                <div class="report-areas-container">
                    <h4>Filtrar por Grande Área</h4>
                    <div class="checkbox-group select-all">
                        <input type="checkbox" id="report-select-all-areas" checked>
                        <label for="report-select-all-areas">Selecionar Todas</label>
                    </div>
                    <div class="checkbox-grid">
                        ${areasCheckboxes}
                    </div>
                </div>
            </form>
        `;
        const footerHtml = `
            <button class="btn btn-secondary" data-action="cancel-modal">Cancelar</button>
            <button class="btn btn-primary" data-action="confirm-export-plan">Gerar Plano (.xlsx)</button>
        `;
        showModal('Gerar Plano de Manutenção', bodyHtml, footerHtml);
    }

    function confirmAndGeneratePlan() {
        const startDate = document.getElementById('report-start-date').value;
        const endDate = document.getElementById('report-end-date').value;
        const selectedAreaIds = Array.from(document.querySelectorAll('input[name="report-area"]:checked'))
                                     .map(checkbox => parseInt(checkbox.value));
    
        if (!startDate || !endDate) {
            alert('Por favor, selecione a data inicial e a data final.');
            return;
        }
        if (new Date(startDate) > new Date(endDate)) {
            alert('A data inicial não pode ser posterior à data final.');
            return;
        }
        if (selectedAreaIds.length === 0) {
            alert('Por favor, selecione pelo menos uma Grande Área para gerar o plano.');
            return;
        }
    
        const allServices = getAllMaintenanceServicesForDisplay();
        const servicesToReport = allServices.filter(s => s.status === 'A vencer' || s.status === 'Atrasada' || s.status === 'Pendente');

        const filteredServices = servicesToReport.filter(service => {
            const serviceDateOnly = new Date(service.date.toISOString().slice(0, 10) + 'T12:00:00');
            const start = new Date(startDate + 'T12:00:00');
            const end = new Date(endDate + 'T12:00:00');
            const isInDateRange = serviceDateOnly >= start && serviceDateOnly <= end;
            const isInSelectedArea = selectedAreaIds.includes(service.grandeAreaId);
            return isInDateRange && isInSelectedArea;
        });
    
        if (filteredServices.length === 0) {
            alert('Nenhum serviço encontrado para os filtros selecionados.');
            return;
        }
    
        generatePlanXLSX(filteredServices);
        closeModal();
    }

    async function generatePlanXLSX(services) {
        const dataForSheet = services.map(service => {
            const componente = appData.componentes.find(c => c.id === service.componenteId);
            const grandeArea = appData.grandesAreas.find(g => g.id === service.grandeAreaId);
            const sistema = appData.sistemas.find(s => s.id === service.sistemaId);
            const subSistema = service.subSistemaId ? appData.subSistemas.find(ss => ss.id === service.subSistemaId) : null;
            
            const localizacao = [componente.edificio, componente.andar, componente.sala, componente.complemento].filter(Boolean).join(' - ');

            return {
                os: service.osNumero,
                grandeArea: grandeArea ? grandeArea.nome : 'N/A',
                sistema: sistema ? sistema.nome : 'N/A',
                subsistema: subSistema ? subSistema.nome : '',
                componente: service.componenteName,
                servico: service.servicoDescricao,
                periodicidade: service.periodicidade,
                dataPrevista: service.date.toLocaleDateString('pt-BR'),
                criticidade: service.criticidade,
                localizacao: localizacao,
                dataRealizacao: '',
                conclusao: '', 
                observacoes: '', 
                motivoPendencia: '', 
                detalhesPendencia: '', 
            };
        });

        if (!dataForSheet || dataForSheet.length === 0) {
            alert("Nenhum dado para exportar.");
            return;
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Plano de Manutenção');

        worksheet.columns = [
            { header: 'OS', key: 'os' },
            { header: 'Grande Área', key: 'grandeArea' },
            { header: 'Sistema', key: 'sistema' },
            { header: 'Subsistema', key: 'subsistema' },
            { header: 'Componente', key: 'componente' },
            { header: 'Serviço', key: 'servico' },
            { header: 'Periodicidade', key: 'periodicidade' },
            { header: 'Data Prevista', key: 'dataPrevista' },
            { header: 'Criticidade', key: 'criticidade' },
            { header: 'Localização', key: 'localizacao' },
            { header: 'Data de Realização', key: 'dataRealizacao' },
            { header: 'Conclusão', key: 'conclusao' },
            { header: 'Detalhes da Conclusão (opcional)', key: 'observacoes' },
            { header: 'Motivo da Pendência (se houver)', key: 'motivoPendencia' },
            { header: 'Detalhes da Pendência (se houver)', key: 'detalhesPendencia' },
        ];

        worksheet.addRows(dataForSheet);

        const headerRow = worksheet.getRow(1);
        headerRow.height = 30;
        headerRow.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2c3e50' } };
            cell.font = { color: { argb: 'FFecf0f1' }, bold: true, size: 12 };
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFa0a0a0' } }, left: { style: 'thin', color: { argb: 'FFa0a0a0' } },
                bottom: { style: 'thin', color: { argb: 'FFa0a0a0' } }, right: { style: 'thin', color: { argb: 'FFa0a0a0' } }
            };
        });
        
        worksheet.autoFilter = { from: 'A1', to: { row: 1, column: worksheet.columns.length } };

        const editableColumns = ['dataRealizacao', 'conclusao', 'observacoes', 'motivoPendencia', 'detalhesPendencia'];

        worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
            if (rowNumber === 1) return;
            row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                const columnKey = worksheet.columns[colNumber - 1].key;
                if (!editableColumns.includes(columnKey)) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDEEFF' } };
                }
            });

            const dataRealizacaoCell = row.getCell('K');
            dataRealizacaoCell.numFmt = 'dd/mm/yyyy';
            dataRealizacaoCell.protection = { locked: false };

            const conclusaoCell = row.getCell('L');
            conclusaoCell.dataValidation = { type: 'list', allowBlank: true, formulae: ['"Concluído,Pendente"'] };
            conclusaoCell.protection = { locked: false };
            row.getCell('M').protection = { locked: false };
            const motivoCell = row.getCell('N');
            motivoCell.dataValidation = { type: 'list', allowBlank: true, formulae: ['"Material insuficiente,Clima impróprio,Falta de autorização,Pessoal insuficiente,Outros"'] };
            motivoCell.protection = { locked: false };
            row.getCell('O').protection = { locked: false };
        });

        worksheet.columns.forEach(column => {
            let maxLength = 0;
            const headerLength = column.header ? column.header.length : 0;
            maxLength = headerLength > maxLength ? headerLength : maxLength;
            
            column.eachCell({ includeEmpty: true }, cell => {
                let columnLength = cell.value ? cell.value.toString().length : 0;
                if (columnLength > maxLength) {
                    maxLength = columnLength;
                }
            });
            column.width = maxLength < 15 ? 15 : maxLength + 4;
        });

        worksheet.getColumn('observacoes').width = 60;
        worksheet.getColumn('detalhesPendencia').width = 60;

        await worksheet.protect('', {
            selectLockedCells: true,
            selectUnlockedCells: true,
            formatCells: false,
            autoFilter: true
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        const todayStr = new Date().toISOString().slice(0, 10);
        link.download = `Plano_de_Manutencao_${todayStr}.xlsx`;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    async function generatePmocXLSX() {
        const dataForSheet = [];
        
        appData.componentes.forEach(componente => {
            const grandeArea = appData.grandesAreas.find(g => g.id === componente.grandeAreaId);
            const sistema = appData.sistemas.find(s => s.id === componente.sistemaId);
            const subSistema = componente.subSistemaId ? appData.subSistemas.find(ss => ss.id === componente.subSistemaId) : null;
            
            const localizacao = [componente.edificio, componente.andar, componente.sala, componente.complemento].filter(Boolean).join(', ');

            const inheritedServices = sistema ? sistema.checklist || [] : [];
            const subSystemServices = subSistema ? subSistema.checklist || [] : [];
            const specificServices = componente.servicosEspecificos || [];
            
            const allServices = [...inheritedServices, ...subSystemServices, ...specificServices];

            allServices.forEach(servico => {
                dataForSheet.push({
                    grandeArea: grandeArea ? grandeArea.nome : 'N/A',
                    sistema: sistema ? sistema.nome : 'N/A',
                    subsistema: subSistema ? subSistema.nome : '-',
                    componente: componente.nome,
                    criticidade: componente.criticidade,
                    localizacao: localizacao || '-',
                    areaResponsavel: sistema ? sistema.areaResponsavel : 'N/A',
                    pessoaResponsavel: sistema ? sistema.pessoaResponsavel : 'N/A',
                    servico: servico.servico,
                    periodicidade: servico.periodicidade
                });
            });
        });

        if (dataForSheet.length === 0) {
            alert("Nenhum serviço de manutenção foi encontrado nos componentes cadastrados para gerar o PMOC.");
            return;
        }

        dataForSheet.sort((a, b) => {
            return a.grandeArea.localeCompare(b.grandeArea) ||
                   a.sistema.localeCompare(b.sistema) ||
                   a.subsistema.localeCompare(b.subsistema) ||
                   a.componente.localeCompare(b.componente) ||
                   a.servico.localeCompare(b.servico);
        });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('PMOC');

        worksheet.columns = [
            { header: 'Grande Área', key: 'grandeArea', width: 25 },
            { header: 'Sistema', key: 'sistema', width: 30 },
            { header: 'Subsistema', key: 'subsistema', width: 25 },
            { header: 'Componente', key: 'componente', width: 35 },
            { header: 'Criticidade', key: 'criticidade', width: 15 },
            { header: 'Localização', key: 'localizacao', width: 40 },
            { header: 'Área Responsável', key: 'areaResponsavel', width: 25 },
            { header: 'Pessoa Responsável', key: 'pessoaResponsavel', width: 25 },
            { header: 'Serviço', key: 'servico', width: 50 },
            { header: 'Periodicidade', key: 'periodicidade', width: 20 },
        ];

        worksheet.addRows(dataForSheet);

        const headerRow = worksheet.getRow(1);
        headerRow.height = 30;
        headerRow.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2c3e50' } };
            cell.font = { color: { argb: 'FFecf0f1' }, bold: true, size: 12 };
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });

        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;
            row.eachCell(cell => {
                cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            });
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        const todayStr = new Date().toISOString().slice(0, 10);
        link.download = `PMOC_Servicos_${todayStr}.xlsx`;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    async function generateFullBackupXLSX() {
        const allServices = getAllMaintenanceServicesForDisplay();

        if (allServices.length === 0) {
            alert("Não há nenhum serviço de manutenção (histórico ou futuro) para exportar.");
            return;
        }

        const dataForSheet = allServices.map(service => {
            const componente = appData.componentes.find(c => c.id === service.componenteId);
            const grandeArea = appData.grandesAreas.find(g => g.id === service.grandeAreaId);
            const sistema = appData.sistemas.find(s => s.id === service.sistemaId);
            const subSistema = service.subSistemaId ? appData.subSistemas.find(ss => ss.id === service.subSistemaId) : null;
            
            const localizacao = [componente.edificio, componente.andar, componente.sala, componente.complemento].filter(Boolean).join(', ');

            return {
                os: service.osNumero || 'N/A',
                status: service.status,
                data: service.date.toLocaleDateString('pt-BR'),
                componente: service.componenteName,
                servico: service.servicoDescricao,
                criticidade: service.criticidade,
                periodicidade: service.periodicidade,
                grandeArea: grandeArea ? grandeArea.nome : 'N/A',
                sistema: sistema ? sistema.nome : 'N/A',
                subsistema: subSistema ? subSistema.nome : '-',
                localizacao: localizacao || '-',
                observacoes: service.obs || '-',
                motivoPendencia: service.motivo || '-',
                detalhesPendencia: service.motivoDetalhado || '-'
            };
        });
        
        dataForSheet.sort((a, b) => new Date(a.data.split('/').reverse().join('-')) - new Date(b.data.split('/').reverse().join('-')));

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Backup Completo Manutencoes');

        worksheet.columns = [
            { header: 'Nº da OS', key: 'os', width: 20 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Data (Prevista/Realizada)', key: 'data', width: 20 },
            { header: 'Componente', key: 'componente', width: 35 },
            { header: 'Serviço', key: 'servico', width: 50 },
            { header: 'Criticidade', key: 'criticidade', width: 15 },
            { header: 'Periodicidade', key: 'periodicidade', width: 18 },
            { header: 'Grande Área', key: 'grandeArea', width: 25 },
            { header: 'Sistema', key: 'sistema', width: 30 },
            { header: 'Subsistema', key: 'subsistema', width: 25 },
            { header: 'Localização', key: 'localizacao', width: 40 },
            { header: 'Observações (Conclusão)', key: 'observacoes', width: 50 },
            { header: 'Motivo da Pendência', key: 'motivoPendencia', width: 40 },
            { header: 'Detalhes da Pendência', key: 'detalhesPendencia', width: 50 },
        ];

        worksheet.addRows(dataForSheet);

        const headerRow = worksheet.getRow(1);
        headerRow.height = 30;
        headerRow.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2c3e50' } };
            cell.font = { color: { argb: 'FFecf0f1' }, bold: true, size: 12 };
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });
        
        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;
            row.eachCell(cell => {
                cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            });
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        const todayStr = new Date().toISOString().slice(0, 10);
        link.download = `Backup_Completo_Manutencoes_${todayStr}.xlsx`;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function handleImportReport() {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.xlsx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        fileInput.addEventListener('change', processImportedFile);
        fileInput.click();
    }

    async function processImportedFile(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const buffer = e.target.result;
                const workbook = new ExcelJS.Workbook();
                await workbook.xlsx.load(buffer);

                const worksheet = workbook.worksheets[0];
                if (!worksheet) {
                    alert('Erro: A planilha está vazia ou não foi encontrada.');
                    return;
                }

                const parsedServices = [];
                worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
                    if (rowNumber === 1) return;

                    const serviceData = {
                        os: row.getCell('A').value,
                        componente: row.getCell('E').value,
                        servico: row.getCell('F').value,
                        dataPrevista: row.getCell('H').value,
                        dataRealizacao: row.getCell('K').value,
                        conclusao: row.getCell('L').value,
                        observacoes: row.getCell('M').value,
                        motivoPendencia: row.getCell('N').value,
                        detalhesPendencia: row.getCell('O').value,
                    };

                    if (serviceData.conclusao) {
                        parsedServices.push(serviceData);
                    }
                });

                if (parsedServices.length === 0) {
                    alert('Nenhum serviço com status preenchido foi encontrado na planilha.');
                    return;
                }

                showValidationModal(parsedServices);

            } catch (error) {
                console.error("Erro ao processar o arquivo XLSX:", error);
                alert('Ocorreu um erro ao ler o arquivo. Verifique se o formato está correto.');
            }
        };
        reader.readAsArrayBuffer(file);
    }

    function showValidationModal(services) {
        const itemsHtml = services.map((service, index) => {
            const status = normalizeStatus(service.conclusao);
            const statusClass = status === 'Concluído' ? 'status-concluida' : 'status-atrasada';
            const details = status === 'Concluído' 
                ? `Realizado em: ${service.dataRealizacao ? new Date(service.dataRealizacao).toLocaleDateString('pt-BR') : 'N/A'}`
                : `Motivo: ${service.motivoPendencia || 'Não especificado'}`;

            return `
                <div class="checkbox-group validation-item" data-index="${index}">
                    <input type="checkbox" id="val-item-${index}" name="validation-item" checked>
                    <label for="val-item-${index}">
                        <strong>${service.componente}</strong> - ${service.servico}
                        <small><span class="status-badge ${statusClass}">${status}</span> ${details}</small>
                    </label>
                </div>
            `;
        }).join('');

        const bodyHtml = `
            <p>Revise os serviços importados. Desmarque qualquer item que você <strong>não</strong> queira aprovar. Os itens não aprovados serão marcados como pendentes.</p>
            <div class="checkbox-group select-all">
                <input type="checkbox" id="validation-select-all" checked>
                <label for="validation-select-all">Selecionar/Desmarcar Todos</label>
            </div>
            <div class="validation-list-container">${itemsHtml}</div>
        `;

        const footerHtml = `
            <button class="btn btn-secondary" data-action="cancel-modal">Cancelar</button>
            <button class="btn btn-primary" data-action="confirm-import">Confirmar e Atualizar Sistema</button>
        `;

        modalContainer.dataset.importedServices = JSON.stringify(services);

        showModal('Validar Relatório de Manutenção', bodyHtml, footerHtml);
    }

    function normalizeStatus(text) {
        if (typeof text !== 'string') return '';
        const cleanText = text.trim().toLowerCase();
        if (cleanText.includes('concluido') || cleanText.includes('concluído')) {
            return 'Concluído';
        }
        if (cleanText.includes('pendente')) {
            return 'Pendente';
        }
        return '';
    }

    function confirmImport() {
        const importedServices = JSON.parse(modalContainer.dataset.importedServices || '[]');
        const validationItems = document.querySelectorAll('.validation-item');
        
        let updatedCount = 0;
        let unvalidatedCount = 0;
        let skippedCount = 0;

        const allCurrentServices = getAllMaintenanceServicesForDisplay();

        validationItems.forEach(item => {
            const index = parseInt(item.dataset.index);
            const serviceData = importedServices[index];
            const checkbox = item.querySelector('input[type="checkbox"]');

            const correspondingService = allCurrentServices.find(s => s.osNumero === serviceData.os);
            if (!correspondingService) {
                skippedCount++;
                return;
            }

            const newHistoryId = appData.nextHistoricoId++;
            
            if (checkbox.checked) {
                let status = normalizeStatus(serviceData.conclusao);
                if (serviceData.motivoPendencia || serviceData.detalhesPendencia) {
                    status = 'Pendente';
                }

                if (status === 'Concluído') {
                    let completionDate = serviceData.dataRealizacao;
                    if (!completionDate) {
                        const parts = serviceData.dataPrevista.split('/');
                        completionDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
                    } else {
                        completionDate = new Date(completionDate).toISOString().slice(0, 10);
                    }
                    
                    appData.historicoManutencoes.push({
                        id: newHistoryId,
                        componenteId: correspondingService.componenteId,
                        servicoId: correspondingService.servicoId,
                        data: completionDate,
                        status: 'Concluído',
                        os: serviceData.os,
                        obs: serviceData.observacoes || 'Serviço concluído via importação.'
                    });
                    updatedCount++;
                } else if (status === 'Pendente') {
                    appData.historicoManutencoes.push({
                        id: newHistoryId,
                        componenteId: correspondingService.componenteId,
                        servicoId: correspondingService.servicoId,
                        data: new Date().toISOString().slice(0, 10),
                        status: 'Pendente',
                        os: serviceData.os,
                        motivo: serviceData.motivoPendencia || 'Pendente via importação',
                        motivoDetalhado: serviceData.detalhesPendencia || ''
                    });
                    updatedCount++;
                } else {
                    skippedCount++;
                }
            } else {
                appData.historicoManutencoes.push({
                    id: newHistoryId,
                    componenteId: correspondingService.componenteId,
                    servicoId: correspondingService.servicoId,
                    data: new Date().toISOString().slice(0, 10),
                    status: 'Pendente',
                    os: serviceData.os,
                    motivo: 'Não validado pelo fiscal',
                    motivoDetalhado: 'A execução reportada pela equipe não foi aprovada na validação.'
                });
                unvalidatedCount++;
            }
        });

        saveData();
        closeModal();
        
        let summary = `Importação concluída!\n\n- ${updatedCount} serviços foram atualizados.\n- ${unvalidatedCount} serviços foram marcados como pendentes por não serem validados.\n- ${skippedCount} serviços não puderam ser processados (OS não encontrada).`;
        alert(summary);

        location.reload();
    }

    function handleSaveAsJson() {
        try {
            const dataStr = JSON.stringify(appData, null, 2); 
            const blob = new Blob([dataStr], { type: "application/json" });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            const todayStr = new Date().toISOString().slice(0, 10);
            link.download = `gestor_manutencao_backup_${todayStr}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error("Erro ao gerar o arquivo JSON:", error);
            alert("Ocorreu um erro ao tentar salvar o arquivo. Verifique o console para mais detalhes.");
        }
    }

    function handleFileNew() {
        const bodyHtml = `<p>Você tem certeza que deseja criar um novo arquivo? Todo o progresso não salvo será perdido.</p>`;
        const footerHtml = `<button class="btn btn-secondary" data-action="cancel-modal">Cancelar</button><button class="btn btn-danger" data-action="confirm-file-new">Criar Novo</button>`;
        showModal('Criar Novo Arquivo', bodyHtml, footerHtml);
    }

    function confirmFileNew() {
        appData = getInitialEmptyData();
        saveData();
        closeModal();
        location.reload();
    }

    function handleFileOpen() {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json,application/json';
        fileInput.addEventListener('change', processLoadedFile);
        fileInput.click();
    }

    function processLoadedFile(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const loadedData = JSON.parse(e.target.result);
                if (loadedData && loadedData.grandesAreas && loadedData.sistemas && loadedData.componentes) {
                    pendingLoadedData = loadedData;
                    const bodyHtml = `<p>Você tem certeza que deseja abrir este arquivo? Todo o progresso não salvo será substituído.</p>`;
                    const footerHtml = `<button class="btn btn-secondary" data-action="cancel-modal">Cancelar</button><button class="btn btn-primary" data-action="confirm-file-open">Abrir Arquivo</button>`;
                    showModal('Confirmar Abertura', bodyHtml, footerHtml);
                } else {
                    alert('Erro: O arquivo selecionado não parece ser um backup válido do Gestor de Manutenção.');
                }
            } catch (error) {
                console.error("Erro ao processar o arquivo JSON:", error);
                alert('Erro: Ocorreu um problema ao ler o arquivo. Ele pode não ser um JSON válido.');
            }
        };
        reader.readAsText(file);
    }

    function confirmFileOpen() {
        if (!pendingLoadedData) {
            alert('Erro: Nenhum dado de arquivo para carregar.');
            return;
        }
        appData = pendingLoadedData;
        pendingLoadedData = null;
        saveData();
        closeModal();
        location.reload();
    }

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
        const calendarDay = target.closest('.calendar-day.has-services');
        const actionButton = target.closest('[data-action]');
        if (navLink) { e.preventDefault(); navigateTo(navLink.dataset.target); return; }
        if (dropdownLink) { e.preventDefault(); dropdownLink.parentElement.classList.toggle('open'); }
        if (calendarDay) { activeDateFilter = calendarDay.dataset.date; renderPainelManutencao(); }
        if (actionButton) {
            e.preventDefault();
            const action = actionButton.dataset.action;
            const id = parseInt(actionButton.dataset.id);
            const historyId = parseInt(actionButton.dataset.historyId);
            const componenteId = actionButton.dataset.componenteId;
            const servicoId = actionButton.dataset.servicoId;
            const osNumero = actionButton.dataset.osNumero; // Adicionado para capturar OS
            const startDateInput = document.getElementById('filter-data-inicio');
            const endDateInput = document.getElementById('filter-data-fim');
            const todayForFilters = new Date(today);
            switch(action) {
                case 'go-to-grandes-areas': navigateTo('screen-lista-grandes-areas'); break;
                case 'go-to-sistemas': navigateTo('screen-lista-sistemas'); break;
                case 'voltar': navigateTo('screen-painel'); break;
                case 'clear-filter': activeDateFilter = null; calendarDate = new Date(today); renderPainelManutencao(); break;
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
                case 'novo-subsistema': handleAddSubSistema(); break;
                case 'edit-subsistema': handleEditSubSistema(id); break;
                case 'delete-subsistema': handleDeleteSubSistema(id); break;
                case 'save-subsistema': saveSubSistema(); break;
                case 'confirm-delete-subsistema': confirmDeleteSubSistema(); break;
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
                case 'complete-service': handleCompleteService(componenteId, servicoId, osNumero); break;
                case 'choose-completed': showCompletionForm(); break;
                case 'choose-pending': showPendingForm(); break;
                case 'save-completion': saveCompletion(); break;
                case 'save-pending-status': savePendingStatus(); break;
                case 'revert-service': handleRevertService(historyId); break;
                case 'confirm-revert-service': confirmRevertService(); break;
                case 'toggle-service-group':
                    const groupHeader = actionButton.closest('.service-group-header');
                    if (groupHeader) groupHeader.parentElement.classList.toggle('open');
                    break;
                case 'toggle-alert-box':
                    actionButton.closest('.alerta-box').classList.toggle('open');
                    break;
                case 'view-service-details':
                    const row = actionButton.closest('tr');
                    if (row) handleViewServiceDetails(row.dataset.componenteId, row.dataset.servicoId, row.dataset.historyId);
                    break;
                case 'view-all-services':
                    const filterType = actionButton.dataset.filter;
                    navigateTo('screen-manutencoes');
                    document.getElementById('maintenance-filters').querySelectorAll('select, input').forEach(el => el.value = '');
                    if (filterType === 'vencidos') {
                        document.getElementById('filter-status').value = 'Atrasada';
                    } else if (filterType === 'pendentes') {
                        document.getElementById('filter-status').value = 'Pendente';
                    } else if (filterType === 'este-mes') {
                        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
                        const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                        document.getElementById('filter-data-inicio').value = firstDayOfMonth.toISOString().slice(0, 10);
                        document.getElementById('filter-data-fim').value = lastDayOfMonth.toISOString().slice(0, 10);
                    } else if (filterType === 'proximo-mes') {
                        const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);
                        const nextMonthEnd = new Date(today.getFullYear(), today.getMonth() + 2, 0);
                        document.getElementById('filter-data-inicio').value = nextMonthStart.toISOString().slice(0, 10);
                        document.getElementById('filter-data-fim').value = nextMonthEnd.toISOString().slice(0, 10);
                    }
                    applyFiltersAndRenderTable();
                    break;
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
                case 'go-to-page':
                    const page = parseInt(actionButton.dataset.page);
                    if (page) {
                        maintenanceCurrentPage = page;
                        applyFiltersAndRenderTable();
                    }
                    break;
                case 'file-new': handleFileNew(); break;
                case 'confirm-file-new': confirmFileNew(); break;
                case 'file-open': handleFileOpen(); break;
                case 'confirm-file-open': confirmFileOpen(); break;
                case 'file-save': handleSaveAsJson(); break;
                case 'export-plan': handleShowExportPlanModal(); break;
                case 'confirm-export-plan': confirmAndGeneratePlan(); break;
                case 'import-report': handleImportReport(); break;
                case 'confirm-import': confirmImport(); break;
                case 'export-pmoc': generatePmocXLSX(); break;
                case 'export-backup': generateFullBackupXLSX(); break;
                case 'apply-indicadores-filters': updateIndicadores(); break;
                case 'clear-indicadores-filters':
                    document.getElementById('indicadores-filters').querySelectorAll('select, input').forEach(el => el.value = '');
                    renderIndicadoresScreen();
                    break;
                case 'filter-indicadores-month':
                    document.getElementById('filter-indicadores-inicio').value = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
                    document.getElementById('filter-indicadores-fim').value = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
                    updateIndicadores();
                    break;
                case 'filter-indicadores-90-days':
                    const ninetyDaysAgo = new Date(today);
                    ninetyDaysAgo.setDate(today.getDate() - 90);
                    document.getElementById('filter-indicadores-inicio').value = ninetyDaysAgo.toISOString().slice(0, 10);
                    document.getElementById('filter-indicadores-fim').value = today.toISOString().slice(0, 10);
                    updateIndicadores();
                    break;
                case 'filter-indicadores-year':
                    document.getElementById('filter-indicadores-inicio').value = new Date(today.getFullYear(), 0, 1).toISOString().slice(0, 10);
                    document.getElementById('filter-indicadores-fim').value = new Date(today.getFullYear(), 11, 31).toISOString().slice(0, 10);
                    updateIndicadores();
                    break;
            }
        }
    });
    
    modalBody.addEventListener('change', (e) => {
        const target = e.target;
        if (target.id === 'componente-grande-area') {
            const grandeAreaId = parseInt(target.value);
            updateSistemaOptions(grandeAreaId);
            updateInheritedInfo(null, null);
        }
        if (target.id === 'componente-sistema') {
            const sistemaId = parseInt(target.value);
            updateSubSistemaOptions(sistemaId);
            updateInheritedInfo(sistemaId, null);
        }
        if (target.id === 'componente-subsistema') {
            const sistemaId = parseInt(document.getElementById('componente-sistema').value);
            const subSistemaId = parseInt(target.value);
            updateInheritedInfo(sistemaId, subSistemaId);
        }
        if (target.id === 'subsistema-grande-area') {
            const grandeAreaId = parseInt(target.value);
            updateSistemaOptionsForSubSistema(grandeAreaId);
        }
        if (target.id === 'report-select-all-areas') {
            const isChecked = target.checked;
            document.querySelectorAll('input[name="report-area"]').forEach(checkbox => {
                checkbox.checked = isChecked;
            });
        } else if (target.name === 'report-area') {
            const allAreasCheckboxes = document.querySelectorAll('input[name="report-area"]');
            const allChecked = Array.from(allAreasCheckboxes).every(checkbox => checkbox.checked);
            document.getElementById('report-select-all-areas').checked = allChecked;
        }
        if (target.id === 'pending-reason') {
            const otherReasonGroup = document.getElementById('other-reason-group');
            if (target.value === 'Outros') {
                otherReasonGroup.classList.remove('hidden');
                document.getElementById('pending-reason-other').focus();
            } else {
                otherReasonGroup.classList.add('hidden');
            }
        }
        if (target.id === 'validation-select-all') {
            const isChecked = target.checked;
            document.querySelectorAll('input[name="validation-item"]').forEach(checkbox => {
                checkbox.checked = isChecked;
            });
        }
    });

    document.getElementById('maintenance-filters').addEventListener('change', (e) => {
        const grandeAreaSelect = document.getElementById('filter-grande-area');
        const sistemaSelect = document.getElementById('filter-sistema');
        const subSistemaSelect = document.getElementById('filter-subsistema');
        const componenteSelect = document.getElementById('filter-componente');
    
        const grandeAreaId = parseInt(grandeAreaSelect.value);
        const sistemaId = parseInt(sistemaSelect.value);
        const subSistemaId = parseInt(subSistemaSelect.value);
    
        if (e.target === grandeAreaSelect) {
            sistemaSelect.innerHTML = '<option value="">Todos</option>';
            subSistemaSelect.innerHTML = '<option value="">Todos</option>';
            componenteSelect.innerHTML = '<option value="">Todos</option>';
            sistemaSelect.disabled = true;
            subSistemaSelect.disabled = true;
            componenteSelect.disabled = true;
    
            if (grandeAreaId) {
                const sistemasNaArea = appData.sistemas.filter(s => s.grandeAreaId === grandeAreaId);
                sistemaSelect.innerHTML += sistemasNaArea.map(s => `<option value="${s.id}">${s.nome}</option>`).join('');
                sistemaSelect.disabled = false;
            }
        } else if (e.target === sistemaSelect) {
            subSistemaSelect.innerHTML = '<option value="">Todos</option>';
            componenteSelect.innerHTML = '<option value="">Todos</option>';
            subSistemaSelect.disabled = true;
            componenteSelect.disabled = true;
    
            if (sistemaId) {
                const subSistemasNoSistema = appData.subSistemas.filter(ss => ss.sistemaId === sistemaId);
                if (subSistemasNoSistema.length > 0) {
                    subSistemaSelect.innerHTML += subSistemasNoSistema.map(ss => `<option value="${ss.id}">${ss.nome}</option>`).join('');
                    subSistemaSelect.disabled = false;
                }
                const componentesNoSistema = appData.componentes.filter(c => c.sistemaId === sistemaId);
                componenteSelect.innerHTML += componentesNoSistema.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
                componenteSelect.disabled = false;
            }
        } else if (e.target === subSistemaSelect) {
            componenteSelect.innerHTML = '<option value="">Todos</option>';
            componenteSelect.disabled = true;
    
            if (sistemaId) {
                let componentesFiltrados = appData.componentes.filter(c => c.sistemaId === sistemaId);
                if (subSistemaId) {
                    componentesFiltrados = componentesFiltrados.filter(c => c.subSistemaId === subSistemaId);
                }
                componenteSelect.innerHTML += componentesFiltrados.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
                componenteSelect.disabled = false;
            }
        }
    
        maintenanceCurrentPage = 1;
        applyFiltersAndRenderTable();
    });

    document.getElementById('component-filters').addEventListener('change', () => {
        let componentesFiltrados = appData.componentes;
        const grandeAreaId = parseInt(document.getElementById('filter-comp-grande-area').value);
        const sistemaId = parseInt(document.getElementById('filter-comp-sistema').value);
        const subSistemaId = parseInt(document.getElementById('filter-comp-subsistema').value);

        if (grandeAreaId) {
            componentesFiltrados = componentesFiltrados.filter(c => c.grandeAreaId === grandeAreaId);
            const sistemaSelect = document.getElementById('filter-comp-sistema');
            const subSistemaSelect = document.getElementById('filter-comp-subsistema');
            
            const sistemasNaArea = appData.sistemas.filter(s => s.grandeAreaId === grandeAreaId);
            sistemaSelect.innerHTML = '<option value="">Todos</option>' + sistemasNaArea.map(s => `<option value="${s.id}">${s.nome}</option>`).join('');
            sistemaSelect.disabled = false;
            
            if (sistemaId) {
                componentesFiltrados = componentesFiltrados.filter(c => c.sistemaId === sistemaId);
                const subSistemasNoSistema = appData.subSistemas.filter(ss => ss.sistemaId === sistemaId);
                if (subSistemasNoSistema.length > 0) {
                    subSistemaSelect.innerHTML = '<option value="">Todos</option>' + subSistemasNoSistema.map(ss => `<option value="${ss.id}">${ss.nome}</option>`).join('');
                    subSistemaSelect.disabled = false;
                    if (subSistemaId) {
                        componentesFiltrados = componentesFiltrados.filter(c => c.subSistemaId === subSistemaId);
                    }
                } else {
                    subSistemaSelect.innerHTML = '<option value="">Nenhum</option>';
                    subSistemaSelect.disabled = true;
                }
            } else {
                subSistemaSelect.innerHTML = '<option value="">Todos</option>';
                subSistemaSelect.disabled = true;
                subSistemaSelect.value = '';
            }
        } else {
            document.getElementById('filter-comp-sistema').disabled = true;
            document.getElementById('filter-comp-sistema').value = '';
            document.getElementById('filter-comp-subsistema').disabled = true;
            document.getElementById('filter-comp-subsistema').value = '';
        }
        
        renderListaComponentes(componentesFiltrados);
    });

    document.getElementById('sistemas-filters').addEventListener('change', () => {
        const grandeAreaId = parseInt(document.getElementById('filter-sis-grande-area').value);
        let sistemasFiltrados = appData.sistemas;

        if (grandeAreaId) {
            sistemasFiltrados = appData.sistemas.filter(s => s.grandeAreaId === grandeAreaId);
        }

        renderListaSistemas(sistemasFiltrados);
    });

    document.getElementById('subsistemas-filters').addEventListener('change', () => {
        const grandeAreaId = parseInt(document.getElementById('filter-subsis-grande-area').value);
        const sistemaId = parseInt(document.getElementById('filter-subsis-sistema').value);
        const sistemaSelect = document.getElementById('filter-subsis-sistema');

        let subSistemasFiltrados = appData.subSistemas;

        if (grandeAreaId) {
            const sistemasNaArea = appData.sistemas.filter(s => s.grandeAreaId === grandeAreaId);
            sistemaSelect.innerHTML = '<option value="">Todos</option>' + sistemasNaArea.map(s => `<option value="${s.id}">${s.nome}</option>`).join('');
            sistemaSelect.disabled = false;
        } else {
            sistemaSelect.innerHTML = '<option value="">Todos</option>';
            sistemaSelect.disabled = true;
        }

        if (sistemaId) {
            subSistemasFiltrados = subSistemasFiltrados.filter(ss => ss.sistemaId === sistemaId);
        } else if (grandeAreaId) {
            const sistemasDaAreaIds = appData.sistemas
                .filter(s => s.grandeAreaId === grandeAreaId)
                .map(s => s.id);
            subSistemasFiltrados = subSistemasFiltrados.filter(ss => sistemasDaAreaIds.includes(ss.sistemaId));
        }

        renderListaSubSistemas(subSistemasFiltrados);
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

    document.getElementById('indicadores-filters').addEventListener('change', (e) => {
        if (e.target.id === 'filter-indicadores-grande-area') {
            const sistemaSelect = document.getElementById('filter-indicadores-sistema');
            const grandeAreaId = parseInt(e.target.value);
            
            sistemaSelect.innerHTML = '<option value="">Todos</option>';
            sistemaSelect.disabled = true;

            if (grandeAreaId) {
                const sistemasNaArea = appData.sistemas.filter(s => s.grandeAreaId === grandeAreaId);
                sistemaSelect.innerHTML += sistemasNaArea.map(s => `<option value="${s.id}">${s.nome}</option>`).join('');
                sistemaSelect.disabled = false;
            }
        }

        updateIndicadores();
    });

    // --- LÓGICA DA TELA DE INDICADORES ---

    function renderIndicadoresScreen() {
        const gaSelect = document.getElementById('filter-indicadores-grande-area');
        gaSelect.innerHTML = '<option value="">Todas</option>' + appData.grandesAreas.map(g => `<option value="${g.id}">${g.nome}</option>`).join('');
        
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
        const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
        document.getElementById('filter-indicadores-inicio').value = firstDayOfMonth;
        document.getElementById('filter-indicadores-fim').value = lastDayOfMonth;

        updateIndicadores();
    }

    function updateIndicadores() {
        Object.values(chartInstances).forEach(chart => chart.destroy());
        chartInstances = {};

        const startDate = document.getElementById('filter-indicadores-inicio').value;
        const endDate = document.getElementById('filter-indicadores-fim').value;
        const grandeAreaId = parseInt(document.getElementById('filter-indicadores-grande-area').value) || null;
        const sistemaId = parseInt(document.getElementById('filter-indicadores-sistema').value) || null;
        const criticidade = document.getElementById('filter-indicadores-criticidade').value || null;

        let allServices = getAllMaintenanceServicesForDisplay();
        
        let filteredServices = allServices.filter(s => {
            const serviceDate = new Date(s.date.toISOString().slice(0, 10));
            const start = startDate ? new Date(startDate) : null;
            const end = endDate ? new Date(endDate) : null;

            if (start && serviceDate < start) return false;
            if (end && serviceDate > end) return false;
            if (grandeAreaId && s.grandeAreaId !== grandeAreaId) return false;
            if (sistemaId && s.sistemaId !== sistemaId) return false;
            if (criticidade && s.criticidade !== criticidade) return false;
            
            return true;
        });

        const kpiConformidade = calculateConformidade(allServices, startDate, endDate, grandeAreaId, sistemaId, criticidade);
        document.getElementById('kpi-conformidade').textContent = `${kpiConformidade.toFixed(1)}%`;

        const backlog = filteredServices.filter(s => s.status === 'Atrasada').length;
        const kpiBacklogEl = document.getElementById('kpi-backlog');
        kpiBacklogEl.textContent = backlog;
        kpiBacklogEl.classList.toggle('has-backlog', backlog > 0);

        const concluidas = filteredServices.filter(s => s.status === 'Concluído').length;
        document.getElementById('kpi-concluidas').textContent = concluidas;

        renderStatusGeralChart(filteredServices);
        renderPlanejadoRealizadoChart(allServices);
        renderServicosPorAreaChart(filteredServices);
        renderServicosPorCriticidadeChart(filteredServices);
        renderTopComponentesChart(allServices, grandeAreaId, sistemaId, criticidade);
    }

    function calculateConformidade(allServices, startDate, endDate, grandeAreaId, sistemaId, criticidade) {
        const start = new Date(startDate);
        const end = new Date(endDate);

        // Passo 1: Definir o universo de TUDO que foi planejado para o período.
        // Isso inclui serviços que agora podem estar Atrasados, Pendentes ou Concluídos.
        let universoPlanejado = allServices.filter(s => {
            const serviceDate = new Date(s.date.toISOString().slice(0, 10));
            
            // A data original do serviço (seja ele projetado ou histórico) deve estar no período.
            if (serviceDate < start || serviceDate > end) return false;

            // Aplica os filtros adicionais
            if (grandeAreaId && s.grandeAreaId !== grandeAreaId) return false;
            if (sistemaId && s.sistemaId !== sistemaId) return false;
            if (criticidade && s.criticidade !== criticidade) return false;
            
            return true;
        });

        // Se nada foi planejado, a conformidade é 100% (não houve falhas).
        if (universoPlanejado.length === 0) return 100.0;

        // Passo 2: DENTRO desse universo planejado, contar quantos foram concluídos.
        const concluidosDoUniverso = universoPlanejado.filter(s => s.status === 'Concluído').length;

        // Passo 3: Calcular a taxa. Este valor nunca será > 100.
        return (concluidosDoUniverso / universoPlanejado.length) * 100;
    }

    function renderStatusGeralChart(services) {
        const ctx = document.getElementById('status-geral-chart').getContext('2d');

        // 1. Mapeamento explícito de status para cores
        const colorMap = {
            'Atrasada': 'var(--status-atrasada)',       // Vermelho
            'A Vencer': 'var(--primary-color-button)', // Azul
            'Pendente': 'var(--status-hoje)',          // Amarelo
            'Concluído': 'var(--status-concluida)'      // Verde
        };
        // Cores "fallback" caso a variável CSS não seja encontrada
        const fallbackColorMap = {
            'Atrasada': '#e74c3c',
            'A Vencer': '#3581d1',
            'Pendente': '#f1c40f',
            'Concluído': '#2ecc71'
        };


        // 2. Agrega os dados, normalizando o nome "A vencer" para consistência
        const statusCounts = services.reduce((acc, s) => {
            let status = s.status;
            if (status === 'A vencer') status = 'A Vencer';
            acc[status] = (acc[status] || 0) + 1;
            return acc;
        }, {});

        // 3. Prepara os dados para o gráfico
        const labels = Object.keys(statusCounts);
        const data = Object.values(statusCounts);

        // 4. Cria o array de cores dinamicamente, na ordem correta dos labels
        // Isso garante que "Atrasada" será sempre vermelho, "Concluído" sempre verde, etc.
        const backgroundColors = labels.map(label => {
            const colorVar = colorMap[label] || '#cccccc'; // Pega a variável CSS ou um cinza padrão
            // Tenta resolver a variável CSS, se falhar, usa o fallback
            try {
                // Cria um elemento temporário para resolver a variável CSS
                const tempEl = document.createElement('div');
                tempEl.style.color = colorVar;
                document.body.appendChild(tempEl);
                const resolvedColor = window.getComputedStyle(tempEl).color;
                document.body.removeChild(tempEl);
                return resolvedColor;
            } catch (e) {
                return fallbackColorMap[label] || '#cccccc'; // Usa o fallback em caso de erro
            }
        });


        // 5. Destrói a instância anterior do gráfico, se existir
        if (chartInstances.statusGeral) {
            chartInstances.statusGeral.destroy();
        }

        // 6. Cria o novo gráfico com as cores corretas e ordenadas
        chartInstances.statusGeral = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: backgroundColors,
                }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                }
            }
        });
    }

    function renderPlanejadoRealizadoChart(allServices) {
        const ctx = document.getElementById('planejado-realizado-chart').getContext('2d');
        const labels = [];
        const dataPlanejado = [];
        const dataRealizado = [];

        for (let i = 5; i >= 0; i--) {
            const date = new Date(today);
            date.setMonth(today.getMonth() - i);
            const month = date.toLocaleString('pt-BR', { month: 'short' });
            const year = date.getFullYear();
            labels.push(`${month}/${year}`);

            const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
            const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);

            // Filtra todos os serviços (históricos ou projetados) cuja data cai dentro do mês.
            const servicosDoMes = allServices.filter(s => {
                const serviceDate = new Date(s.date);
                return serviceDate >= firstDay && serviceDate <= lastDay;
            });
            
            // Conta as OS únicas planejadas para aquele mês.
            const totalPlanejado = new Set(servicosDoMes.map(s => s.osNumero)).size;
            
            // Conta os serviços concluídos dentro daquele mês.
            const realizadosMes = servicosDoMes.filter(s => s.status === 'Concluído').length;
            
            dataPlanejado.push(totalPlanejado);
            dataRealizado.push(realizadosMes);
        }

        chartInstances.planejadoRealizado = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    { label: 'Planejado', data: dataPlanejado, backgroundColor: '#7f8c98' },
                    { label: 'Realizado', data: dataRealizado, backgroundColor: '#3581d1' }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
        });
    }

    function renderServicosPorAreaChart(services) {
        const ctx = document.getElementById('servicos-area-chart').getContext('2d');
        const areaCounts = services.reduce((acc, s) => {
            const area = appData.grandesAreas.find(ga => ga.id === s.grandeAreaId);
            if (area) {
                acc[area.nome] = (acc[area.nome] || 0) + 1;
            }
            return acc;
        }, {});

        chartInstances.servicosArea = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Object.keys(areaCounts),
                datasets: [{
                    label: 'Nº de Serviços',
                    data: Object.values(areaCounts),
                    backgroundColor: ['#3581d1', '#2ecc71', '#e74c3c', '#f39c12', '#9b59b6'],
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } }
            }
        });
    }

    function renderServicosPorCriticidadeChart(services) {
        const ctx = document.getElementById('servicos-criticidade-chart').getContext('2d');
        const criticidadeCounts = services.reduce((acc, s) => {
            acc[s.criticidade] = (acc[s.criticidade] || 0) + 1;
            return acc;
        }, {});

        chartInstances.servicosCriticidade = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: Object.keys(criticidadeCounts),
                datasets: [{
                    data: Object.values(criticidadeCounts),
                    backgroundColor: ['#e74c3c', '#f39c12', '#3498db'],
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    function renderTopComponentesChart(allServices, grandeAreaId, sistemaId, criticidade) {
        const ctx = document.getElementById('top-componentes-chart').getContext('2d');
        
        let servicesToAnalyze = allServices.filter(s => s.status === 'Atrasada');

        if (grandeAreaId) servicesToAnalyze = servicesToAnalyze.filter(s => s.grandeAreaId === grandeAreaId);
        if (sistemaId) servicesToAnalyze = servicesToAnalyze.filter(s => s.sistemaId === sistemaId);
        if (criticidade) servicesToAnalyze = servicesToAnalyze.filter(s => s.criticidade === criticidade);

        const componentCounts = servicesToAnalyze.reduce((acc, s) => {
            acc[s.componenteName] = (acc[s.componenteName] || 0) + 1;
            return acc;
        }, {});

        const sortedComponents = Object.entries(componentCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5);

        chartInstances.topComponentes = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: sortedComponents.map(item => item[0]),
                datasets: [{
                    label: 'Nº de Serviços Atrasados',
                    data: sortedComponents.map(item => item[1]),
                    backgroundColor: '#e74c3c',
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } }
            }
        });
    }

    // --- INICIALIZAÇÃO DA APLICAÇÃO ---
    loadData();
    navigateTo('screen-painel');
});
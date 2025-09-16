document.addEventListener('DOMContentLoaded', () => {
    // --- ESTADO DA APLICAÇÃO ---
    let activeScreen = 'screen-painel';
    const currentDate = new Date('2025-09-11T12:00:00'); // Simula a data de "hoje"
    let activeDateFilter = null;
    let editingItemId = null; // ID genérico para edição, exclusão ou reversão
    // Estado da ordenação da tabela de manutenções
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

    function calculateNextDueDate(lastDateStr, periodicity) {
        const lastDate = new Date(lastDateStr + 'T12:00:00');
        switch (periodicity) {
            case 'Semanal': return new Date(lastDate.setDate(lastDate.getDate() + 7));
            case 'Mensal': return new Date(lastDate.setMonth(lastDate.getMonth() + 1));
            case 'Trimestral': return new Date(lastDate.setMonth(lastDate.getMonth() + 3));
            case 'Semestral': return new Date(lastDate.setMonth(lastDate.getMonth() + 6));
            case 'Anual': return new Date(lastDate.setFullYear(lastDate.getFullYear() + 1));
            default: return new Date();
        }
    }

    function recalculateLastMaintenanceDate(equipmentId) {
        const equipment = MOCK_DATA.equipamentos.find(e => e.id === equipmentId);
        if (!equipment) return;

        const historyForEquipment = MOCK_DATA.historicoManutencoes
            .filter(h => h.equipamentoId === equipmentId)
            .sort((a, b) => new Date(b.data) - new Date(a.data));

        if (historyForEquipment.length > 0) {
            equipment.dataUltimaManutencao = historyForEquipment[0].data;
        } else {
            console.warn(`Não há mais histórico para o equipamento ID ${equipmentId}. A data da última manutenção não pôde ser recalculada.`);
        }
    }

    function generateUpcomingMaintenances() {
        const upcoming = [];
        MOCK_DATA.equipamentos.forEach(equip => {
            const subcategory = MOCK_DATA.subcategorias.find(s => s.id === equip.subcategoriaId);
            if (!subcategory) return;
            const category = MOCK_DATA.categorias.find(c => c.id === equip.categoriaId);

            const hasHistory = MOCK_DATA.historicoManutencoes.some(h => h.equipamentoId === equip.id);
            
            let dueDate;
            if (hasHistory) {
                dueDate = calculateNextDueDate(equip.dataUltimaManutencao, subcategory.periodicidade);
            } else {
                dueDate = new Date(equip.dataUltimaManutencao + 'T12:00:00');
            }

            const status = dueDate < currentDate ? 'Atrasada' : 'A vencer';

            upcoming.push({
                equipmentId: equip.id,
                equipmentName: equip.nome,
                categoryId: equip.categoriaId,
                categoryName: category ? category.nome : 'N/A',
                subcategoryId: equip.subcategoryId,
                date: dueDate,
                status: status,
                type: 'upcoming'
            });
        });
        return upcoming;
    }

    function getAllMaintenancesForDisplay() {
        const upcomingAndOverdue = generateUpcomingMaintenances();
        const completed = MOCK_DATA.historicoManutencoes.map(hist => {
            const equipment = MOCK_DATA.equipamentos.find(e => e.id === hist.equipamentoId);
            if (!equipment) return null;
            const category = MOCK_DATA.categorias.find(c => c.id === equipment.categoriaId);
            return {
                historyId: hist.id,
                equipmentId: equipment.id,
                equipmentName: equipment.nome,
                categoryId: equipment.categoriaId,
                categoryName: category ? category.nome : 'N/A',
                subcategoryId: equipment.subcategoriaId,
                date: new Date(hist.data + 'T12:00:00'),
                status: 'Concluída',
                type: 'completed'
            };
        }).filter(Boolean);
        return [...upcomingAndOverdue, ...completed];
    }


    // --- FUNÇÕES DE CRUD (mantidas para telas de cadastro) ---
    function getCategoryFormHTML(category = {}) {
        const categoryName = category.nome || '';
        return `<form id="category-form"><div class="form-group"><label for="category-name">Nome da Categoria:</label><input type="text" id="category-name" name="category-name" value="${categoryName}" required></div></form>`;
    }
    function handleAddCategory() {
        editingItemId = null;
        const formHtml = getCategoryFormHTML();
        const footerHtml = `<button class="btn btn-secondary" data-action="cancel-modal">Cancelar</button><button class="btn btn-primary" data-action="save-category">Salvar</button>`;
        showModal('Nova Categoria', formHtml, footerHtml);
        document.getElementById('category-name').focus();
    }
    function handleEditCategory(id) {
        editingItemId = id;
        const category = MOCK_DATA.categorias.find(c => c.id === id);
        if (!category) return;
        const formHtml = getCategoryFormHTML(category);
        const footerHtml = `<button class="btn btn-secondary" data-action="cancel-modal">Cancelar</button><button class="btn btn-primary" data-action="save-category">Salvar Alterações</button>`;
        showModal('Editar Categoria', formHtml, footerHtml);
        document.getElementById('category-name').focus();
    }
    function handleDeleteCategory(id) {
        editingItemId = id;
        const category = MOCK_DATA.categorias.find(c => c.id === id);
        if (!category) return;
        const bodyHtml = `<p>Você tem certeza que deseja excluir a categoria <strong>"${category.nome}"</strong>? Esta ação não pode ser desfeita.</p>`;
        const footerHtml = `<button class="btn btn-secondary" data-action="cancel-modal">Cancelar</button><button class="btn btn-danger" data-action="confirm-delete-category">Confirmar Exclusão</button>`;
        showModal('Confirmar Exclusão', bodyHtml, footerHtml);
    }
    function saveCategory() {
        const input = document.getElementById('category-name');
        if (!input.value.trim()) { alert('O nome da categoria não pode estar em branco.'); return; }
        if (editingItemId) {
            const category = MOCK_DATA.categorias.find(c => c.id === editingItemId);
            category.nome = input.value;
        } else {
            const newId = MOCK_DATA.categorias.length > 0 ? Math.max(...MOCK_DATA.categorias.map(c => c.id)) + 1 : 1;
            MOCK_DATA.categorias.push({ id: newId, nome: input.value });
        }
        renderListaCategorias();
        closeModal();
    }
    function confirmDeleteCategory() {
        MOCK_DATA.categorias = MOCK_DATA.categorias.filter(c => c.id !== editingItemId);
        renderListaCategorias();
        closeModal();
    }
    function getSubcategoryFormHTML(subcategory = {}) {
        const { nome = '', categoriaId = '', periodicidade = 'Mensal', checklist = [''] } = subcategory;
        const categoryOptions = MOCK_DATA.categorias.map(cat => `<option value="${cat.id}" ${cat.id === categoriaId ? 'selected' : ''}>${cat.nome}</option>`).join('');
        const periodicidadeOptions = ['Semanal', 'Mensal', 'Trimestral', 'Semestral', 'Anual'].map(p => `<option value="${p}" ${p === periodicidade ? 'selected' : ''}>${p}</option>`).join('');
        const checklistItems = checklist.map(item => `<div class="checklist-item"><input type="text" class="checklist-item-input" value="${item}" placeholder="Descreva o procedimento"><button class="btn btn-danger remove-item-btn" data-action="remove-checklist-item" title="Remover item"><i class="fas fa-trash-alt"></i></button></div>`).join('');
        return `<form id="subcategory-form"><div class="form-group"><label for="subcategory-category">Categoria Pai:</label><select id="subcategory-category" required>${categoryOptions}</select></div><div class="form-group"><label for="subcategory-name">Nome da Subcategoria:</label><input type="text" id="subcategory-name" value="${nome}" required></div><div class="form-group"><label for="subcategory-periodicity">Periodicidade:</label><select id="subcategory-periodicity">${periodicidadeOptions}</select></div><div class="form-group"><label>Procedimentos (Checklist):</label><div class="checklist-container" id="checklist-container">${checklistItems}</div><button type="button" class="btn btn-secondary" id="add-checklist-item-btn" data-action="add-checklist-item"><i class="fas fa-plus"></i> Adicionar Procedimento</button></div></form>`;
    }
    function handleAddSubcategory() {
        editingItemId = null;
        const formHtml = getSubcategoryFormHTML();
        const footerHtml = `<button class="btn btn-secondary" data-action="cancel-modal">Cancelar</button><button class="btn btn-primary" data-action="save-subcategory">Salvar</button>`;
        showModal('Nova Subcategoria', formHtml, footerHtml);
    }
    function handleEditSubcategory(id) {
        editingItemId = id;
        const subcategory = MOCK_DATA.subcategorias.find(s => s.id === id);
        if (!subcategory) return;
        const formHtml = getSubcategoryFormHTML(subcategory);
        const footerHtml = `<button class="btn btn-secondary" data-action="cancel-modal">Cancelar</button><button class="btn btn-primary" data-action="save-subcategory">Salvar Alterações</button>`;
        showModal('Editar Subcategoria', formHtml, footerHtml);
    }
    function handleDeleteSubcategory(id) {
        editingItemId = id;
        const subcategory = MOCK_DATA.subcategorias.find(s => s.id === id);
        if (!subcategory) return;
        const bodyHtml = `<p>Você tem certeza que deseja excluir a subcategoria <strong>"${subcategory.nome}"</strong>?</p>`;
        const footerHtml = `<button class="btn btn-secondary" data-action="cancel-modal">Cancelar</button><button class="btn btn-danger" data-action="confirm-delete-subcategory">Confirmar Exclusão</button>`;
        showModal('Confirmar Exclusão', bodyHtml, footerHtml);
    }
    function saveSubcategory() {
        const categoriaId = parseInt(document.getElementById('subcategory-category').value);
        const nome = document.getElementById('subcategory-name').value.trim();
        const periodicidade = document.getElementById('subcategory-periodicity').value;
        const checklistInputs = document.querySelectorAll('.checklist-item-input');
        const checklist = Array.from(checklistInputs).map(input => input.value.trim()).filter(item => item);
        if (!nome) { alert('O nome da subcategoria é obrigatório.'); return; }
        const data = { categoriaId, nome, periodicidade, checklist };
        if (editingItemId) {
            const index = MOCK_DATA.subcategorias.findIndex(s => s.id === editingItemId);
            MOCK_DATA.subcategorias[index] = { ...MOCK_DATA.subcategorias[index], ...data };
        } else {
            const newId = MOCK_DATA.subcategorias.length > 0 ? Math.max(...MOCK_DATA.subcategorias.map(s => s.id)) + 1 : 1;
            MOCK_DATA.subcategorias.push({ id: newId, ...data });
        }
        renderListaSubcategorias();
        closeModal();
    }
    function confirmDeleteSubcategory() {
        MOCK_DATA.subcategorias = MOCK_DATA.subcategorias.filter(s => s.id !== editingItemId);
        renderListaSubcategorias();
        closeModal();
    }
    function addChecklistItem() {
        const container = document.getElementById('checklist-container');
        const newItem = document.createElement('div');
        newItem.className = 'checklist-item';
        newItem.innerHTML = `<input type="text" class="checklist-item-input" placeholder="Descreva o procedimento"><button class="btn btn-danger remove-item-btn" data-action="remove-checklist-item" title="Remover item"><i class="fas fa-trash-alt"></i></button>`;
        container.appendChild(newItem);
        newItem.querySelector('input').focus();
    }
    function getEquipmentFormHTML(equipment = {}) {
        const { nome = '', local = '', categoriaId = '', subcategoriaId = '', dataUltimaManutencao = '' } = equipment;
        const isNew = !equipment.id;
        const dateLabel = isNew ? '' : 'Data da Última Manutenção'; // Label será definida dinamicamente para novos
        const categoryOptions = MOCK_DATA.categorias.map(cat => `<option value="${cat.id}" ${cat.id === categoriaId ? 'selected' : ''}>${cat.nome}</option>`).join('');
        
        const situationSelector = isNew ? `
            <div class="form-group" id="situation-selector">
                <label>Qual a situação deste equipamento?</label>
                <div class="radio-options-container">
                    <div class="radio-group">
                        <input type="radio" id="sit-new" name="equipment-situation" value="new">
                        <label for="sit-new">Novo, sem manutenções prévias.</label>
                    </div>
                    <div class="radio-group">
                        <input type="radio" id="sit-existing" name="equipment-situation" value="existing">
                        <label for="sit-existing">Em uso, com manutenções anteriores.</label>
                    </div>
                </div>
            </div>` : '';

        return `
            <form id="equipment-form">
                ${situationSelector}
                <div class="form-group">
                    <label for="equipment-category">Categoria:</label>
                    <select id="equipment-category" required><option value="">Selecione...</option>${categoryOptions}</select>
                </div>
                <div class="form-group">
                    <label for="equipment-subcategory">Subcategoria:</label>
                    <select id="equipment-subcategory" required disabled><option value="">Selecione uma categoria primeiro</option></select>
                </div>
                <div class="form-group">
                    <label for="equipment-name">Nome do Equipamento:</label>
                    <input type="text" id="equipment-name" value="${nome}" required>
                </div>
                <div class="form-group">
                    <label for="equipment-local">Local:</label>
                    <input type="text" id="equipment-local" value="${local}">
                </div>
                <div class="form-group ${isNew ? 'hidden' : ''}" id="date-input-group">
                    <label for="equipment-last-maintenance" id="date-label">${dateLabel}</label>
                    <input type="date" id="equipment-last-maintenance" value="${dataUltimaManutencao}" required>
                </div>
                <div id="inherited-info-container" class="inherited-info-container" style="display: none;"></div>
            </form>
        `;
    }
    function updateSubcategoryOptions(categoryId, selectedSubcategoryId = null) {
        const subcatSelect = document.getElementById('equipment-subcategory');
        const filteredSubcats = MOCK_DATA.subcategorias.filter(s => s.categoriaId === categoryId);
        if (filteredSubcats.length > 0) {
            subcatSelect.innerHTML = '<option value="">Selecione...</option>' + filteredSubcats.map(s => `<option value="${s.id}" ${s.id === selectedSubcategoryId ? 'selected' : ''}>${s.nome}</option>`).join('');
            subcatSelect.disabled = false;
        } else {
            subcatSelect.innerHTML = '<option value="">Nenhuma subcategoria encontrada</option>';
            subcatSelect.disabled = true;
        }
    }
    function updateInheritedInfo(subcategoryId) {
        const infoContainer = document.getElementById('inherited-info-container');
        const subcategory = MOCK_DATA.subcategorias.find(s => s.id === subcategoryId);
        if (subcategory) {
            const checklistHtml = subcategory.checklist.length > 0 ? `<ul>${subcategory.checklist.map(item => `<li>${item}</li>`).join('')}</ul>` : '<p>Nenhum procedimento cadastrado.</p>';
            infoContainer.innerHTML = `<h5>Informações Herdeiras da Subcategoria</h5><p><strong>Periodicidade:</strong> ${subcategory.periodicidade}</p><p><strong>Procedimentos Padrão:</strong></p>${checklistHtml}`;
            infoContainer.style.display = 'block';
        } else {
            infoContainer.style.display = 'none';
            infoContainer.innerHTML = '';
        }
    }
    function handleAddEquipment() {
        editingItemId = null;
        const formHtml = getEquipmentFormHTML();
        const footerHtml = `<button class="btn btn-secondary" data-action="cancel-modal">Cancelar</button><button class="btn btn-primary" data-action="save-equipment">Salvar</button>`;
        showModal('Novo Equipamento', formHtml, footerHtml);
    }
    function handleEditEquipment(id) {
        editingItemId = id;
        const equipment = MOCK_DATA.equipamentos.find(e => e.id === id);
        if (!equipment) return;
        const formHtml = getEquipmentFormHTML(equipment);
        const footerHtml = `<button class="btn btn-secondary" data-action="cancel-modal">Cancelar</button><button class="btn btn-primary" data-action="save-equipment">Salvar Alterações</button>`;
        showModal('Editar Equipamento', formHtml, footerHtml);
        updateSubcategoryOptions(equipment.categoriaId, equipment.subcategoriaId);
        updateInheritedInfo(equipment.subcategoriaId);
    }
    function handleDeleteEquipment(id) {
        editingItemId = id;
        const equipment = MOCK_DATA.equipamentos.find(e => e.id === id);
        if (!equipment) return;
        const bodyHtml = `<p>Você tem certeza que deseja excluir o equipamento <strong>"${equipment.nome}"</strong>?</p>`;
        const footerHtml = `<button class="btn btn-secondary" data-action="cancel-modal">Cancelar</button><button class="btn btn-danger" data-action="confirm-delete-equipment">Confirmar Exclusão</button>`;
        showModal('Confirmar Exclusão', bodyHtml, footerHtml);
    }
    function saveEquipment() {
        const categoriaId = parseInt(document.getElementById('equipment-category').value);
        const subcategoriaId = parseInt(document.getElementById('equipment-subcategory').value);
        const nome = document.getElementById('equipment-name').value.trim();
        const local = document.getElementById('equipment-local').value.trim();
        const dataUltimaManutencao = document.getElementById('equipment-last-maintenance').value;
        const situationRadio = document.querySelector('input[name="equipment-situation"]:checked');

        if (editingItemId) { // Modo Edição
            if (!categoriaId || !subcategoriaId || !nome || !dataUltimaManutencao) { alert('Todos os campos, exceto Local, são obrigatórios.'); return; }
            const data = { categoriaId, subcategoriaId, nome, local, dataUltimaManutencao };
            const equipment = MOCK_DATA.equipamentos.find(e => e.id === editingItemId);
            if (equipment.dataUltimaManutencao !== data.dataUltimaManutencao) {
                const newHistoryId = MOCK_DATA.historicoManutencoes.length > 0 ? Math.max(...MOCK_DATA.historicoManutencoes.map(h => h.id)) + 1 : 1;
                MOCK_DATA.historicoManutencoes.push({ id: newHistoryId, equipamentoId: editingItemId, data: data.dataUltimaManutencao, observacao: 'Data ajustada manualmente' });
            }
            Object.assign(equipment, data);
        } else { // Modo Adição
            if (!situationRadio) { alert('Por favor, selecione a situação do equipamento.'); return; }
            if (!categoriaId || !subcategoriaId || !nome || !dataUltimaManutencao) { alert('Todos os campos, exceto Local, são obrigatórios.'); return; }
            
            const situation = situationRadio.value;
            const data = { categoriaId, subcategoriaId, nome, local, dataUltimaManutencao };
            const newId = MOCK_DATA.equipamentos.length > 0 ? Math.max(...MOCK_DATA.equipamentos.map(e => e.id)) + 1 : 1;
            MOCK_DATA.equipamentos.push({ id: newId, ...data });

            if (situation === 'existing') {
                const newHistoryId = MOCK_DATA.historicoManutencoes.length > 0 ? Math.max(...MOCK_DATA.historicoManutencoes.map(h => h.id)) + 1 : 1;
                MOCK_DATA.historicoManutencoes.push({ id: newHistoryId, equipamentoId: newId, data: data.dataUltimaManutencao, observacao: 'Registro inicial de manutenção existente' });
            }
        }
        renderListaEquipamentos();
        closeModal();
    }
    function confirmDeleteEquipment() {
        MOCK_DATA.equipamentos = MOCK_DATA.equipamentos.filter(e => e.id !== editingItemId);
        MOCK_DATA.historicoManutencoes = MOCK_DATA.historicoManutencoes.filter(h => h.equipamentoId !== editingItemId);
        renderListaEquipamentos();
        closeModal();
    }

    // --- FUNÇÕES DE RENDERIZAÇÃO ---
    const renderers = {
        'screen-painel': renderPainelManutencao,
        'screen-lista-equipamentos': renderListaEquipamentos,
        'screen-lista-categorias': renderListaCategorias,
        'screen-lista-subcategorias': renderListaSubcategorias,
        'screen-manutencoes': renderMaintenancesScreen,
        'screen-configuracoes': () => {},
    };

    function renderPainelManutencao() {
        const allMaintenances = generateUpcomingMaintenances();
        const painelTitle = document.getElementById('painel-main-title');
        const clearFilterBtn = document.getElementById('clear-filter-btn');
        if (activeDateFilter) {
            const dataFormatada = new Date(activeDateFilter + 'T12:00:00').toLocaleDateString('pt-BR');
            painelTitle.textContent = `Tarefas para ${dataFormatada}`;
            clearFilterBtn.style.display = 'block';
            const maintenancesOnDay = allMaintenances.filter(m => m.date.toISOString().slice(0, 10) === activeDateFilter);
            renderMaintenanceListToPanel(document.querySelector('#alertas-criticas .lista-os'), maintenancesOnDay.filter(m => m.status === 'Atrasada'), 'status-critica');
            renderMaintenanceListToPanel(document.querySelector('#alertas-mes .lista-os'), maintenancesOnDay.filter(m => m.status === 'A vencer'), 'status-mes');
            document.querySelector('#alertas-proximo-mes .lista-os').innerHTML = '<li>Filtro de data ativo.</li>';
            renderCalendar(currentDate);
            return;
        }
        painelTitle.textContent = 'Painel de Manutenção';
        clearFilterBtn.style.display = 'none';
        const criticas = allMaintenances.filter(m => m.status === 'Atrasada');
        const inicioMes = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const fimMes = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        const mes = allMaintenances.filter(m => m.status === 'A vencer' && m.date >= inicioMes && m.date <= fimMes);
        const inicioProximoMes = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
        const fimProximoMes = new Date(currentDate.getFullYear(), currentDate.getMonth() + 2, 0);
        const proximoMes = allMaintenances.filter(m => m.status === 'A vencer' && m.date >= inicioProximoMes && m.date <= fimProximoMes);
        renderMaintenanceListToPanel(document.querySelector('#alertas-criticas .lista-os'), criticas, 'status-critica');
        renderMaintenanceListToPanel(document.querySelector('#alertas-mes .lista-os'), mes, 'status-mes');
        renderMaintenanceListToPanel(document.querySelector('#alertas-proximo-mes .lista-os'), proximoMes, 'status-proximo-mes');
        renderCalendar(currentDate);
    }

    function renderMaintenanceListToPanel(ulElement, maintenanceList, cssClass) {
        ulElement.innerHTML = '';
        if (maintenanceList.length === 0) {
            ulElement.innerHTML = '<li>Nenhuma tarefa encontrada.</li>';
            return;
        }
        maintenanceList.forEach(m => {
            const li = document.createElement('li');
            li.className = cssClass;
            li.dataset.action = 'complete-maintenance';
            li.dataset.equipmentId = m.equipmentId;
            li.innerHTML = `<strong>${m.equipmentName}</strong><br><small>Vence em: ${m.date.toLocaleDateString('pt-BR')}</small>`;
            ulElement.appendChild(li);
        });
    }
    
    function renderListaCategorias() {
        const tbody = document.querySelector('#screen-lista-categorias tbody');
        tbody.innerHTML = '';
        MOCK_DATA.categorias.forEach(cat => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${cat.nome}</td><td class="actions"><a href="#" title="Editar" data-action="edit-category" data-id="${cat.id}"><i class="fas fa-pencil-alt"></i></a><a href="#" title="Excluir" data-action="delete-category" data-id="${cat.id}"><i class="fas fa-trash-alt"></i></a></td>`;
            tbody.appendChild(tr);
        });
    }
    
    function renderListaSubcategorias() {
        const tbody = document.querySelector('#screen-lista-subcategorias tbody');
        tbody.innerHTML = '';
        MOCK_DATA.subcategorias.forEach(sub => {
            const categoriaPai = MOCK_DATA.categorias.find(c => c.id === sub.categoriaId);
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${sub.nome}</td><td>${categoriaPai ? categoriaPai.nome : 'N/A'}</td><td>${sub.periodicidade}</td><td class="actions"><a href="#" title="Editar" data-action="edit-subcategory" data-id="${sub.id}"><i class="fas fa-pencil-alt"></i></a><a href="#" title="Excluir" data-action="delete-subcategory" data-id="${sub.id}"><i class="fas fa-trash-alt"></i></a></td>`;
            tbody.appendChild(tr);
        });
    }

    function renderListaEquipamentos() {
        const tbody = document.querySelector('#screen-lista-equipamentos tbody');
        tbody.innerHTML = '';
        MOCK_DATA.equipamentos.forEach(eq => {
            const categoria = MOCK_DATA.categorias.find(c => c.id === eq.categoriaId);
            const subcategoria = MOCK_DATA.subcategorias.find(s => s.id === eq.subcategoriaId);
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${eq.nome}</td><td>${categoria ? categoria.nome : 'N/A'}</td><td>${subcategoria ? subcategoria.nome : 'N/A'}</td><td>${eq.local}</td><td>${subcategoria ? subcategoria.periodicidade : 'N/A'}</td><td class="actions"><a href="#" title="Editar" data-action="edit-equipment" data-id="${eq.id}"><i class="fas fa-pencil-alt"></i></a><a href="#" title="Excluir" data-action="delete-equipment" data-id="${eq.id}"><i class="fas fa-trash-alt"></i></a></td>`;
            tbody.appendChild(tr);
        });
    }

    function renderCalendar(date) {
        const calendarContainer = document.getElementById('painel-calendario');
        calendarContainer.innerHTML = '';
        const month = date.getMonth();
        const year = date.getFullYear();
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const header = document.createElement('div');
        header.className = 'calendar-header';
        header.innerHTML = `<h3>${date.toLocaleString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()}</h3><div class="calendar-nav"><button id="prev-month"><i class="fas fa-chevron-left"></i></button><button id="next-month"><i class="fas fa-chevron-right"></i></button></div>`;
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
            if (dateString === currentDate.toISOString().slice(0, 10)) dayCell.classList.add('today');
            if (dateString === activeDateFilter) dayCell.classList.add('filtered');
            grid.appendChild(dayCell);
        }
        calendarContainer.appendChild(grid);
        populateCalendarWithTasks();
        document.getElementById('prev-month').addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(currentDate); });
        document.getElementById('next-month').addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(currentDate); });
    }

    function populateCalendarWithTasks() {
        const maintenances = generateUpcomingMaintenances();
        maintenances.forEach(m => {
            const dateStr = m.date.toISOString().slice(0, 10);
            const dayCell = document.querySelector(`.calendar-day[data-date="${dateStr}"]`);
            if (dayCell && !dayCell.querySelector('.task-dot')) {
                dayCell.classList.add('has-tasks');
                dayCell.insertAdjacentHTML('beforeend', '<div class="task-dot"></div>');
            }
        });
    }

    // --- LÓGICA DA TELA DE MANUTENÇÕES ---
    function renderMaintenancesScreen() {
        populateMaintenanceFilters();
        applyFiltersAndRenderTable();
    }

    function populateMaintenanceFilters() {
        const catSelect = document.getElementById('filter-categoria');
        catSelect.innerHTML = '<option value="">Todas</option>' + MOCK_DATA.categorias.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
        document.getElementById('filter-subcategoria').innerHTML = '<option value="">Todas</option>';
        document.getElementById('filter-subcategoria').disabled = true;
        document.getElementById('filter-equipamento').innerHTML = '<option value="">Todos</option>';
        document.getElementById('filter-equipamento').disabled = true;
    }

    function applyFiltersAndRenderTable() {
        let maintenances = getAllMaintenancesForDisplay();
        const filters = {
            categoryId: parseInt(document.getElementById('filter-categoria').value),
            subcategoryId: parseInt(document.getElementById('filter-subcategoria').value),
            equipmentId: parseInt(document.getElementById('filter-equipamento').value),
            status: document.getElementById('filter-status').value,
            startDate: document.getElementById('filter-data-inicio').value,
            endDate: document.getElementById('filter-data-fim').value,
        };

        if (filters.categoryId) maintenances = maintenances.filter(m => m.categoryId === filters.categoryId);
        if (filters.subcategoryId) maintenances = maintenances.filter(m => m.subcategoryId === filters.subcategoryId);
        if (filters.equipmentId) maintenances = maintenances.filter(m => m.equipmentId === filters.equipmentId);
        if (filters.status) maintenances = maintenances.filter(m => m.status === filters.status);
        if (filters.startDate) maintenances = maintenances.filter(m => m.date >= new Date(filters.startDate + 'T00:00:00'));
        if (filters.endDate) maintenances = maintenances.filter(m => m.date <= new Date(filters.endDate + 'T23:59:59'));

        maintenances.sort((a, b) => {
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
        maintenances.forEach(m => {
            const statusClass = m.status === 'A vencer' ? 'pendente' : m.status.toLowerCase().replace('í', 'i');
            const tr = document.createElement('tr');
            const dateText = m.status === 'Concluída' ? `Realizada em: ${m.date.toLocaleDateString('pt-BR')}` : m.date.toLocaleDateString('pt-BR');
            
            let actionButton;
            if (m.status === 'Concluída') {
                actionButton = `<button class="btn btn-secondary" data-action="revert-maintenance" data-history-id="${m.historyId}"><i class="fas fa-undo"></i> Reverter</button>`;
            } else {
                actionButton = `<button class="btn btn-primary" data-action="complete-maintenance" data-equipment-id="${m.equipmentId}"><i class="fas fa-check"></i> Concluir</button>`;
            }

            tr.innerHTML = `
                <td>${m.equipmentName}</td>
                <td>${m.categoryName}</td>
                <td>${dateText}</td>
                <td><span class="status-badge ${statusClass}">${m.status}</span></td>
                <td class="actions">${actionButton}</td>
            `;
            tbody.appendChild(tr);
        });
        updateSortIcons();
    }
    
    function updateSortIcons() {
        document.querySelectorAll('#maintenance-table th.sortable').forEach(th => {
            th.classList.remove('sorted-asc', 'sorted-desc');
            if (th.dataset.sortKey === sortColumn) {
                th.classList.add(sortDirection === 'asc' ? 'sorted-asc' : 'sorted-desc');
            }
        });
    }

    function handleCompleteMaintenance(equipmentId) {
        editingItemId = equipmentId;
        const equipment = MOCK_DATA.equipamentos.find(e => e.id === equipmentId);
        if (!equipment) return;
        const todayStr = currentDate.toISOString().slice(0, 10);
        const bodyHtml = `
            <form id="complete-maintenance-form">
                <p>Equipamento: <strong>${equipment.nome}</strong></p>
                <div class="form-group">
                    <label for="completion-date">Data de Realização:</label>
                    <input type="date" id="completion-date" value="${todayStr}" required>
                </div>
                 <div class="form-group">
                    <label for="completion-obs">Observações:</label>
                    <textarea id="completion-obs" rows="3" style="width: 100%; padding: 8px; border: 1px solid var(--border-color); border-radius: 5px; box-sizing: border-box;"></textarea>
                </div>
            </form>
        `;
        const footerHtml = `<button class="btn btn-secondary" data-action="cancel-modal">Cancelar</button><button class="btn btn-primary" data-action="save-completion">Salvar Conclusão</button>`;
        showModal('Concluir Manutenção', bodyHtml, footerHtml);
    }

    function saveCompletion() {
        const equipmentId = editingItemId;
        const completionDate = document.getElementById('completion-date').value;
        const completionObs = document.getElementById('completion-obs').value.trim();
        if (!completionDate) { alert('A data de realização é obrigatória.'); return; }
        const equipment = MOCK_DATA.equipamentos.find(e => e.id === equipmentId);
        if (equipment) {
            equipment.dataUltimaManutencao = completionDate;
            const newHistoryId = MOCK_DATA.historicoManutencoes.length > 0 ? Math.max(...MOCK_DATA.historicoManutencoes.map(h => h.id)) + 1 : 1;
            MOCK_DATA.historicoManutencoes.push({
                id: newHistoryId,
                equipamentoId: equipmentId,
                data: completionDate,
                observacao: completionObs || 'Manutenção preventiva concluída.'
            });
        }
        closeModal();
        applyFiltersAndRenderTable();
    }

    function handleRevertMaintenance(historyId) {
        editingItemId = historyId;
        const historyEntry = MOCK_DATA.historicoManutencoes.find(h => h.id === historyId);
        if (!historyEntry) return;
        const bodyHtml = `<p>Você tem certeza que deseja reverter esta manutenção? O registro de conclusão será removido e a próxima manutenção será recalculada a partir da data anterior.</p>`;
        const footerHtml = `<button class="btn btn-secondary" data-action="cancel-modal">Cancelar</button><button class="btn btn-danger" data-action="confirm-revert-maintenance">Confirmar Reversão</button>`;
        showModal('Reverter Manutenção Concluída', bodyHtml, footerHtml);
    }

    function confirmRevertMaintenance() {
        const historyId = editingItemId;
        const historyEntry = MOCK_DATA.historicoManutencoes.find(h => h.id === historyId);
        if (!historyEntry) { closeModal(); return; }
        
        const equipmentId = historyEntry.equipamentoId;
        MOCK_DATA.historicoManutencoes = MOCK_DATA.historicoManutencoes.filter(h => h.id !== historyId);
        recalculateLastMaintenanceDate(equipmentId);
        
        closeModal();
        applyFiltersAndRenderTable();
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
            const equipmentId = parseInt(actionButton.dataset.equipmentId);
            const historyId = parseInt(actionButton.dataset.historyId);
            const startDateInput = document.getElementById('filter-data-inicio');
            const endDateInput = document.getElementById('filter-data-fim');
            const today = new Date(currentDate);

            switch(action) {
                case 'voltar': navigateTo('screen-painel'); break;
                case 'clear-filter': activeDateFilter = null; renderPainelManutencao(); break;
                case 'criar-backup': alert('Backup simulado com sucesso!'); break;
                case 'restaurar-backup': if (confirm('Deseja simular a restauração?')) { alert('Dados restaurados! (Simulação)'); } break;
                case 'cancel-modal': closeModal(); break;
                case 'nova-categoria': handleAddCategory(); break;
                case 'edit-category': handleEditCategory(id); break;
                case 'delete-category': handleDeleteCategory(id); break;
                case 'save-category': saveCategory(); break;
                case 'confirm-delete-category': confirmDeleteCategory(); break;
                case 'nova-subcategoria': handleAddSubcategory(); break;
                case 'edit-subcategory': handleEditSubcategory(id); break;
                case 'delete-subcategory': handleDeleteSubcategory(id); break;
                case 'save-subcategory': saveSubcategory(); break;
                case 'confirm-delete-subcategory': confirmDeleteSubcategory(); break;
                case 'add-checklist-item': addChecklistItem(); break;
                case 'remove-checklist-item': target.closest('.checklist-item').remove(); break;
                case 'novo-equipamento': handleAddEquipment(); break;
                case 'edit-equipment': handleEditEquipment(id); break;
                case 'delete-equipment': handleDeleteEquipment(id); break;
                case 'save-equipment': saveEquipment(); break;
                case 'confirm-delete-equipment': confirmDeleteEquipment(); break;
                case 'complete-maintenance': handleCompleteMaintenance(equipmentId); break;
                case 'save-completion': saveCompletion(); break;
                case 'revert-maintenance': handleRevertMaintenance(historyId); break;
                case 'confirm-revert-maintenance': confirmRevertMaintenance(); break;
                case 'filter-week':
                    const firstDayOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
                    const lastDayOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + 6));
                    startDateInput.value = firstDayOfWeek.toISOString().slice(0, 10);
                    endDateInput.value = lastDayOfWeek.toISOString().slice(0, 10);
                    applyFiltersAndRenderTable();
                    break;
                case 'filter-month':
                    startDateInput.value = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
                    endDateInput.value = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
                    applyFiltersAndRenderTable();
                    break;
                case 'filter-quarter':
                    const quarter = Math.floor(today.getMonth() / 3);
                    const firstDate = new Date(today.getFullYear(), quarter * 3, 1);
                    const lastDate = new Date(firstDate.getFullYear(), firstDate.getMonth() + 3, 0);
                    startDateInput.value = firstDate.toISOString().slice(0, 10);
                    endDateInput.value = lastDate.toISOString().slice(0, 10);
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
        if (target.id === 'equipment-category') {
            const categoryId = parseInt(target.value);
            updateSubcategoryOptions(categoryId);
            updateInheritedInfo(null);
        }
        if (target.id === 'equipment-subcategory') {
            const subcategoryId = parseInt(target.value);
            updateInheritedInfo(subcategoryId);
        }
        if (target.name === 'equipment-situation') {
            const dateGroup = document.getElementById('date-input-group');
            const dateLabel = document.getElementById('date-label');
            dateGroup.classList.remove('hidden');
            if (target.value === 'new') {
                dateLabel.textContent = 'Data da Primeira Manutenção:';
            } else {
                dateLabel.textContent = 'Data da Última Manutenção:';
            }
        }
    });

    document.getElementById('maintenance-filters').addEventListener('change', (e) => {
        const target = e.target;
        if (target.id === 'filter-categoria') {
            const catId = parseInt(target.value);
            const subcatSelect = document.getElementById('filter-subcategoria');
            const equipSelect = document.getElementById('filter-equipamento');
            equipSelect.innerHTML = '<option value="">Todos</option>';
            equipSelect.disabled = true;
            if (catId) {
                const subcats = MOCK_DATA.subcategorias.filter(s => s.categoriaId === catId);
                subcatSelect.innerHTML = '<option value="">Todas</option>' + subcats.map(s => `<option value="${s.id}">${s.nome}</option>`).join('');
                subcatSelect.disabled = false;
            } else {
                subcatSelect.innerHTML = '<option value="">Todas</option>';
                subcatSelect.disabled = true;
            }
        }
        if (target.id === 'filter-subcategoria') {
             const subcatId = parseInt(target.value);
             const equipSelect = document.getElementById('filter-equipamento');
             if (subcatId) {
                const equips = MOCK_DATA.equipamentos.filter(e => e.subcategoriaId === subcatId);
                equipSelect.innerHTML = '<option value="">Todos</option>' + equips.map(e => `<option value="${e.id}">${e.nome}</option>`).join('');
                equipSelect.disabled = false;
             } else {
                equipSelect.innerHTML = '<option value="">Todos</option>';
                equipSelect.disabled = true;
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
import { app } from './firebase-config.js';
import { getFirestore, collection, query, onSnapshot, orderBy } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const db = getFirestore(app);

// Estados Globais
let dadosMestres = [];
let dadosFiltrados = [];
let filtrosPorColuna = {
    senhaAgendamento: [],
    data: [],
    central: [],
    fornecedor: [],
    tipoProduto: [],
    cargas: []
};
let colunaSendoFiltrada = "";

// 1. Inicialização Segura
function init() {
    const userDisplay = document.getElementById('txtUser');
    if(userDisplay) userDisplay.innerText = localStorage.getItem('username') || "D. BRITO";
    
    const q = query(collection(db, "agendamentos"), orderBy("data", "desc"));
    
    onSnapshot(q, (snapshot) => {
        dadosMestres = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(item => item.status !== "Rascunho");

        // Regra Simonetti: Filtra pela data de HOJE no primeiro carregamento
        const hoje = new Date().toISOString().split('T')[0];
        const temDadosHoje = dadosMestres.some(d => d.data === hoje);
        
        // Só aplica o filtro automático se o usuário ainda não tiver filtrado nada
        const jaTemFiltro = Object.values(filtrosPorColuna).some(v => v.length > 0);
        
        if (temDadosHoje && !jaTemFiltro) {
            filtrosPorColuna.data = [hoje];
        }

        atualizarFiltros();
    });
}

// 2. Lógica de Filtragem (Corrigida para evitar o erro de 'null')
window.atualizarFiltros = () => {
    const campoBusca = document.getElementById('inputBusca');
    const termo = campoBusca ? campoBusca.value.toLowerCase() : "";
    let algumFiltroAtivo = false;

    dadosFiltrados = dadosMestres.filter(item => {
        // Verifica filtros de coluna
        const passaColunas = Object.keys(filtrosPorColuna).every(col => {
            if (!filtrosPorColuna[col] || filtrosPorColuna[col].length === 0) return true;
            algumFiltroAtivo = true;
            return filtrosPorColuna[col].includes(String(item[col]));
        });

        // Busca profunda (inclui composição)
        const compStr = item.composicao ? JSON.stringify(item.composicao).toLowerCase() : "";
        const itemStr = (JSON.stringify(item) + compStr).toLowerCase();
        const passaTermo = itemStr.includes(termo);

        return passaColunas && passaTermo;
    });

    // Atualiza interface de filtros ativos
    document.querySelectorAll('th[data-col]').forEach(th => {
        const col = th.getAttribute('data-col');
        if (filtrosPorColuna[col] && filtrosPorColuna[col].length > 0) {
            th.classList.add('active-filter');
        } else {
            th.classList.remove('active-filter');
        }
    });

    const label = document.getElementById('labelFiltroAtivo');
    if(label) label.style.display = algumFiltroAtivo ? "inline" : "none";
    
    renderizarTabela();
};

// 3. Renderização da Tabela
function renderizarTabela() {
    const tbody = document.getElementById('corpoTabela');
    if(!tbody) return;
    
    tbody.innerHTML = "";
    const contador = document.getElementById('count');
    if(contador) contador.innerText = dadosFiltrados.length;

    dadosFiltrados.forEach(item => {
        const tipo = (item.tipoProduto || "").toLowerCase();
        const classeTipo = tipo.includes('eletro') ? 'row-eletro' : 
                          (tipo.includes('move') ? 'row-moveis' : 'row-outros');

        const tr = document.createElement('tr');
        tr.className = classeTipo;
        
        // Formata data para BR
        const dataBR = item.data ? item.data.split('-').reverse().join('/') : '---';

        tr.innerHTML = `
            <td><input type="checkbox" class="row-check" value="${item.id}"></td>
            <td style="font-weight:bold">${item.senhaAgendamento || '---'}</td>
            <td>${dataBR}</td>
            <td>${item.central || '---'}</td>
            <td>${item.cargas || 1}</td>
            <td>${item.fornecedor || '---'}</td>
            <td>${item.tipoProduto || '---'}</td>
            <td>
                <button class="btn-ver" data-id="${item.id}" style="border:none; background:none; color:#C80000; cursor:pointer;">
                    <i class="fas fa-eye fa-lg"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Adiciona evento de clique nos botões de "olho" (necessário por causa do type="module")
    document.querySelectorAll('.btn-ver').forEach(btn => {
        btn.onclick = () => verDetalhes(btn.getAttribute('data-id'));
    });
}

// 4. Modais e Exportação (Expostos para o Window)
window.abrirModalFiltro = (coluna) => {
    colunaSendoFiltrada = coluna;
    const modal = document.getElementById('modalFiltro');
    const container = document.getElementById('opcoesFiltro');
    
    // Pega valores únicos e limpa nulos
    const opcoes = [...new Set(dadosMestres.map(d => String(d[coluna] || "")))].filter(o => o !== "").sort();

    container.innerHTML = opcoes.map(opt => `
        <div style="padding: 10px 0; border-bottom: 1px solid #eee; display: flex; align-items: center; gap: 12px;">
            <input type="checkbox" class="chk-opt" value="${opt}" ${filtrosPorColuna[coluna].includes(opt) ? 'checked' : ''}>
            <label style="font-size:14px; cursor:pointer;">${coluna === 'data' ? opt.split('-').reverse().join('/') : opt}</label>
        </div>
    `).join('');

    modal.style.display = "flex";
};

window.aplicarFiltroColuna = () => {
    const selecionados = Array.from(document.querySelectorAll('.chk-opt:checked')).map(el => el.value);
    filtrosPorColuna[colunaSendoFiltrada] = selecionados;
    window.atualizarFiltros();
    window.fecharModais();
};

window.toggleChecks = (status) => {
    document.querySelectorAll('.chk-opt').forEach(chk => chk.checked = status);
};

window.fecharModais = () => {
    document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = "none");
};

function verDetalhes(id) {
    const item = dadosMestres.find(d => d.id === id);
    const container = document.getElementById('detalhesItens');
    if(!item) return;

    if(!item.composicao || item.composicao.length === 0) {
        container.innerHTML = "<p style='text-align:center; padding:20px;'>Nenhum item detalhado nesta carga.</p>";
    } else {
        container.innerHTML = `
            <table style="width:100%; border-collapse:collapse; font-size:13px;">
                <thead style="background:#f4f4f4;">
                    <tr><th style="padding:10px;">CÓD</th><th style="padding:10px;">DESCRIÇÃO</th><th style="padding:10px;">QTD</th></tr>
                </thead>
                <tbody>
                ${item.composicao.map(i => `
                    <tr>
                        <td style="border-bottom:1px solid #eee; padding:10px; text-align:center;">${i.codigo}</td>
                        <td style="border-bottom:1px solid #eee; padding:10px;">${i.descricao}</td>
                        <td style="border-bottom:1px solid #eee; padding:10px; text-align:center; font-weight:bold;">${i.quantidade}</td>
                    </tr>
                `).join('')}
                </tbody>
            </table>`;
    }
    document.getElementById('modalComposicao').style.display = "flex";
}

window.exportar = (tipo, modo) => {
    const ids = Array.from(document.querySelectorAll('.row-check:checked')).map(el => el.value);
    if(ids.length === 0) return alert("Selecione os itens na tabela primeiro!");

    const selecionados = dadosMestres.filter(d => ids.includes(d.id));

    if(tipo === 'excel') {
        const rows = [];
        selecionados.forEach(d => {
            if(modo === 'completo' && d.composicao) {
                d.composicao.forEach(c => rows.push({ Senha: d.senhaAgendamento, Fornecedor: d.fornecedor, Item: c.descricao, Qtd: c.quantidade }));
            } else {
                rows.push({ Senha: d.senhaAgendamento, Data: d.data, Fornecedor: d.fornecedor, Tipo: d.tipoProduto });
            }
        });
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Dados");
        XLSX.writeFile(wb, `Simonetti_${modo}.xlsx`);
    } else {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.text("Relatorio Simonetti", 14, 10);
        const head = modo === 'completo' ? [['Senha', 'Item', 'Qtd']] : [['Senha', 'Data', 'Fornecedor']];
        const body = [];
        selecionados.forEach(d => {
            if(modo === 'completo' && d.composicao) {
                d.composicao.forEach(c => body.push([d.senhaAgendamento, c.descricao, c.quantidade]));
            } else {
                body.push([d.senhaAgendamento, d.data, d.fornecedor]);
            }
        });
        doc.autoTable({ head, body, startY: 20 });
        doc.save(`Simonetti_${modo}.pdf`);
    }
};

// Dispara o init quando o DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

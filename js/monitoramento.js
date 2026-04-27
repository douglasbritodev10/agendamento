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
    tipoProduto: []
};
let colunaSendoFiltrada = "";

// 1. Inicialização
async function init() {
    // Pega o nome do usuário salvo no login
    const userDisplay = document.getElementById('txtUser');
    if(userDisplay) userDisplay.innerText = localStorage.getItem('username') || "D. BRITO";
    
    const q = query(collection(db, "agendamentos"), orderBy("data", "desc"));
    
    onSnapshot(q, (snapshot) => {
        dadosMestres = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(item => item.status !== "Rascunho");

        // Regra Simonetti: No primeiro acesso, filtra pela data de HOJE automaticamente
        const hoje = new Date().toISOString().split('T')[0];
        const temDadosHoje = dadosMestres.some(d => d.data === hoje);
        
        if (temDadosHoje && Object.values(filtrosPorColuna).every(v => v.length === 0)) {
            filtrosPorColuna.data = [hoje];
        }

        atualizarFiltros();
    });
}

// 2. Lógica de Filtragem (Cascata + Busca Global + Composição)
window.atualizarFiltros = () => {
    const campoBusca = document.getElementById('inputBusca');
    const termo = campoBusca ? campoBusca.value.toLowerCase() : "";
    let algumFiltroAtivo = false;

    dadosFiltrados = dadosMestres.filter(item => {
        const passaColunas = Object.keys(filtrosPorColuna).every(col => {
            if (filtrosPorColuna[col].length === 0) return true;
            algumFiltroAtivo = true;
            return filtrosPorColuna[col].includes(item[col]);
        });

        // Busca profunda: olha nos dados da carga e dentro da lista de itens (composição)
        const compStr = item.composicao ? JSON.stringify(item.composicao).toLowerCase() : "";
        const itemStr = (JSON.stringify(item) + compStr).toLowerCase();
        const passaTermo = itemStr.includes(termo);

        return passaColunas && passaTermo;
    });

    // UI: Muda a cor do cabeçalho se houver filtro aplicado (Amarelo solicitado)
    document.querySelectorAll('th[data-col]').forEach(th => {
        const col = th.getAttribute('data-col');
        if (filtrosPorColuna[col] && filtrosPorColuna[col].length > 0) {
            th.classList.add('active-filter');
        } else {
            th.classList.remove('active-filter');
        }
    });

    const labelFiltro = document.getElementById('labelFiltroAtivo');
    if(labelFiltro) labelFiltro.style.display = algumFiltroAtivo ? "inline" : "none";
    
    renderizarTabela();
};

// 3. Renderização da Tabela com cores por tipo
function renderizarTabela() {
    const tbody = document.getElementById('corpoTabela');
    if(!tbody) return;
    tbody.innerHTML = "";
    document.getElementById('count').innerText = dadosFiltrados.length;

    dadosFiltrados.forEach(item => {
        // Cores baseadas na sua regra de produto
        const tipo = item.tipoProduto?.toLowerCase() || "";
        const classeTipo = tipo.includes('eletro') ? 'row-eletro' : 
                          (tipo.includes('move') ? 'row-moveis' : 'row-outros');

        const tr = document.createElement('tr');
        tr.className = classeTipo;
        tr.innerHTML = `
            <td><input type="checkbox" class="row-check" value="${item.id}"></td>
            <td style="font-weight:bold">${item.senhaAgendamento || '---'}</td>
            <td>${item.data ? item.data.split('-').reverse().join('/') : '---'}</td>
            <td>${item.central || '---'}</td>
            <td>${item.cargas || 1}</td>
            <td>${item.fornecedor || '---'}</td>
            <td>${item.tipoProduto || '---'}</td>
            <td>
                <button onclick="verDetalhes('${item.id}')" style="border:none; background:none; color:#C80000; cursor:pointer;">
                    <i class="fas fa-eye fa-lg"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// 4. Funções de Modal e UI
window.abrirModalFiltro = (coluna) => {
    colunaSendoFiltrada = coluna;
    const modal = document.getElementById('modalFiltro');
    const container = document.getElementById('opcoesFiltro');
    
    // Opções únicas ordenadas A-Z
    const opcoes = [...new Set(dadosMestres.map(d => d[coluna]))].sort();

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
    atualizarFiltros();
    fecharModais();
};

window.toggleChecks = (status) => {
    document.querySelectorAll('.chk-opt').forEach(chk => chk.checked = status);
};

window.verDetalhes = (id) => {
    const item = dadosMestres.find(d => d.id === id);
    const container = document.getElementById('detalhesItens');
    
    if(!item || !item.composicao || item.composicao.length === 0) {
        container.innerHTML = "<p style='text-align:center; padding:20px;'>Nenhum item detalhado nesta carga.</p>";
    } else {
        container.innerHTML = `
            <table style="width:100%; border-collapse:collapse;">
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
            </table>
        `;
    }
    document.getElementById('modalComposicao').style.display = "flex";
};

window.fecharModais = () => {
    document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = "none");
};

// 5. Exportação Robusta (4 tipos)
window.exportar = (tipo, modo) => {
    const checks = document.querySelectorAll('.row-check:checked');
    const ids = Array.from(checks).map(el => el.value);
    
    if(ids.length === 0) return alert("Selecione os agendamentos na tabela primeiro!");

    const itensParaExportar = dadosMestres.filter(d => ids.includes(d.id));

    if(tipo === 'excel') {
        const rows = [];
        itensParaExportar.forEach(d => {
            if(modo === 'completo' && d.composicao) {
                d.composicao.forEach(c => {
                    rows.push({ 
                        Senha: d.senhaAgendamento, 
                        Data: d.data,
                        Fornecedor: d.fornecedor, 
                        Codigo: c.codigo, 
                        Item: c.descricao, 
                        Qtd: c.quantidade 
                    });
                });
            } else {
                rows.push({ 
                    Senha: d.senhaAgendamento, 
                    Data: d.data, 
                    Central: d.central,
                    Fornecedor: d.fornecedor, 
                    Tipo: d.tipoProduto 
                });
            }
        });
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Simonetti_Export");
        XLSX.writeFile(wb, `Simonetti_${modo.toUpperCase()}.xlsx`);
    } else {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        doc.setFontSize(16);
        doc.setTextColor(200, 0, 0);
        doc.text("MÓVEIS SIMONETTI - MONITORAMENTO", 14, 15);
        
        const head = modo === 'completo' ? 
            [['SENHA', 'DESCRIÇÃO ITEM', 'QTD']] : 
            [['SENHA', 'DATA', 'FORNECEDOR', 'CENTRAL']];
        
        const body = [];
        itensParaExportar.forEach(d => {
            if(modo === 'completo' && d.composicao) {
                d.composicao.forEach(c => body.push([d.senhaAgendamento, c.descricao, c.quantidade]));
            } else {
                body.push([d.senhaAgendamento, d.data, d.fornecedor, d.central]);
            }
        });

        doc.autoTable({ 
            head, 
            body, 
            startY: 25,
            headStyles: { fillColor: [200, 0, 0] },
            theme: 'grid'
        });
        
        doc.save(`Simonetti_${modo.toUpperCase()}.pdf`);
    }
};

// Inicia o sistema
init();

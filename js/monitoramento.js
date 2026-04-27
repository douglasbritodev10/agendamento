import { app } from './firebase-config.js';
import { getFirestore, collection, query, onSnapshot, orderBy } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const db = getFirestore(app);

// Estados Globais
let dadosMestres = [];
let dadosFiltrados = [];
let filtrosAtivos = { senhaAgendamento: [], data: [], central: [], fornecedor: [], tipoProduto: [], cargas: [] };
let colunaFiltroAtual = "";

// Paginação e Ordenação
let paginaAtual = 1;
let registrosPorPagina = 50;
let ordenacao = { coluna: 'data', direcao: 'desc' };

// 1. Início
function init() {
    const userDisplay = document.getElementById('txtUser');
    if(userDisplay) userDisplay.innerText = localStorage.getItem('username') || "D. BRITO";
    
    const q = query(collection(db, "agendamentos"), orderBy("data", "desc"));
    
    onSnapshot(q, (snapshot) => {
        dadosMestres = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(item => item.status !== "Rascunho");

        // Filtro automático de hoje apenas no primeiro load
        const hoje = new Date().toISOString().split('T')[0];
        if (dadosMestres.some(d => d.data === hoje) && paginaAtual === 1 && !termoBuscaAtivo()) {
            filtrosAtivos.data = [hoje];
        }

        window.atualizarFiltros();
    });
}

const termoBuscaAtivo = () => document.getElementById('inputBusca')?.value !== "";

// 2. Lógica de Filtros e Busca
window.atualizarFiltros = () => {
    const termo = document.getElementById('inputBusca')?.value.toLowerCase() || "";

    dadosFiltrados = dadosMestres.filter(item => {
        const atendeColunas = Object.keys(filtrosAtivos).every(col => {
            if (filtrosAtivos[col].length === 0) return true;
            return filtrosAtivos[col].includes(String(item[col]));
        });

        const compStr = item.composicao ? JSON.stringify(item.composicao).toLowerCase() : "";
        const atendeBusca = (JSON.stringify(item).toLowerCase() + compStr).includes(termo);

        return atendeColunas && atendeBusca;
    });

    paginaAtual = 1; // Reseta para primeira página ao filtrar
    renderizarTabela();
};

// 3. Renderização com Ordenação e Paginação
function renderizarTabela() {
    const tbody = document.getElementById('corpoTabela');
    if(!tbody) return;

    // Ordenação
    const dadosOrdenados = [...dadosFiltrados].sort((a, b) => {
        let valA = a[ordenacao.coluna] || "";
        let valB = b[ordenacao.coluna] || "";
        return ordenacao.direcao === 'asc' 
            ? valA.toString().localeCompare(valB.toString(), undefined, {numeric: true}) 
            : valB.toString().localeCompare(valA.toString(), undefined, {numeric: true});
    });

    // Paginação
    const inicio = (paginaAtual - 1) * registrosPorPagina;
    const fim = inicio + registrosPorPagina;
    const dadosPaginados = dadosOrdenados.slice(inicio, fim);

    tbody.innerHTML = "";
    dadosPaginados.forEach(item => {
        const dataBR = item.data ? item.data.split('-').reverse().join('/') : '---';
        const tipo = (item.tipoProduto || "").toLowerCase();
        const classeTipo = tipo.includes('eletro') ? 'row-eletro' : (tipo.includes('move') ? 'row-moveis' : '');

        const tr = document.createElement('tr');
        tr.className = classeTipo;
        tr.innerHTML = `
            <td><input type="checkbox" class="row-check" value="${item.id}"></td>
            <td style="font-weight:bold">${item.senhaAgendamento || '---'}</td>
            <td>${dataBR}</td>
            <td>${item.central || '---'}</td>
            <td>${item.cargas || 1}</td>
            <td>${item.fornecedor || '---'}</td>
            <td>${item.tipoProduto || '---'}</td>
            <td>
                <button onclick="verDetalhes('${item.id}')" style="background:none; border:none; color:var(--primary); cursor:pointer;">
                    <i class="fas fa-eye fa-lg"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    atualizarControlesPaginacao();
}

// 4. Controles de Paginação
function atualizarControlesPaginacao() {
    const totalPaginas = Math.ceil(dadosFiltrados.length / registrosPorPagina);
    const container = document.getElementById('botoesPagina');
    const info = document.getElementById('infoPagina');
    
    info.innerText = `Mostrando ${dadosFiltrados.length > 0 ? (paginaAtual - 1) * registrosPorPagina + 1 : 0} até ${Math.min(paginaAtual * registrosPorPagina, dadosFiltrados.length)} de ${dadosFiltrados.length} registros`;

    container.innerHTML = "";
    
    // Botão Anterior
    container.innerHTML += `<button class="btn-page" ${paginaAtual === 1 ? 'disabled' : ''} onclick="irParaPagina(${paginaAtual - 1})">Anterior</button>`;

    // Números das páginas (simplificado)
    for(let i = 1; i <= totalPaginas; i++) {
        if(i === 1 || i === totalPaginas || (i >= paginaAtual - 2 && i <= paginaAtual + 2)) {
            container.innerHTML += `<button class="btn-page ${i === paginaAtual ? 'active' : ''}" onclick="irParaPagina(${i})">${i}</button>`;
        }
    }

    // Botão Próximo
    container.innerHTML += `<button class="btn-page" ${paginaAtual === totalPaginas ? 'disabled' : ''} onclick="irParaPagina(${paginaAtual + 1})">Próximo</button>`;
}

window.irParaPagina = (p) => { paginaAtual = p; renderizarTabela(); };
window.mudarTamanhoPagina = () => {
    registrosPorPagina = parseInt(document.getElementById('selectPageSize').value);
    paginaAtual = 1;
    renderizarTabela();
};

// 5. Ordenação
window.ordenar = (coluna) => {
    if(ordenacao.coluna === coluna) {
        ordenacao.direcao = ordenacao.direcao === 'asc' ? 'desc' : 'asc';
    } else {
        ordenacao.coluna = coluna;
        ordenacao.direcao = 'asc';
    }
    renderizarTabela();
};

// 6. Modal de Composição (CORREÇÃO QUANTIDADE)
window.verDetalhes = (id) => {
    const item = dadosMestres.find(d => d.id === id);
    if(!item) return;

    document.getElementById('tituloComp').innerText = `Detalhes: ${item.senhaAgendamento}`;
    const container = document.getElementById('detalhesItens');

    let totalQtd = 0;
    let tabela = `
        <table style="width:100%; border-collapse:collapse; min-width:600px;">
            <thead style="background:#f4f4f4;">
                <tr><th style="padding:12px;">CÓDIGO</th><th style="padding:12px;">DESCRIÇÃO DO PRODUTO</th><th style="padding:12px;">QTD</th></tr>
            </thead>
            <tbody>`;

    if(item.composicao && item.composicao.length > 0) {
        item.composicao.forEach(prod => {
            const q = parseInt(prod.qtd || prod.quantidade || 0);
            totalQtd += q;
            tabela += `
                <tr>
                    <td style="border-bottom:1px solid #eee; padding:10px; text-align:center;">${prod.codigo}</td>
                    <td style="border-bottom:1px solid #eee; padding:10px;">${prod.descricao}</td>
                    <td style="border-bottom:1px solid #eee; padding:10px; text-align:center; font-weight:bold; color:red;">${q}</td>
                </tr>`;
        });
    }

    tabela += `
            <tr style="background:#f9f9f9; font-weight:bold;">
                <td colspan="2" style="padding:12px; text-align:right;">TOTAL DE PEÇAS:</td>
                <td style="padding:12px; text-align:center; color:red; font-size:16px;">${totalQtd}</td>
            </tr>
        </tbody></table>`;

    container.innerHTML = tabela;
    document.getElementById('modalComposicao').style.display = "flex";
};

// 7. Utilitários (Filtros por Coluna e Modais)
window.abrirModalFiltro = (coluna) => {
    colunaFiltroAtual = coluna;
    const container = document.getElementById('opcoesFiltro');
    const valoresUnicos = [...new Set(dadosMestres.map(d => String(d[coluna] || "")))].sort();

    container.innerHTML = valoresUnicos.map(val => `
        <div style="padding:8px 0; border-bottom:1px solid #eee;">
            <label style="cursor:pointer; display:flex; align-items:center; gap:10px;">
                <input type="checkbox" class="chk-filtro" value="${val}" ${filtrosAtivos[coluna].includes(val) ? 'checked' : ''}> 
                ${coluna === 'data' ? val.split('-').reverse().join('/') : val}
            </label>
        </div>
    `).join('');
    document.getElementById('modalFiltro').style.display = "flex";
};

window.aplicarFiltroColuna = () => {
    const selecionados = Array.from(document.querySelectorAll('.chk-filtro:checked')).map(c => c.value);
    filtrosAtivos[colunaFiltroAtual] = selecionados;
    window.atualizarFiltros();
    window.fecharModais();
};

window.fecharModais = () => {
    document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
};

window.marcarTodos = (el) => {
    document.querySelectorAll('.row-check').forEach(chk => chk.checked = el.checked);
};

// 8. Exportação (Integrada com o seu código anterior)
window.exportar = (tipo, modo) => {
    const selecionadosIds = Array.from(document.querySelectorAll('.row-check:checked')).map(c => c.value);
    if(selecionadosIds.length === 0) return alert("Selecione agendamentos primeiro!");

    const dadosParaExportar = dadosMestres.filter(d => selecionadosIds.includes(d.id));

    if(tipo === 'excel') {
        const rows = [];
        dadosParaExportar.forEach(d => {
            const base = { Senha: d.senhaAgendamento, Data: d.data, Fornecedor: d.fornecedor, Tipo: d.tipoProduto };
            if(modo === 'completo' && d.composicao) {
                d.composicao.forEach(c => rows.push({ ...base, Produto: c.descricao, Qtd: (c.qtd || c.quantidade) }));
            } else {
                rows.push(base);
            }
        });
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Relatorio");
        XLSX.writeFile(wb, `Simonetti_${modo}.xlsx`);
    } else {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');
        
        doc.setFillColor(192, 0, 0);
        doc.rect(0, 0, 210, 20, 'F');
        doc.setTextColor(255, 255, 255);
        doc.text("MÓVEIS SIMONETTI - RELATÓRIO", 14, 13);
        
        const body = [];
        const head = modo === 'completo' ? [['Senha', 'Fornecedor', 'Produto', 'Qtd']] : [['Senha', 'Data', 'Central', 'Fornecedor']];
        
        dadosParaExportar.forEach(d => {
            if(modo === 'completo' && d.composicao) {
                d.composicao.forEach(c => body.push([d.senhaAgendamento, d.fornecedor, c.descricao, (c.qtd || c.quantidade)]));
            } else {
                body.push([d.senhaAgendamento, d.data, d.central, d.fornecedor]);
            }
        });

        doc.autoTable({ head, body, startY: 25, theme: 'grid', headStyles: { fillColor: [192, 0, 0] } });
        doc.save(`Relatorio_Simonetti_${modo}.pdf`);
    }
};

init();

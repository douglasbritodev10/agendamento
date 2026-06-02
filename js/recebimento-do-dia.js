import { app } from './firebase-config.js';
import { getFirestore, collection, query, onSnapshot, orderBy, where } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const db = getFirestore(app);

// Configurações
let dadosMestres = [];
let dadosFiltrados = [];
let filtrosAtivos = { senhaAgendamento: [], data: [], agendasituacao: [] };
let ordenacao = { coluna: 'data', direcao: 'desc' };
let paginaAtual = 1;
const registrosPorPagina = 15;
let myChart = null;
let colunaFiltroAtual = "";

const situacoesCoresMaster = {
    "CARGA RECEBIDA": { hex: "4CAF50" },
    "NO PATIO": { hex: "03A9F4" },
    "EM RECEBIMENTO": { hex: "FFC107" },
    "EM ATRASO": { hex: "F44336" },
    "CANCELADA": { hex: "7A002B" },
    "DEFAULT": { hex: "646464" }
};

function init() {
    document.getElementById('txtUser').innerText = localStorage.getItem('username') || "SISTEMAS";

    // TRAVA: Apenas agendas que estão no Painel (noPainel == true)
    const q = query(
        collection(db, "agendamentos"), 
        where("noPainel", "==", true), 
        orderBy("data", "desc")
    );

    onSnapshot(q, (snapshot) => {
        dadosMestres = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Filtro inicial por data de hoje se houver
        const hoje = new Date().toISOString().split('T')[0];
        if (dadosMestres.some(d => d.data === hoje) && Object.values(filtrosAtivos).every(v => v.length === 0)) {
            filtrosAtivos.data = [hoje];
        }

        window.atualizarFiltros();
    });

    document.getElementById('inputBusca')?.addEventListener('input', window.atualizarFiltros);
}

window.atualizarFiltros = () => {
    const termo = document.getElementById('inputBusca')?.value.toLowerCase() || "";

    dadosFiltrados = dadosMestres.filter(item => {
        const atendeColunas = Object.keys(filtrosAtivos).every(col => {
            if (!filtrosAtivos[col] || filtrosAtivos[col].length === 0) return true;
            return filtrosAtivos[col].includes(String(item[col]));
        });
        const atendeBusca = JSON.stringify(item).toLowerCase().includes(termo);
        return atendeColunas && atendeBusca;
    });

    atualizarIndicadoresVisuais();
    renderizarTudo();
};

function renderizarTudo() {
    renderizarTabela();
    renderizarGrafico(dadosFiltrados);
}

function renderizarTabela() {
    const tbody = document.getElementById('corpoTabela');
    const inicio = (paginaAtual - 1) * registrosPorPagina;
    const paginados = dadosFiltrados.slice(inicio, inicio + registrosPorPagina);

    tbody.innerHTML = "";
    paginados.forEach(item => {
        const conf = situacoesCoresMaster[item.agendasituacao] || situacoesCoresMaster['DEFAULT'];
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input type="checkbox" class="row-check" value="${item.id}"></td>
            <td style="font-weight:bold">${item.senhaAgendamento || '---'}</td>
            <td>${item.data ? item.data.split('-').reverse().join('/') : '---'}</td>
            <td>${item.central || '---'}</td>
            <td>${item.cargas || 1}</td>
            <td><span style="background:#${conf.hex}; color:white; padding:3px 8px; border-radius:4px; font-size:10px; font-weight:bold;">${item.agendasituacao || 'NO PATIO'}</span></td>
            <td>${item.fornecedor || '---'}</td>
            <td>${item.tipoProduto || '---'}</td>
            <td>${item.box || '-'}</td>
            <td><i class="fas fa-eye" onclick="verDetalhes('${item.id}')" style="color:var(--primary); cursor:pointer;"></i></td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('infoPagina').innerText = `Mostrando ${paginados.length} de ${dadosFiltrados.length}`;
}

function renderizarGrafico(dados) {
    const resumo = dados.reduce((acc, curr) => {
        const s = curr.agendasituacao || 'NO PATIO';
        acc[s] = (acc[s] || 0) + 1;
        return acc;
    }, {});

    const labels = Object.keys(resumo);
    const valores = Object.values(resumo);
    const cores = labels.map(l => `#${(situacoesCoresMaster[l] || situacoesCoresMaster['DEFAULT']).hex}`);

    const ctx = document.getElementById('chartSituacao').getContext('2d');
    if (myChart) myChart.destroy();
    myChart = new Chart(ctx, {
        type: 'pie',
        data: { labels, datasets: [{ data: valores, backgroundColor: cores }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });

    document.getElementById('resumoSituacoes').innerHTML = labels.map(l => `
        <div class="legenda-item" style="border-left-color:#${(situacoesCoresMaster[l] || situacoesCoresMaster['DEFAULT']).hex}">
            <span style="flex:1">${l}</span>
            <span style="color:var(--primary); font-size:14px;">${resumo[l]}</span>
        </div>
    `).join('');

    document.getElementById('infoTotal').innerText = `TOTAL NO PAINEL: ${dados.length} AGENDAS`;
}

// --- LÓGICA DE MODAIS E FILTROS ---
window.abrirFiltro = (coluna, event) => {
    event.stopPropagation();
    colunaFiltroAtual = coluna;
    document.getElementById('nomeColunaFiltro').innerText = `Filtrar ${coluna}`;
    const container = document.getElementById('opcoesFiltro');
    
    const todosValores = [...new Set(dadosMestres.map(d => String(d[coluna] || "")))].sort();
    container.innerHTML = todosValores.map(val => `
        <div style="padding:5px;">
            <label><input type="checkbox" class="chk-filtro" value="${val}" ${filtrosAtivos[coluna].includes(val) ? 'checked' : ''}> ${coluna === 'data' ? val.split('-').reverse().join('/') : val}</label>
        </div>
    `).join('');
    
    document.getElementById('modalFiltro').style.display = "flex";
};

window.aplicarFiltroColuna = () => {
    const marcados = Array.from(document.querySelectorAll('.chk-filtro:checked')).map(c => c.value);
    filtrosAtivos[colunaFiltroAtual] = marcados;
    window.atualizarFiltros();
    fecharModais();
};

window.verDetalhes = (id) => {
    const item = dadosMestres.find(d => d.id === id);
    if (!item) return;
    document.getElementById('tituloComp').innerText = `Carga: ${item.senhaAgendamento}`;
    let html = `<table style="width:100%; font-size:12px;"><thead><tr style="background:#eee"><th>CÓD</th><th>DESCRIÇÃO</th><th>QTD</th></tr></thead><tbody>`;
    if(item.composicao) {
        item.composicao.forEach(p => {
            html += `<tr><td>${p.codigo}</td><td>${p.descricao}</td><td style="color:red; font-weight:bold">${p.qtd}</td></tr>`;
        });
    }
    html += `</tbody></table>`;
    document.getElementById('detalhesItens').innerHTML = html;
    document.getElementById('modalComposicao').style.display = "flex";
};

function atualizarIndicadoresVisuais() {
    ['senhaAgendamento', 'data', 'agendasituacao'].forEach(col => {
        const btn = document.getElementById(`btn-filter-${col}`);
        if (btn) {
            btn.style.background = filtrosAtivos[col].length > 0 ? "#fff176" : "white";
            btn.innerText = filtrosAtivos[col].length > 0 ? "APLICADO" : "FILTRO";
        }
    });
}

window.fecharModais = () => {
    document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = "none");
};

window.logout = () => { localStorage.clear(); window.location.href = 'index.html'; };

init();

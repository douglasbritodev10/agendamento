import { app } from './firebase-config.js';
import { getFirestore, collection, query, onSnapshot, orderBy, where, getDoc, doc } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const db = getFirestore(app);

// Cores Master Simonetti
const situacoesCoresMaster = {
    "CARGA RECEBIDA": { hex: "4CAF50", rgb: [76, 175, 80], txt: [255, 255, 255] },
    "NO PATIO - FICOU P/ AMANHÃ": { hex: "3ACFB9", rgb: [58, 207, 185], txt: [0, 0, 0] },
    "CANCELADA": { hex: "7A002B", rgb: [122, 0, 43], txt: [255, 255, 255] },
    "SOB AJUSTE": { hex: "8B27F5", rgb: [139, 39, 245], txt: [255, 255, 255] },
    "NO PATIO - SOB ENCAIXE": { hex: "FF7625", rgb: [255, 118, 37], txt: [0, 0, 0] },
    "NO PATIO - FICOU DE ONTEM": { hex: "B249BF", rgb: [178, 73, 191], txt: [255, 255, 255] },
    "EM RECEBIMENTO": { hex: "FFC107", rgb: [255, 193, 7], txt: [0, 0, 0] },
    "NO PATIO": { hex: "03A9F4", rgb: [3, 169, 244], txt: [0, 0, 0] },
    "EM ATRASO": { hex: "F44336", rgb: [244, 67, 54], txt: [255, 255, 255] },
    "REAGENDA": { hex: "9B591B", rgb: [155, 89, 27], txt: [255, 255, 255] },
    "DEFAULT": { hex: "646464", rgb: [100, 100, 100], txt: [255, 255, 255] }
};

let dadosMestres = [];
let myChart = null;

function init() {
    const user = localStorage.getItem('username') || "OPERADOR";
    document.getElementById('txtUser').innerText = user.toUpperCase();

    // TRAVA DE SEGURANÇA: Somente agendas que estão no Painel
    const q = query(
        collection(db, "agendamentos"), 
        where("noPainel", "==", true), // <- Aqui garante que só vem o combinado
        orderBy("data", "desc")
    );

    onSnapshot(q, (snapshot) => {
        dadosMestres = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderizarTudo(dadosMestres);
    });

    document.getElementById('inputBusca').addEventListener('input', (e) => {
        const termo = e.target.value.toLowerCase();
        const filtrados = dadosMestres.filter(d => 
            d.senhaAgendamento?.toLowerCase().includes(termo) || 
            d.fornecedor?.toLowerCase().includes(termo) ||
            d.cargas?.toLowerCase().includes(termo)
        );
        renderizarTudo(filtrados);
    });
}

function renderizarTudo(dados) {
    renderizarTabela(dados);
    renderizarGrafico(dados);
}

function renderizarTabela(dados) {
    const tbody = document.getElementById('corpoTabela');
    tbody.innerHTML = "";

    dados.forEach(ag => {
        const conf = situacoesCoresMaster[ag.agendasituacao] || situacoesCoresMaster['DEFAULT'];
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input type="checkbox" class="check-export" value="${ag.id}"></td>
            <td style="font-weight:bold; color:#d32f2f">${ag.senhaAgendamento}<br><small style="color:#007bff">${ag.veiculoAgrupado || ''}</small></td>
            <td>${ag.data ? ag.data.split('-').reverse().join('/') : '-'}</td>
            <td>${ag.central || '-'}</td>
            <td>${ag.cargas || '-'}</td>
            <td><span style="background:#${conf.hex}; color:white; padding:4px 8px; border-radius:4px; font-size:10px;">${ag.agendasituacao || 'NO PATIO'}</span></td>
            <td>${ag.fornecedor || '-'}</td>
            <td>${ag.tipoProduto || '-'}</td>
            <td>${ag.box || '-'}</td>
            <td>
                <i class="fas fa-eye" onclick="verComposicao('${ag.id}')" style="color:var(--primary); cursor:pointer; font-size:18px;"></i>
            </td>
        `;
        tbody.appendChild(tr);
    });
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

    // Gráfico Maior e sem legendas flutuantes
    const ctx = document.getElementById('chartSituacao').getContext('2d');
    if (myChart) myChart.destroy();
    myChart = new Chart(ctx, {
        type: 'pie',
        data: { labels, datasets: [{ data: valores, backgroundColor: cores }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });

    // Legendas Organizadas em Quadrados/Cards
    const containerLegenda = document.getElementById('resumoSituacoes');
    containerLegenda.innerHTML = labels.map(l => {
        const conf = situacoesCoresMaster[l] || situacoesCoresMaster['DEFAULT'];
        return `
            <div class="legenda-item" style="border-left-color: #${conf.hex}">
                <div style="flex:1">${l}</div>
                <div style="font-size:14px; margin-left:10px; color:#C00000">${resumo[l]}</div>
            </div>
        `;
    }).join('');

    const totalCarros = new Set(dados.map(d => d.veiculoAgrupado || d.senhaAgendamento)).size;
    document.getElementById('infoTotal').innerHTML = `<i class="fas fa-truck"></i> CARROS: ${totalCarros} | <i class="fas fa-file-alt"></i> AGENDAS: ${dados.length}`;
}

// Modal Único para Composição e Filtros
window.verComposicao = async (id) => {
    const docRef = doc(db, "agendamentos", id);
    const snap = await getDoc(docRef);
    const body = document.getElementById('modalBody');
    document.getElementById('modalTitulo').innerText = "Composição da Carga";
    
    if (snap.exists() && snap.data().composicao) {
        const comp = snap.data().composicao;
        body.innerHTML = comp.map(item => `
            <div style="border-bottom:1px solid #eee; padding:10px 0;">
                <div style="font-weight:bold; color:var(--primary)">CÓD: ${item.codigo}</div>
                <div style="font-size:13px;">${item.descricao}</div>
                <div style="font-size:12px; color:#666">QTD: ${item.qtd}</div>
            </div>
        `).join('');
    } else {
        body.innerHTML = "<p>Nenhuma composição detalhada encontrada.</p>";
    }
    document.getElementById('modalGeral').style.display = 'flex';
};

window.showFiltroModal = (tipo) => {
    document.getElementById('modalTitulo').innerText = `Filtrar por ${tipo.toUpperCase()}`;
    const listaOriginal = [...new Set(dadosMestres.map(d => d[tipo === 'situacao' ? 'agendasituacao' : tipo]))];
    
    document.getElementById('modalBody').innerHTML = listaOriginal.map(item => `
        <div style="padding:10px; cursor:pointer; border-bottom:1px solid #eee" onclick="aplicarFiltroRapido('${tipo}', '${item}')">
            ${item || 'Não informado'}
        </div>
    `).join('');
    document.getElementById('modalGeral').style.display = 'flex';
};

window.aplicarFiltroRapido = (campo, valor) => {
    const filtrados = dadosMestres.filter(d => (d[campo === 'situacao' ? 'agendasituacao' : campo]) === valor);
    renderizarTudo(filtrados);
    fecharModal();
};

window.fecharModal = () => document.getElementById('modalGeral').style.display = 'none';
window.logout = () => { localStorage.clear(); window.location.href = 'index.html'; };

init();

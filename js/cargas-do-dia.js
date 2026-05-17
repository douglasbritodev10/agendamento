import { app } from './firebase-config.js';
import { 
    getFirestore, collection, query, onSnapshot, doc, updateDoc, orderBy, getDocs 
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const db = getFirestore(app);

const situacoesMap = {
    "CARGA RECEBIDA": '#4CAF50',
    "NO PATIO - FICOU P/ AMANHÃ": '#3ACFB9',
    "CANCELADA": '#7a002b',
    "SOB AJUSTE": '#8B27F5',
    "NO PATIO - SOB ENCAIXE": '#ff7625',
    "NO PATIO - FICOU DE ONTEM": '#B249BF',
    "EM RECEBIMENTO": '#FFC107',
    "NO PATIO": '#03A9F4',
    "EM ATRASO": '#F44336',
    "REAGENDA": '#9B591B'
};

const usuarioLogin = localStorage.getItem('username') || "USUÁRIO";
const nivelAcesso = (localStorage.getItem('nivelAcesso') || "LEITOR").toUpperCase();

let todasCargas = [];
let cooperados = [];
let idAgendaAtual = null;
let chartInstance = null;

document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('userNameDisplay').textContent = usuarioLogin;
    if(nivelAcesso !== 'LEITOR') document.getElementById('btnVincular').style.display = 'block';
    
    await carregarCooperados();
    ouvirCargas();
});

async function carregarCooperados() {
    const snap = await getDocs(collection(db, "cooperados"));
    cooperados = snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function ouvirCargas() {
    const q = query(collection(db, "agendamentos"), orderBy("data", "asc"));
    onSnapshot(q, (snapshot) => {
        todasCargas = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        renderizarTabela();
        atualizarDashboard();
    });
}

function getCorTipo(tp) {
    const t = tp.toUpperCase();
    if (['ROUPEIRO', 'ARMARIO', 'COZINHA', 'PAINEL', 'MODULO', 'MULTIUSO', 'BALCAO', 'COMODA'].some(x => t.includes(x))) return '#FFFF00';
    if (['CELULAR', 'TABLET', 'RELOGIO', 'ROBO', 'NOTEBOOK'].some(x => t.includes(x))) return '#00BFFF';
    if (t.includes('MESA')) return '#4CAF50';
    return '#E0E0E0';
}

function renderizarTabela() {
    const tbody = document.getElementById('tabelaCargas');
    const disabled = nivelAcesso === 'LEITOR' ? 'disabled' : '';

    tbody.innerHTML = todasCargas.map(c => {
        const corStatus = situacoesMap[c.agendasituacao] || '#ccc';
        const corTipo = getCorTipo(c.tipo || '');
        
        return `
            <tr>
                <td><input type="checkbox" class="row-check" data-id="${c.id}" ${disabled}></td>
                <td><b>${c.senha}</b></td>
                <td>${c.data}</td>
                <td style="font-size:10px; max-width:150px;">${c.cargas}</td>
                <td>
                    <select onchange="atualizarSituacao('${c.id}', this.value)" class="status-select" style="background:${corStatus}" ${disabled}>
                        <option value="">SELECIONE</option>
                        ${Object.keys(situacoesMap).map(s => `<option value="${s}" ${c.agendasituacao === s ? 'selected' : ''}>${s}</option>`).join('')}
                    </select>
                </td>
                <td><span class="badge-tipo" style="background:${corTipo}">${c.tipo}</span></td>
                <td>${c.fornecedor}</td>
                <td><input type="text" value="${c.box || ''}" onchange="salvarBox('${c.id}', this.value)" style="width:50px; text-align:center;" ${disabled}></td>
                <td>
                    <button onclick="abrirModalDescarga('${c.id}')" title="Vincular Descarga" style="border:none; background:none; cursor:pointer; color:#2e7d32; font-size:1.1rem;" ${disabled}>
                        <i class="fas fa-truck-loading"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

window.atualizarSituacao = async (id, novaSituacao) => {
    await updateDoc(doc(db, "agendamentos", id), { agendasituacao: novaSituacao });
};

window.salvarBox = async (id, valor) => {
    await updateDoc(doc(db, "agendamentos", id), { box: valor.toUpperCase() });
};

window.abrirModalDescarga = (id) => {
    idAgendaAtual = id;
    const lista = document.getElementById('listaCooperados');
    lista.innerHTML = cooperados.map(coop => `
        <label style="display:flex; align-items:center; gap:8px; margin-bottom:5px; cursor:pointer;">
            <input type="checkbox" class="coop-sel" value="${coop.nome}"> ${coop.nome}
        </label>
    `).join('');
    document.getElementById('modalDescarga').style.display = 'flex';
};

window.salvarDescarga = async () => {
    const selecionados = Array.from(document.querySelectorAll('.coop-sel:checked')).map(i => i.value);
    const valor = document.getElementById('valorDescarga').value;
    
    if(!valor || selecionados.length === 0) return alert("Preencha o valor e selecione os cooperados!");

    await updateDoc(doc(db, "agendamentos", idAgendaAtual), {
        cooperadosDescarga: selecionados,
        valorDescarga: valor
    });
    fecharModal();
};

window.fecharModal = () => document.getElementById('modalDescarga').style.display = 'none';

// --- DASHBOARD E LOGOUT ---
function atualizarDashboard() {
    document.getElementById('totalAgendas').textContent = todasCargas.length;
    const veiculos = new Set(todasCargas.map(c => c.veiculoAgrupado || c.id));
    document.getElementById('totalVeiculos').textContent = veiculos.size;
}

function renderizarGrafico() {
    const ctx = document.getElementById('statusChart').getContext('2d');
    const resumo = {};
    todasCargas.forEach(c => {
        const s = c.agendasituacao || "PENDENTE";
        resumo[s] = (resumo[s] || 0) + 1;
    });

    if(chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(resumo),
            datasets: [{
                data: Object.values(resumo),
                backgroundColor: Object.keys(resumo).map(s => situacoesMap[s] || '#eee'),
                borderWidth: 0
            }]
        },
        options: { maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
}

window.logout = () => { localStorage.clear(); window.location.href = "index.html"; };
window.toggleAll = () => {
    const m = document.getElementById('selectAll').checked;
    document.querySelectorAll('.row-check').forEach(i => i.checked = m);
};

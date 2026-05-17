import { app } from './firebase-config.js';
import { 
    getFirestore, collection, query, onSnapshot, doc, updateDoc, orderBy, addDoc 
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const db = getFirestore(app);

// Lendo dados do seu padrão de Login
const usuarioNome = localStorage.getItem('usuarioNome') || "USUÁRIO";
const usuarioLogin = localStorage.getItem('username') || "LOGIN";
const nivelAcesso = (localStorage.getItem('nivelAcesso') || "LEITOR").toUpperCase();

let todasCargas = [];
let chartInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('userNameDisplay').textContent = usuarioLogin;
    
    // Trava de segurança: só ADM ou LOGISTICA podem vincular
    if(nivelAcesso !== 'LEITOR') {
        document.getElementById('btnVincular').style.display = 'block';
    }

    ouvirCargas();
});

function ouvirCargas() {
    const q = query(collection(db, "agendamentos"), orderBy("data", "asc"));
    
    onSnapshot(q, (snapshot) => {
        todasCargas = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        renderizarTabela();
        atualizarCards();
        renderizarGrafico();
    });
}

function renderizarTabela() {
    const tbody = document.getElementById('tabelaCargas');
    const disabled = nivelAcesso === 'LEITOR' ? 'disabled' : '';

    tbody.innerHTML = todasCargas.map(c => {
        const cor = getCores(c.situacao);
        return `
            <tr>
                <td><input type="checkbox" class="row-check" data-id="${c.id}" ${disabled}></td>
                <td><b>${c.senha}</b></td>
                <td>${c.data}</td>
                <td>${c.central}</td>
                <td style="font-size:11px">${c.cargas}</td>
                <td>
                    <select onchange="mudarStatus('${c.id}', this.value)" class="status-select" style="background:${cor.bg}; color:${cor.text}" ${disabled}>
                        ${getOptions(c.situacao)}
                    </select>
                </td>
                <td>${c.fornecedor}</td>
                <td><input type="text" value="${c.box || ''}" onchange="salvarBox('${c.id}', this.value)" style="width:50px; text-align:center;" ${disabled}></td>
                <td>
                   <button onclick="verDetalhes('${c.id}')" style="border:none; background:none; cursor:pointer; color:#1976D2"><i class="fas fa-eye"></i></button>
                </td>
            </tr>
        `;
    }).join('');
}

function atualizarCards() {
    document.getElementById('totalAgendas').textContent = todasCargas.length;
    
    const veiculos = new Set();
    todasCargas.forEach(c => {
        // Se estiver agrupado, conta o ID do grupo, senão conta o ID da própria agenda
        veiculos.add(c.veiculoAgrupado || c.id);
    });
    document.getElementById('totalVeiculos').textContent = veiculos.size;
}

function renderizarGrafico() {
    const ctx = document.getElementById('statusChart').getContext('2d');
    const resumo = {};
    todasCargas.forEach(c => {
        const s = c.situacao || "AGUARDANDO";
        resumo[s] = (resumo[s] || 0) + 1;
    });

    if(chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(resumo),
            datasets: [{
                data: Object.values(resumo),
                backgroundColor: Object.keys(resumo).map(s => getCores(s).bg),
                borderWidth: 0
            }]
        },
        options: { maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
}

// Funções de Ação
window.mudarStatus = async (id, status) => {
    await updateDoc(doc(db, "agendamentos", id), { situacao: status });
};

window.salvarBox = async (id, valor) => {
    await updateDoc(doc(db, "agendamentos", id), { box: valor.toUpperCase() });
};

window.vincularAgendas = async () => {
    const selecionados = Array.from(document.querySelectorAll('.row-check:checked')).map(i => i.dataset.id);
    if(selecionados.length < 2) return alert("Selecione pelo menos 2 cargas!");
    
    const grupoID = "G-" + Date.now();
    for(let id of selecionados) {
        await updateDoc(doc(db, "agendamentos", id), { veiculoAgrupado: grupoID });
    }
    alert("Cargas vinculadas ao mesmo veículo!");
};

window.logout = () => {
    localStorage.clear();
    window.location.href = "index.html";
};

// Helpers de Cores
function getCores(s) {
    if(s === 'OK') return { bg: '#2e7d32', text: 'white' };
    if(s === 'SEM NOTA') return { bg: '#d32f2f', text: 'white' };
    if(s === 'REAGENDADA') return { bg: '#757575', text: 'white' };
    return { bg: '#fbc02d', text: '#333' }; // Aguardando / Outros
}

function getOptions(atual) {
    const lista = ["AGUARDANDO", "DESCARREGANDO", "OK", "SEM NOTA", "REAGENDADA"];
    return lista.map(o => `<option value="${o}" ${o === atual ? 'selected' : ''}>${o}</option>`).join('');
}

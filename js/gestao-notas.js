import { app } from './firebase-config.js';
import { getFirestore, collection, query, where, onSnapshot, doc, updateDoc } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const db = getFirestore(app);
const usuarioAtivo = localStorage.getItem('username') || "D. BRITO";
const nivelAcesso = localStorage.getItem('userRole') || 'admin'; // admin, colaborador, leitor

let dadosMestres = [];
let dadosFiltrados = [];
let filtrosAtivos = { 
    senhaAgendamento: [], data: [], fornecedor: [], 
    notaFiscal: [], cte: [], situacao: [] 
};
let colunaFiltroAtual = "";

// 1. INICIALIZAÇÃO
function init() {
    if (!localStorage.getItem('userId')) window.location.href = 'index.html';

    // Busca apenas agendamentos com status "Agendado"
    const q = query(collection(db, "agendamentos"), where("status", "==", "Agendado"));
    
    onSnapshot(q, (snapshot) => {
        dadosMestres = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        window.atualizarFiltros();
    });
}

// 2. FILTROS E INDICADORES
window.atualizarFiltros = () => {
    dadosFiltrados = dadosMestres.filter(item => {
        return Object.keys(filtrosAtivos).every(col => {
            if (!filtrosAtivos[col] || filtrosAtivos[col].length === 0) return true;
            return filtrosAtivos[col].includes(String(item[col] || ""));
        });
    });
    atualizarIndicadoresVisuais();
    renderizarTabela();
};

function atualizarIndicadoresVisuais() {
    Object.keys(filtrosAtivos).forEach(col => {
        const btn = document.getElementById(`btn-filter-${col}`);
        if (btn) {
            if (filtrosAtivos[col].length > 0) {
                btn.innerText = 'APLICADO';
                btn.style.backgroundColor = '#fff176';
                btn.style.color = '#333';
                btn.style.padding = '2px 5px';
                btn.style.borderRadius = '4px';
            } else {
                btn.innerText = 'FILTRO';
                btn.style = "";
            }
        }
    });
}

// 3. RENDERIZAÇÃO E CORES
function renderizarTabela() {
    const tbody = document.getElementById('corpoTabela');
    tbody.innerHTML = "";

    dadosFiltrados.forEach(item => {
        const tr = document.createElement('tr');
        const classeSit = getClasseSituacao(item.situacao || 'OC PENDENTE');
        
        tr.innerHTML = `
            <td><input type="checkbox" class="row-check" value="${item.id}"></td>
            <td style="font-weight:bold">${item.senhaAgendamento}</td>
            <td>${item.data.split('-').reverse().join('/')}</td>
            <td>${item.fornecedor}</td>
            <td>${item.notaFiscal || '---'}</td>
            <td>${item.cte || '---'}</td>
            <td><span class="badge-situacao ${classeSit}">${item.situacao || 'OC PENDENTE'}</span></td>
            <td>
                <button onclick="abrirEdicaoNota('${item.id}')" style="background:none; border:none; cursor:pointer; color:var(--primary)">
                    <i class="fas ${item.editandoPor ? 'fa-lock' : 'fa-edit'} fa-lg"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function getClasseSituacao(sit) {
    const mapa = {
        'OK NO AJUSTE': 'sit-ok', 'SEM NOTA': 'sit-sem-nota', 'REAGENDADA': 'sit-reagendada',
        'SOBRE AJUSTE': 'sit-sobre-ajuste', 'CANCELADA': 'sit-cancelada', 'OC PENDENTE': 'sit-oc-pendente',
        'SEM TRIANGULAÇÃO': 'sit-sem-triangulacao', 'VENCIMENTO ERRADO': 'sit-vencimento-errado',
        'FALTA CTe': 'sit-falta-cte', 'NOTA ERRADA': 'sit-nota-errada', 'CTe DIVERGENTE': 'sit-cte-divergente'
    };
    return mapa[sit] || 'sit-oc-pendente';
}

// 4. LÓGICA DE BLOQUEIO (LOCK)
window.abrirEdicaoNota = async (id) => {
    if (nivelAcesso === 'leitor') return alert("Acesso apenas para visualização.");

    const item = dadosMestres.find(d => d.id === id);
    if (item.editandoPor && item.editandoPor !== usuarioAtivo) {
        return alert(`Agenda bloqueada! ${item.editandoPor} está editando agora.`);
    }

    // Trava a agenda no Firebase
    await updateDoc(doc(db, "agendamentos", id), { editandoPor: usuarioAtivo });

    document.getElementById('editIdAgendamento').value = id;
    document.getElementById('inputNF').value = item.notaFiscal || '';
    document.getElementById('inputCTe').value = item.cte || '';
    document.getElementById('selectSituacao').value = item.situacao || 'OC PENDENTE';
    document.getElementById('modalNotas').style.display = 'flex';
};

window.cancelarEdicao = async () => {
    const id = document.getElementById('editIdAgendamento').value;
    if (id) await updateDoc(doc(db, "agendamentos", id), { editandoPor: null });
    fecharModais();
};

window.salvarDadosNota = async () => {
    const id = document.getElementById('editIdAgendamento').value;
    await updateDoc(doc(db, "agendamentos", id), {
        notaFiscal: document.getElementById('inputNF').value,
        cte: document.getElementById('inputCTe').value,
        situacao: document.getElementById('selectSituacao').value,
        editandoPor: null // Libera a trava
    });
    fecharModais();
};

window.fecharModais = () => { document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none'); };

// Inicializa
init();

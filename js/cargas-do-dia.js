import { app } from './firebase-config.js';
import { 
    getFirestore, collection, query, onSnapshot, doc, updateDoc, orderBy, addDoc, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const db = getFirestore(app);
const usuarioLogin = localStorage.getItem('username') || "SISTEMA";
let todasAgendasDoBanco = [];

const situacoesCores = {
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

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('userNameDisplay').textContent = usuarioLogin;
    ouvirDados();
});

// 1. Ouvir dados do Firebase
function ouvirDados() {
    const q = query(collection(db, "agendamentos"), orderBy("data", "desc"));
    onSnapshot(q, (snapshot) => {
        todasAgendasDoBanco = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        renderizarPainelPrincipal();
    });
}

// 2. Renderizar Painel (Cargas que já estão 'No Painel')
function renderizarPainelPrincipal() {
    const tbody = document.getElementById('tabelaCargas');
    const noPainel = todasAgendasDoBanco.filter(a => a.noPainel === true);
    
    tbody.innerHTML = noPainel.map(c => `
        <tr>
            <td><b>${c.senha}</b><br><small>${c.data}</small></td>
            <td>
                <span class="status-badge" style="background:${situacoesCores[c.agendasituacao] || '#999'}">
                    ${c.agendasituacao || 'PENDENTE'}
                </span>
            </td>
            <td>${c.central}</td>
            <td>${c.fornecedor}</td>
            <td>${c.tipo}</td>
            <td><input type="text" value="${c.box || ''}" onchange="atualizarCampo('${c.id}', 'box', this.value)" style="width:50px; text-align:center;"></td>
            <td>
                <button onclick="removerDoPainel('${c.id}')" style="color:red; border:none; background:none; cursor:pointer;"><i class="fas fa-eye-slash"></i></button>
            </td>
        </tr>
    `).join('');

    document.getElementById('totalAgendas').textContent = noPainel.length;
    document.getElementById('totalVeiculos').textContent = new Set(noPainel.map(p => p.senha)).size;
}

// 3. Lógica do Modal (Ordenação Inteligente)
window.abrirModalSelecao = () => {
    const hoje = new Date();
    const amanha = new Date(hoje);
    amanha.setDate(hoje.getDate() + 1);
    
    // Formata amanhã para DD/MM/YYYY
    const amanhaFormatado = `${String(amanha.getDate()).padStart(2, '0')}/${String(amanha.getMonth() + 1).padStart(2, '0')}/${amanha.getFullYear()}`;

    // Ordenar: Amanhã primeiro, depois o resto
    const listaParaModal = todasAgendasDoBanco.filter(a => !a.noPainel).sort((a, b) => {
        if (a.data === amanhaFormatado) return -1;
        if (b.data === amanhaFormatado) return 1;
        return 0;
    });

    renderizarTabelaModal(listaParaModal);
    document.getElementById('modalSelecao').style.display = 'flex';
};

function getCorTipo(tp) {
    const t = tp.toUpperCase();
    if (['ROUPEIRO', 'ARMARIO', 'COZINHA', 'PAINEL', 'MODULO', 'MULTIUSO', 'BALCAO', 'COMODA'].some(x => t.includes(x))) return '#FFFF00';
    if (['CELULAR', 'TABLET', 'RELOGIO', 'ROBO', 'NOTEBOOK'].some(x => t.includes(x))) return '#00BFFF';
    if (t.includes('MESA')) return '#4CAF50';
    return '#E0E0E0';
}

function renderizarTabelaModal(lista) {
    const tbody = document.getElementById('corpoBuscaModal');
    tbody.innerHTML = lista.map(a => `
        <tr class="linha-modal" data-data="${a.data}" data-txt="${a.fornecedor} ${a.senha}">
            <td><input type="checkbox" class="check-item" value="${a.id}" data-senha="${a.senha}"></td>
            <td><b>${a.senha}</b></td>
            <td>${a.data}</td>
            <td style="font-size:0.7rem">${a.cargas || '-'}</td>
            <td>${a.agendasituacao || 'PENDENTE'}</td>
            <td>${a.fornecedor}</td>
            <td>${a.tipo}</td>
            <td>${a.box || ''}</td>
        </tr>
    `).join('');
}

// 4. Filtros do Modal
window.filtrarModal = () => {
    const dataFiltro = document.getElementById('filtroDataModal').value; // YYYY-MM-DD
    const busca = document.getElementById('buscaTextoModal').value.toUpperCase();
    
    let dataFormatada = "";
    if(dataFiltro) {
        const [ano, mes, dia] = dataFiltro.split('-');
        dataFormatada = `${dia}/${mes}/${ano}`;
    }

    document.querySelectorAll('.linha-modal').forEach(tr => {
        const dataTr = tr.getAttribute('data-data');
        const txtTr = tr.getAttribute('data-txt').toUpperCase();
        
        const bateData = dataFormatada === "" || dataTr === dataFormatada;
        const bateTexto = busca === "" || txtTr.includes(busca);

        tr.style.display = (bateData && bateTexto) ? '' : 'none';
    });
};

// 5. Ações de Puxar Dados
window.puxarSelecionados = async () => {
    const checks = document.querySelectorAll('.check-item:checked');
    if(checks.length === 0) return alert("Selecione ao menos uma agenda!");

    for(let cb of checks) {
        const id = cb.value;
        const senha = cb.getAttribute('data-senha');
        
        await updateDoc(doc(db, "agendamentos", id), { noPainel: true });
        
        // Log de Histórico
        await addDoc(collection(db, "historico"), {
            usuario: usuarioLogin,
            acao: "ADICIONADO AO PAINEL",
            senha: senha,
            dataHora: serverTimestamp()
        });
    }
    fecharModais();
};

window.atualizarCampo = async (id, campo, valor) => {
    await updateDoc(doc(db, "agendamentos", id), { [campo]: valor.toUpperCase() });
};

window.removerDoPainel = async (id) => {
    if(confirm("Deseja ocultar esta agenda do painel?")) {
        await updateDoc(doc(db, "agendamentos", id), { noPainel: false });
    }
};

window.fecharModais = () => document.getElementById('modalSelecao').style.display = 'none';
window.toggleAllModal = () => {
    const status = document.getElementById('selectAll').checked;
    document.querySelectorAll('.check-item').forEach(c => c.checked = status);
};
window.logout = () => { localStorage.clear(); window.location.href = "index.html"; };

import { app } from './firebase-config.js';
import { 
    getFirestore, collection, query, onSnapshot, doc, updateDoc, orderBy, addDoc, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const db = getFirestore(app);
const usuarioLogin = localStorage.getItem('username') || "SISTEMA";
let todasAgendasDoBanco = [];

// Lista de situações para o Select
const listaSituacoes = [
    "PENDENTE",
    "CARGA RECEBIDA",
    "NO PATIO - FICOU P/ AMANHÃ",
    "CANCELADA",
    "SOB AJUSTE",
    "NO PATIO - SOB ENCAIXE",
    "NO PATIO - FICOU DE ONTEM",
    "EM RECEBIMENTO",
    "NO PATIO",
    "EM ATRASO",
    "REAGENDA"
];

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
    const display = document.getElementById('userNameDisplay');
    if(display) display.textContent = usuarioLogin;
    ouvirDados();
});

function ouvirDados() {
    const q = query(collection(db, "agendamentos"), orderBy("data", "desc"));
    onSnapshot(q, (snapshot) => {
        todasAgendasDoBanco = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        renderizarPainelPrincipal();
    });
}

// Renderiza a tabela principal com as colunas solicitadas
function renderizarPainelPrincipal() {
    const tbody = document.getElementById('tabelaCargas');
    if(!tbody) return;

    const noPainel = todasAgendasDoBanco.filter(a => a.noPainel === true);
    
    tbody.innerHTML = noPainel.map(c => {
        // Criar o HTML das opções do Select
        const optionsSelect = listaSituacoes.map(sit => `
            <option value="${sit}" ${c.agendasituacao === sit ? 'selected' : ''}>${sit}</option>
        `).join('');

        return `
            <tr>
                <td><b>${c.senha || '-'}</b></td>
                <td>${c.data || '-'}</td>
                <td>${c.central || '-'}</td>
                <td style="font-size: 0.8rem;">${c.cargas || '-'}</td>
                <td>${c.fornecedor || '-'}</td>
                <td style="background-color: ${getCorTipo(c.tipo || '')}; font-weight: bold;">${c.tipo || '-'}</td>
                <td>
                    <select onchange="atualizarCampo('${c.id}', 'agendasituacao', this.value)" 
                            style="background:${situacoesCores[c.agendasituacao] || '#999'}; color:white; border:none; padding:5px; border-radius:4px; font-weight:bold;">
                        ${optionsSelect}
                    </select>
                </td>
                <td>
                    <input type="text" value="${c.box || ''}" placeholder="BOX"
                        onchange="atualizarCampo('${c.id}', 'box', this.value)" 
                        style="width:50px; text-align:center;">
                </td>
                <td>
                    <button onclick="removerDoPainel('${c.id}')" style="color:#D32F2F; border:none; background:none; cursor:pointer;">
                        <i class="fas fa-eye-slash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    const totalAgendas = document.getElementById('totalAgendas');
    if(totalAgendas) totalAgendas.textContent = noPainel.length;
}

// Filtro do Modal ajustado para Data Brasileira e Busca por Texto
window.filtrarModal = () => {
    const dataInput = document.getElementById('filtroDataModal').value; // Vem YYYY-MM-DD
    const buscaTexto = document.getElementById('buscaTextoModal').value.toUpperCase();
    
    let dataFormatadaBr = "";
    if(dataInput) {
        const [ano, mes, dia] = dataInput.split('-');
        dataFormatadaBr = `${dia}/${mes}/${ano}`;
    }

    document.querySelectorAll('.linha-modal').forEach(tr => {
        const dataNaTabela = tr.getAttribute('data-data'); // Esperado DD/MM/YYYY
        const textoNaTabela = tr.getAttribute('data-txt').toUpperCase();
        
        const bateData = dataFormatadaBr === "" || dataNaTabela === dataFormatadaBr;
        const bateTexto = buscaTexto === "" || textoNaTabela.includes(buscaTexto);

        tr.style.display = (bateData && bateTexto) ? '' : 'none';
    });
};

// Abre o modal e renderiza a lista de seleção
window.abrirModalSelecao = () => {
    const listaParaModal = todasAgendasDoBanco.filter(a => !a.noPainel);
    renderizarTabelaModal(listaParaModal);
    document.getElementById('modalSelecao').style.display = 'flex';
};

function renderizarTabelaModal(lista) {
    const tbody = document.getElementById('corpoBuscaModal');
    if(!tbody) return;

    tbody.innerHTML = lista.map(a => `
        <tr class="linha-modal" data-data="${a.data}" data-txt="${a.fornecedor} ${a.senha} ${a.cargas}">
            <td><input type="checkbox" class="check-item" value="${a.id}" data-senha="${a.senha}"></td>
            <td><b>${a.senha}</b></td>
            <td>${a.data}</td>
            <td>${a.central || '-'}</td>
            <td style="font-size:0.7rem">${a.cargas || '-'}</td>
            <td>${a.fornecedor}</td>
            <td>${a.tipo}</td>
        </tr>
    `).join('');
}

// Funções de Persistência
window.atualizarCampo = async (id, campo, valor) => {
    try {
        await updateDoc(doc(db, "agendamentos", id), { [campo]: valor.toUpperCase() });
    } catch (e) {
        console.error("Erro ao atualizar:", e);
    }
};

window.puxarSelecionados = async () => {
    const checks = document.querySelectorAll('.check-item:checked');
    if(checks.length === 0) return alert("Selecione algo!");

    for(let cb of checks) {
        const id = cb.value;
        const senha = cb.getAttribute('data-senha');
        await updateDoc(doc(db, "agendamentos", id), { noPainel: true });
        
        await addDoc(collection(db, "historico"), {
            usuario: usuarioLogin,
            acao: "ADICIONADO AO PAINEL",
            senha: senha,
            dataHora: serverTimestamp()
        });
    }
    fecharModais();
};

function getCorTipo(tp) {
    const t = tp.toUpperCase();
    if (['ROUPEIRO', 'ARMARIO', 'COZINHA', 'PAINEL', 'MODULO', 'MULTIUSO', 'BALCAO', 'COMODA'].some(x => t.includes(x))) return '#FFFF00';
    if (['CELULAR', 'TABLET', 'RELOGIO', 'ROBO', 'NOTEBOOK'].some(x => t.includes(x))) return '#00BFFF';
    if (t.includes('MESA')) return '#4CAF50';
    return 'transparent';
}

window.removerDoPainel = async (id) => {
    if(confirm("Remover do painel?")) {
        await updateDoc(doc(db, "agendamentos", id), { noPainel: false });
    }
};

window.fecharModais = () => document.getElementById('modalSelecao').style.display = 'none';
window.toggleAllModal = () => {
    const status = document.getElementById('selectAll').checked;
    document.querySelectorAll('.check-item').forEach(c => {
        if(c.closest('tr').style.display !== 'none') c.checked = status;
    });
};

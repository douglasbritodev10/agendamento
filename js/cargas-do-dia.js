import { app } from './firebase-config.js';
import { 
    getFirestore, collection, query, onSnapshot, doc, updateDoc, orderBy, addDoc, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const db = getFirestore(app);
const usuarioLogin = localStorage.getItem('username') || "SISTEMA";
let todasAgendasDoBanco = [];

const situacoesCores = {
    "CARGA RECEBIDA": '#4CAF50', "NO PATIO - FICOU P/ AMANHÃ": '#3ACFB9', "CANCELADA": '#7a002b',
    "SOB AJUSTE": '#8B27F5', "NO PATIO - SOB ENCAIXE": '#ff7625', "NO PATIO - FICOU DE ONTEM": '#B249BF',
    "EM RECEBIMENTO": '#FFC107', "NO PATIO": '#03A9F4', "EM ATRASO": '#F44336', "REAGENDA": '#9B591B'
};

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('userNameDisplay').textContent = usuarioLogin;
    ouvirDados();
});

function ouvirDados() {
    const q = query(collection(db, "agendamentos"), orderBy("data", "desc"));
    onSnapshot(q, (snapshot) => {
        todasAgendasDoBanco = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        renderizarPainelPrincipal();
    });
}

function getCorTipo(tp) {
    const t = (tp || "").toUpperCase();
    if (['ROUPEIRO', 'ARMARIO', 'COZINHA', 'PAINEL', 'MODULO', 'MULTIUSO', 'BALCAO', 'COMODA'].some(x => t.includes(x))) return '#FFFF00';
    if (['CELULAR', 'TABLET', 'RELOGIO', 'ROBO', 'NOTEBOOK'].some(x => t.includes(x))) return '#00BFFF';
    if (t.includes('MESA')) return '#4CAF50';
    return 'transparent';
}

function renderizarPainelPrincipal() {
    const tbody = document.getElementById('tabelaCargas');
    const noPainel = todasAgendasDoBanco.filter(a => a.noPainel === true);
    
    tbody.innerHTML = noPainel.map(c => {
        const options = Object.keys(situacoesCores).map(s => 
            `<option value="${s}" ${c.agendasituacao === s ? 'selected' : ''}>${s}</option>`).join('');

        return `
            <tr>
                <td><b>${c.senhaAgendamento || ''}</b></td>
                <td>${c.data || ''}</td>
                <td>${c.central || ''}</td>
                <td style="font-size:10px; max-width:150px;">${c.cargas || ''}</td>
                <td>
                    <select onchange="atualizarCampo('${c.id}', 'agendasituacao', this.value)" 
                        style="background:${situacoesCores[c.agendasituacao] || '#999'}; color:white; border:none; padding:5px; border-radius:4px; font-weight:bold; width:100%;">
                        <option value="">PENDENTE</option>${options}
                    </select>
                </td>
                <td>${c.fornecedor || ''}</td>
                <td style="background-color:${getCorTipo(c.tipoProduto)}; font-weight:bold;">${c.tipo || ''}</td>
                <td><input type="text" value="${c.box || ''}" onchange="atualizarCampo('${c.id}', 'box', this.value)" style="width:50px; text-align:center;"></td>
<td>
    <div style="display: flex; gap: 10px; align-items: center;">
        <button onclick="abrirModalAcerto('${c.id}', '${c.senhaAgendamento}', '${c.equipe || ''}', '${c.valorDescarga || ''}')" 
            style="color:#1976D2; border:none; background:none; cursor:pointer; font-size: 1.2rem;" title="Acerto de Equipe">
            <i class="fas fa-users-cog"></i>
        </button>

        <button onclick="removerDoPainel('${c.id}')" 
            style="color:red; border:none; background:none; cursor:pointer; font-size: 1.2rem;" title="Remover do Painel">
            <i class="fas fa-eye-slash"></i>
        </button>
    </div>
</td>
    }).join('');

    document.getElementById('totalAgendas').textContent = noPainel.length;
    document.getElementById('totalVeiculos').textContent = new Set(noPainel.map(p => p.senha)).size;
}

window.filtrarModal = () => {
    const dataFiltro = document.getElementById('filtroDataModal').value;
    const busca = document.getElementById('buscaTextoModal').value.toUpperCase();
    let dataBR = dataFiltro ? dataFiltro.split('-').reverse().join('/') : "";

    document.querySelectorAll('.linha-modal').forEach(tr => {
        const bateData = dataBR === "" || tr.getAttribute('data-data') === dataBR;
        const bateTexto = busca === "" || tr.getAttribute('data-txt').toUpperCase().includes(busca);
        tr.style.display = (bateData && bateTexto) ? '' : 'none';
    });
};

window.abrirModalSelecao = () => {
    const lista = todasAgendasDoBanco.filter(a => !a.noPainel);
    document.getElementById('corpoBuscaModal').innerHTML = lista.map(a => `
        <tr class="linha-modal" data-data="${a.data}" data-txt="${a.senha} ${a.fornecedor}">
            <td><input type="checkbox" class="check-item" value="${a.id}" data-senha="${a.senha}"></td>
            <td><b>${a.senhaAgendamento}</b></td>
            <td>${a.data}</td>
            <td style="font-size:10px;">${a.cargas || ''}</td>
            <td>${a.agendasituacao || 'PENDENTE'}</td>
            <td>${a.fornecedor}</td>
            <td>${a.tipoProduto}</td>
        </tr>`).join('');
    document.getElementById('modalSelecao').style.display = 'flex';
};

window.atualizarCampo = async (id, campo, valor) => {
    await updateDoc(doc(db, "agendamentos", id), { [campo]: valor.toUpperCase() });
};

window.puxarSelecionados = async () => {
    const checks = document.querySelectorAll('.check-item:checked');
    for(let cb of checks) {
        await updateDoc(doc(db, "agendamentos", cb.value), { noPainel: true });
        await addDoc(collection(db, "historico"), { usuario: usuarioLogin, acao: "ADICIONADO AO PAINEL", senha: cb.dataset.senha, dataHora: serverTimestamp() });
    }
    fecharModais();
};

window.abrirModalAcerto = (id, senha, equipe, valor) => {
    document.getElementById('acertoId').value = id;
    document.getElementById('acertoSenha').value = senha;
    document.getElementById('campoEquipe').value = equipe;
    document.getElementById('campoValor').value = valor;
    document.getElementById('modalAcerto').style.display = 'flex';
};

window.salvarAcerto = async () => {
    const id = document.getElementById('acertoId').value;
    const senha = document.getElementById('acertoSenha').value;
    const equipe = document.getElementById('campoEquipe').value.toUpperCase();
    const valor = document.getElementById('campoValor').value;

    try {
        // 1. Atualiza o agendamento
        await updateDoc(doc(db, "agendamentos", id), {
            equipe: equipe,
            valorDescarga: valor
        });

        // 2. Registra no histórico (conforme solicitado)
        await addDoc(collection(db, "historico"), {
            usuario: usuarioLogin,
            acao: "VINCULOU EQUIPE/VALOR",
            detalhe: `Equipe: ${equipe} | Valor: R$ ${valor}`,
            senha: senha,
            dataHora: serverTimestamp()
        });

        fecharModais();
        alert("Acerto salvo com sucesso!");
    } catch (error) {
        console.error("Erro ao salvar acerto:", error);
        alert("Erro ao salvar.");
    }
};

// Ajuste na sua função de fechar modais para incluir o novo
window.fecharModais = () => {
    document.getElementById('modalSelecao').style.display = 'none';
    document.getElementById('modalAcerto').style.display = 'none';
};

window.removerDoPainel = async (id) => { if(confirm("Remover do painel?")) await updateDoc(doc(db, "agendamentos", id), { noPainel: false }); };
window.fecharModais = () => document.getElementById('modalSelecao').style.display = 'none';
window.toggleAllModal = () => { const s = document.getElementById('selectAll').checked; document.querySelectorAll('.check-item').forEach(c => c.checked = s); };
window.logout = () => { localStorage.clear(); window.location.href = "index.html"; };

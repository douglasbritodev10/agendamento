import { app } from './firebase-config.js';
import { 
    getFirestore, collection, query, onSnapshot, doc, updateDoc, orderBy, addDoc, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const db = getFirestore(app);
const usuarioLogin = localStorage.getItem('username') || "SISTEMA";
let todasAgendasDoBanco = [];

// Mapeamento de cores para Situação/Status
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
    // Exibe o nome do usuário logado
    const display = document.getElementById('userNameDisplay');
    if(display) display.textContent = usuarioLogin;
    
    ouvirDados();
});

// 1. Ouvir dados do Firebase em Tempo Real
function ouvirDados() {
    const q = query(collection(db, "agendamentos"), orderBy("data", "desc"));
    onSnapshot(q, (snapshot) => {
        todasAgendasDoBanco = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        renderizarPainelPrincipal();
    });
}

// 2. Renderizar Painel Principal (Cargas com noPainel === true)
function renderizarPainelPrincipal() {
    const tbody = document.getElementById('tabelaCargas');
    if(!tbody) return;

    const noPainel = todasAgendasDoBanco.filter(a => a.noPainel === true);
    
    tbody.innerHTML = noPainel.map(c => `
        <tr>
            <td><b>${c.senha}</b><br><small>${c.data}</small></td>
            <td>
                <span class="status-badge" style="background:${situacoesCores[c.agendasituacao] || '#999'}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: bold;">
                    ${c.agendasituacao || 'PENDENTE'}
                </span>
            </td>
            <td>${c.central || '-'}</td>
            <td>${c.fornecedor || '-'}</td>
            <td style="background-color: ${getCorTipo(c.tipo || '')}; font-weight: bold;">${c.tipo || '-'}</td>
            <td>
                <input type="text" value="${c.box || ''}" 
                    onchange="atualizarCampo('${c.id}', 'box', this.value)" 
                    style="width:60px; text-align:center; border: 1px solid #ccc; border-radius: 4px;">
            </td>
            <td>
                <button onclick="removerDoPainel('${c.id}')" style="color:#D32F2F; border:none; background:none; cursor:pointer; font-size: 1.1rem;">
                    <i class="fas fa-eye-slash"></i>
                </button>
            </td>
        </tr>
    `).join('');

    // Atualiza os contadores do Dashboard
    const totalAgendas = document.getElementById('totalAgendas');
    const totalVeiculos = document.getElementById('totalVeiculos');
    
    if(totalAgendas) totalAgendas.textContent = noPainel.length;
    if(totalVeiculos) totalVeiculos.textContent = new Set(noPainel.map(p => p.senha)).size;
}

// 3. Lógica do Modal com Ordenação Inteligente (Amanhã primeiro)
window.abrirModalSelecao = () => {
    const hoje = new Date();
    const amanha = new Date(hoje);
    amanha.setDate(hoje.getDate() + 1);
    
    // Formata amanhã para o padrão brasileiro DD/MM/YYYY
    const amanhaFormatado = `${String(amanha.getDate()).padStart(2, '0')}/${String(amanha.getMonth() + 1).padStart(2, '0')}/${amanha.getFullYear()}`;

    // Filtra quem não está no painel e ordena
    const listaParaModal = todasAgendasDoBanco.filter(a => !a.noPainel).sort((a, b) => {
        if (a.data === amanhaFormatado && b.data !== amanhaFormatado) return -1;
        if (a.data !== amanhaFormatado && b.data === amanhaFormatado) return 1;
        return 0;
    });

    renderizarTabelaModal(listaParaModal);
    document.getElementById('modalSelecao').style.display = 'flex';
};

// 4. Lógica de Cores por Tipo de Produto
function getCorTipo(tp) {
    const t = tp.toUpperCase();
    if (['ROUPEIRO', 'ARMARIO', 'COZINHA', 'PAINEL', 'MODULO', 'MULTIUSO', 'BALCAO', 'COMODA'].some(x => t.includes(x))) return '#FFFF00'; // Amarelo
    if (['CELULAR', 'TABLET', 'RELOGIO', 'ROBO', 'NOTEBOOK'].some(x => t.includes(x))) return '#00BFFF'; // Azul
    if (t.includes('MESA')) return '#4CAF50'; // Verde
    return 'transparent';
}

function renderizarTabelaModal(lista) {
    const tbody = document.getElementById('corpoBuscaModal');
    if(!tbody) return;

    tbody.innerHTML = lista.map(a => `
        <tr class="linha-modal" data-data="${a.data}" data-txt="${a.fornecedor} ${a.senha}">
            <td><input type="checkbox" class="check-item" value="${a.id}" data-senha="${a.senha}"></td>
            <td><b>${a.senha}</b></td>
            <td>${a.data}</td>
            <td style="font-size:0.7rem; max-width: 150px; overflow: hidden; text-overflow: ellipsis;">${a.cargas || '-'}</td>
            <td>${a.agendasituacao || 'PENDENTE'}</td>
            <td>${a.fornecedor || '-'}</td>
            <td style="background-color: ${getCorTipo(a.tipo || '')}">${a.tipo || '-'}</td>
            <td>${a.box || ''}</td>
        </tr>
    `).join('');
}

// 5. Filtros Dinâmicos do Modal
window.filtrarModal = () => {
    const dataFiltro = document.getElementById('filtroDataModal').value; // Formato HTML: YYYY-MM-DD
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

// 6. Ações de Banco de Dados
window.puxarSelecionados = async () => {
    const checks = document.querySelectorAll('.check-item:checked');
    if(checks.length === 0) return alert("Selecione ao menos uma agenda!");

    const promessas = Array.from(checks).map(async (cb) => {
        const id = cb.value;
        const senha = cb.getAttribute('data-senha');
        
        // Ativa no painel
        await updateDoc(doc(db, "agendamentos", id), { noPainel: true });
        
        // Registra no histórico
        return addDoc(collection(db, "historico"), {
            usuario: usuarioLogin,
            acao: "ADICIONADO AO PAINEL",
            senha: senha,
            dataHora: serverTimestamp()
        });
    });

    try {
        await Promise.all(promessas);
        fecharModais();
    } catch (error) {
        console.error("Erro ao processar seleção:", error);
        alert("Erro ao salvar dados.");
    }
};

window.atualizarCampo = async (id, campo, valor) => {
    try {
        await updateDoc(doc(db, "agendamentos", id), { [campo]: valor.toUpperCase() });
    } catch (error) {
        console.error("Erro ao atualizar campo:", error);
    }
};

window.removerDoPainel = async (id) => {
    if(confirm("Deseja ocultar esta agenda do painel?")) {
        try {
            await updateDoc(doc(db, "agendamentos", id), { noPainel: false });
        } catch (error) {
            console.error("Erro ao remover do painel:", error);
        }
    }
};

// 7. Funções de Interface e Logout
window.fecharModais = () => {
    document.getElementById('modalSelecao').style.display = 'none';
};

window.toggleAllModal = () => {
    const selectAll = document.getElementById('selectAll');
    if(!selectAll) return;
    const status = selectAll.checked;
    document.querySelectorAll('.check-item').forEach(c => {
        // Só marca os que estão visíveis pelo filtro
        if(c.closest('tr').style.display !== 'none') {
            c.checked = status;
        }
    });
};

window.logout = () => { 
    localStorage.clear(); 
    window.location.href = "index.html"; 
};

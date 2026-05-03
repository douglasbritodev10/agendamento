import { app } from './firebase-config.js';
import { getFirestore, collection, query, where, onSnapshot, doc, updateDoc } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const db = getFirestore(app);

// CORREÇÃO DAS CHAVES (Baseado no seu auth.js)
const usuarioNome = localStorage.getItem('usuarioNome') || "D. BRITO";
const nivelAcesso = localStorage.getItem('nivelAcesso'); // ADM, COLABORADOR, etc.
const usernameAtivo = localStorage.getItem('username');

let dadosMestres = [];
let dadosFiltrados = [];
let filtrosAtivos = { 
    senhaAgendamento: [], data: [], central: [], fornecedor: [], 
    tipoProduto: [], notaFiscal: [], cte: [], situacao: [] 
};
let colunaFiltroAtual = "";

// --- 1. PROTEÇÃO E INICIALIZAÇÃO ---
function init() {
    // Se não tiver username, manda pro login
    if (!usernameAtivo) {
        window.location.href = 'index.html';
        return;
    }

    document.getElementById('txtUser').innerText = usuarioNome;

    // Busca apenas agendamentos com status "Agendado"
    const q = query(collection(db, "agendamentos"), where("status", "==", "Agendado"));
    
    onSnapshot(q, (snapshot) => {
        dadosMestres = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        window.atualizarFiltros();
    });
}

// --- 2. LOGICA DE FILTROS (IGUAL MONITORAMENTO) ---
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
                btn.style.fontWeight = 'bold';
            } else {
                btn.innerText = 'FILTRO';
                btn.style = "";
            }
        }
    });
}

// --- 3. RENDERIZAÇÃO E CORES (DO SEU PRINT) ---
function renderizarTabela() {
    const tbody = document.getElementById('corpoTabela');
    tbody.innerHTML = "";

    dadosFiltrados.forEach(item => {
        const tr = document.createElement('tr');
        const classeSit = getClasseSituacao(item.situacao || 'OC PENDENTE');
        
        tr.innerHTML = `
            <td><input type="checkbox" class="row-check" value="${item.id}"></td>
            <td style="font-weight:bold">${item.senhaAgendamento || '---'}</td>
            <td>${item.data ? item.data.split('-').reverse().join('/') : '---'}</td>
            <td>${item.central || '---'}</td>
            <td>${item.fornecedor || '---'}</td>
            <td>${item.tipoProduto || '---'}</td>
            <td>${item.notaFiscal || '---'}</td>
            <td>${item.cte || '---'}</td>
            <td><span class="badge-situacao ${classeSit}">${item.situacao || 'OC PENDENTE'}</span></td>
            <td>
                <button onclick="abrirEdicao('${item.id}')" style="background:none; border:none; cursor:pointer; color:var(--primary)">
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

// --- 4. BLOQUEIO E EDIÇÃO ---
window.abrirEdicao = async (id) => {
    // Verifica nível de acesso
    if (nivelAcesso === 'LEITOR') {
        alert("Seu nível de acesso permite apenas visualização.");
        return;
    }

    const item = dadosMestres.find(d => d.id === id);
    
    // Trava de segurança (Lock)
    if (item.editandoPor && item.editandoPor !== usernameAtivo) {
        alert(`Bloqueado: O usuário ${item.editandoPor} está editando esta agenda agora.`);
        return;
    }

    // Marca no Firebase que você está editando
    await updateDoc(doc(db, "agendamentos", id), { editandoPor: usernameAtivo });

    document.getElementById('editId').value = id;
    document.getElementById('inputNF').value = item.notaFiscal || '';
    document.getElementById('inputCTe').value = item.cte || '';
    document.getElementById('selectSituacao').value = item.situacao || 'OC PENDENTE';
    document.getElementById('modalEdicao').style.display = 'flex';
};

window.cancelarEdicao = async () => {
    const id = document.getElementById('editId').value;
    if (id) await updateDoc(doc(db, "agendamentos", id), { editandoPor: null });
    fecharModais();
};

window.salvarAlteracoes = async () => {
    const id = document.getElementById('editId').value;
    const btn = document.getElementById('btnSalvar');
    
    btn.innerText = "SALVANDO...";
    btn.disabled = true;

    try {
        await updateDoc(doc(db, "agendamentos", id), {
            notaFiscal: document.getElementById('inputNF').value,
            cte: document.getElementById('inputCTe').value,
            situacao: document.getElementById('selectSituacao').value,
            editandoPor: null, // Libera a trava
            ultimaEdicao: new Date().toISOString()
        });
        fecharModais();
    } catch (e) {
        alert("Erro ao salvar dados.");
    } finally {
        btn.innerText = "SALVAR DADOS";
        btn.disabled = false;
    }
};

// --- FILTROS (REAPROVEITADO DO MONITORAMENTO) ---
window.abrirFiltro = (coluna, event) => {
    event.stopPropagation();
    colunaFiltroAtual = coluna;
    const container = document.getElementById('opcoesFiltro');
    const valoresUnicos = [...new Set(dadosMestres.map(d => String(d[coluna] || "")))].sort();

    container.innerHTML = valoresUnicos.map(val => `
        <label style="display:block; margin:5px 0; cursor:pointer">
            <input type="checkbox" class="chk-filtro" value="${val}" ${filtrosAtivos[coluna].includes(val) ? 'checked' : ''}> ${val}
        </label>
    `).join('');
    document.getElementById('modalFiltro').style.display = 'flex';
};

window.aplicarFiltroColuna = () => {
    const selecionados = Array.from(document.querySelectorAll('.chk-filtro:checked')).map(c => c.value);
    filtrosAtivos[colunaFiltroAtual] = selecionados;
    window.atualizarFiltros();
    fecharModais();
};

window.fecharModais = () => { document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none'); };
window.marcarTodos = (el) => { document.querySelectorAll('.row-check').forEach(c => c.checked = el.checked); };

init();

import { app } from './firebase-config.js';
import { 
    getFirestore, doc, setDoc, collection, addDoc, onSnapshot, query, orderBy, deleteDoc, getDocs, where 
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const db = getFirestore(app);

// --- CONFIGURAÇÃO INICIAL ---
const userLogado = "DBRITO"; //
const inputSenha = document.getElementById('senhaAgendamento');

const gerarSenha = () => {
    const random = Math.floor(1000 + Math.random() * 9000);
    const data = new Date();
    return `SIM-${data.getFullYear()}${String(data.getMonth() + 1).padStart(2, '0')}-${random}`;
};

if (inputSenha) inputSenha.value = gerarSenha();

// --- LÓGICA DE CORES (CONFORME SOLICITADO) ---
function aplicarCoresTipo(tipo) {
    const tp = (tipo || "").toUpperCase();
    // Regras de cores baseadas no tipo de produto
    if (['ROUPEIRO', 'ARMARIO', 'COZINHA', 'PAINEL', 'MODULO', 'MULTIUSO', 'BALCAO', 'COMODA'].some(x => tp.includes(x))) return '#FFFF00'; // Amarelo
    if (['CELULAR', 'TABLET', 'RELOGIO', 'ROBO', 'NOTEBOOK'].some(x => tp.includes(x))) return '#00BFFF'; // Azul
    if (tp.includes('MESA')) return '#4CAF50'; // Verde
    return 'transparent';
}

// --- GERENCIAMENTO DE ITENS ---
window.addLinhaItem = (cod = '', desc = '', qtd = '') => {
    const container = document.getElementById('listaItens');
    const div = document.createElement('div');
    div.className = 'item-row';
    div.innerHTML = `
        <input type="text" class="prod-id" placeholder="Cód" value="${cod}">
        <input type="text" class="prod-desc" placeholder="Descrição" value="${desc}">
        <input type="number" class="prod-qtd" placeholder="Qtd" value="${qtd}">
        <button type="button" class="btn-del" onclick="this.parentElement.remove()">X</button>
    `;
    container.appendChild(div);
};

// --- FUNÇÃO SALVAR (RASCUNHO OU DEFINITIVO) ---
async function processarAgendamento(statusFinal) {
    const senha = inputSenha.value;
    const btn = document.getElementById('btnFinalizar');
    
    const dados = {
        senhaAgendamento: senha,
        data: document.getElementById('dataCarga').value,
        central: document.getElementById('central').value,
        fornecedor: document.getElementById('fornecedorSelect').value,
        cargaTransporte: document.getElementById('cargaTransporte').value,
        pedidoCompra: document.getElementById('pedidoCompra').value,
        tipoProduto: document.getElementById('tipoProduto').value.toUpperCase(),
        status: statusFinal, // "Rascunho" ou "Agendada"
        criadoPor: userLogado,
        timestamp: new Date().getTime()
    };

    if (!dados.data || !dados.fornecedor) return alert("Preencha Data e Fornecedor!");

    try {
        btn.disabled = true;
        // 1. Salva Cabeçalho
        await setDoc(doc(db, "agendamentos", senha), dados);

        // 2. Salva Itens (Limpa antes se for edição)
        const itensExistentes = await getDocs(query(collection(db, "itens_agenda"), where("senhaAgendamento", "==", senha)));
        for (const d of itensExistentes.docs) await deleteDoc(doc(db, "itens_agenda", d.id));

        const linhas = document.querySelectorAll('.item-row');
        for (const linha of linhas) {
            const cod = linha.querySelector('.prod-id').value;
            const desc = linha.querySelector('.prod-desc').value;
            const qtd = linha.querySelector('.prod-qtd').value;
            if (cod && desc) {
                await addDoc(collection(db, "itens_agenda"), { senhaAgendamento: senha, codigo: cod, descricao: desc, quantidade: qtd });
            }
        }

        alert(`Sucesso! Salvo como ${statusFinal}`);
        location.reload();
    } catch (e) { alert("Erro ao salvar!"); btn.disabled = false; }
}

document.getElementById('btnRascunho').onclick = () => processarAgendamento("Rascunho");
document.getElementById('btnFinalizar').onclick = () => processarAgendamento("Agendada");

// --- RENDERIZAR TABELA COM MONITORAMENTO ---
function carregarMonitor() {
    const q = query(collection(db, "agendamentos"), orderBy("timestamp", "desc"));
    onSnapshot(q, (snap) => {
        const corpo = document.getElementById('corpoTabela');
        corpo.innerHTML = "";
        snap.forEach(d => {
            const ag = d.data();
            const corBack = aplicarCoresTipo(ag.tipoProduto);
            corpo.innerHTML += `
                <tr style="${ag.status === 'Rascunho' ? 'opacity: 0.6' : ''}">
                    <td><b>${ag.senhaAgendamento}</b></td>
                    <td>${ag.data.split('-').reverse().join('/')}</td>
                    <td>${ag.central}</td>
                    <td>${ag.fornecedor}</td>
                    <td>${ag.cargaTransporte}</td>
                    <td style="background-color: ${corBack}; font-weight: bold;">${ag.tipoProduto}</td>
                    <td>
                        <button onclick="verComposicao('${ag.senhaAgendamento}')">📦</button>
                    </td>
                </tr>`;
        });
    });
}

// Inicialização
window.addEventListener('DOMContentLoaded', () => {
    addLinhaItem(); // Linha vazia inicial
    carregarMonitor();
});

// Funções de Modal Globais
window.abrirModalFornecedor = () => document.getElementById('modalFornecedor').style.display = 'flex';
window.fecharModais = () => document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');

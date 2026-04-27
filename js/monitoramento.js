import { app } from './firebase-config.js';
import { getFirestore, collection, query, where, onSnapshot, orderBy } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const db = getFirestore(app);

// Configurações Globais
let dadosOriginais = [];
let dadosFiltrados = [];
let colunaAtual = "";
let filtrosAtivos = {
    senhaAgendamento: [],
    data: [],
    central: [],
    cargas: [],
    fornecedor: [],
    tipoProduto: []
};

// 1. Pegar Data de Hoje (Brasil)
const d = new Date();
const hojeISO = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

// 2. Escuta do Firebase em Tempo Real
function inicializar() {
    const q = query(
        collection(db, "agendamentos"), 
        where("data", "==", hojeISO),
        orderBy("timestamp", "desc")
    );

    onSnapshot(q, (snap) => {
        dadosOriginais = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        aplicarLogicaDeFiltros(); // Re-aplica filtros se os dados mudarem
    });
}

// 3. Funções do Modal
window.abrirModalFiltro = (coluna) => {
    colunaAtual = coluna;
    document.getElementById('tituloFiltro').innerText = `Filtrar ${coluna.toUpperCase()}`;
    document.getElementById('modalFiltro').style.display = 'flex';
    document.getElementById('inputBuscaModal').value = "";
    
    // Efeito Cascata: Pegar opções únicas dos dados que já passaram pelos outros filtros
    const opcoesUnicas = [...new Set(dadosFiltrados.map(item => item[coluna] || "VAZIO"))].sort();
    
    const container = document.getElementById('listaOpcoes');
    container.innerHTML = "";

    opcoesUnicas.forEach(opcao => {
        const isChecked = filtrosAtivos[coluna].length === 0 || filtrosAtivos[coluna].includes(opcao);
        container.innerHTML += `
            <div class="opcao-item">
                <input type="checkbox" value="${opcao}" ${isChecked ? 'checked' : ''}>
                <label>${opcao}</label>
            </div>
        `;
    });
};

window.fecharModal = () => {
    document.getElementById('modalFiltro').style.display = 'none';
};

window.selecionarTodos = (status) => {
    const checkboxes = document.querySelectorAll('#listaOpcoes input');
    checkboxes.forEach(cb => cb.checked = status);
};

// 4. Execução do Filtro
window.executarFiltro = () => {
    const checkboxes = document.querySelectorAll('#listaOpcoes input:checked');
    const selecionados = Array.from(checkboxes).map(cb => cb.value);
    
    // Se todos estiverem marcados, limpamos o filtro daquela coluna (mostra tudo)
    const totalOpcoes = document.querySelectorAll('#listaOpcoes input').length;
    filtrosAtivos[colunaAtual] = selecionados.length === totalOpcoes ? [] : selecionados;

    aplicarLogicaDeFiltros();
    fecharModal();
};

function aplicarLogicaDeFiltros() {
    dadosFiltrados = dadosOriginais.filter(item => {
        return Object.keys(filtrosAtivos).every(col => {
            if (filtrosAtivos[col].length === 0) return true; // Sem filtro nesta coluna
            return filtrosAtivos[col].includes(item[col] || "VAZIO");
        });
    });

    renderizarTabela();
}

// 5. Renderização na Tela
function renderizarTabela() {
    const corpo = document.getElementById('tabelaCorpo');
    corpo.innerHTML = "";
    document.getElementById('txtContador').innerText = dadosFiltrados.length;

    if (dadosFiltrados.length === 0) {
        corpo.innerHTML = `<tr><td colspan="7">Nenhum agendamento encontrado para hoje.</td></tr>`;
        return;
    }

    dadosFiltrados.forEach(ag => {
        const dataFormatada = ag.data ? ag.data.split('-').reverse().join('/') : '---';
        
        corpo.innerHTML += `
            <tr>
                <td style="font-weight:bold; color:var(--primary)">${ag.senhaAgendamento}</td>
                <td>${dataFormatada}</td>
                <td>${ag.central}</td>
                <td>${ag.cargas || '1 CARRETA'}</td>
                <td>${ag.fornecedor}</td>
                <td>${ag.tipoProduto}</td>
                <td>
                    <button onclick="verComposicao('${ag.id}')" title="Ver Composição" style="border:none; background:none; cursor:pointer; color:#555">
                        <i class="fas fa-search-plus"></i>
                    </button>
                </td>
            </tr>
        `;
    });
}

// 6. Busca interna do Modal
window.filtrarListaModal = () => {
    const termo = document.getElementById('inputBuscaModal').value.toLowerCase();
    const itens = document.querySelectorAll('.opcao-item');
    itens.forEach(item => {
        const texto = item.innerText.toLowerCase();
        item.style.display = texto.includes(termo) ? 'flex' : 'none';
    });
};

// Função de placeholder para composição
window.verComposicao = (id) => {
    alert("Visualizando composição da carga ID: " + id);
};

// Início
inicializar();

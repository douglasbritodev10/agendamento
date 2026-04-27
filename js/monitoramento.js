import { app } from './firebase-config.js';
import { getFirestore, collection, query, where, onSnapshot, getDoc, doc } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const db = getFirestore(app);

let dadosOriginais = []; // Todas as cargas da data (exceto rascunhos)
let dadosExibidos = [];   // Cargas após filtros de coluna e busca global
let dataFiltroAtiva = "";

// 1. Inicialização
async function iniciar() {
    // Exibe o username no topo (DBRITO)
    document.getElementById('user-display').innerText = localStorage.getItem('username') || "USUÁRIO";

    // Define data padrão como hoje (Brasil)
    const d = new Date();
    dataFiltroAtiva = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    document.getElementById('filtroDataGlobal').value = dataFiltroAtiva;

    ouvirCargas();
}

// 2. Ouvinte Firebase com Bloqueio de Rascunhos
function ouvirCargas() {
    // Buscamos apenas onde status NÃO é rascunho
    // Se você usa um campo booleano ou string, ajuste abaixo:
    const q = query(
        collection(db, "agendamentos"), 
        where("data", "==", dataFiltroAtiva)
        // Adicionaremos o filtro de rascunho na lógica local para evitar erros de índice no Firebase
    );

    onSnapshot(q, (snap) => {
        // FILTRO DE SEGURANÇA: Remove rascunhos antes de qualquer coisa
        dadosOriginais = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(item => item.status !== "Rascunho" && item.status !== "DRAFT"); 

        dadosExibidos = [...dadosOriginais];
        renderizarTabela();
    });
}

// 3. Busca Global (Igual à tela de agendamento)
window.filtrarGeral = () => {
    const termo = document.getElementById('inputBuscaGlobal').value.toLowerCase();
    
    dadosExibidos = dadosOriginais.filter(item => {
        const conteudoParaBusca = `
            ${item.senhaAgendamento} 
            ${item.fornecedor} 
            ${item.central} 
            ${item.tipoProduto} 
            ${item.status}
            ${item.composicao ? JSON.stringify(item.composicao) : ""}
        `.toLowerCase();
        
        return conteudoParaBusca.includes(termo);
    });

    renderizarTabela();
};

// 4. Ver Composição (Modal de Itens)
window.verComposicao = async (id) => {
    const container = document.getElementById('listaComposicao');
    container.innerHTML = "Carregando itens...";
    document.getElementById('modalComposicao').style.display = 'flex';

    const agenda = dadosOriginais.find(a => a.id === id);
    if (agenda && agenda.composicao) {
        document.getElementById('spanSenhaCarga').innerText = agenda.senhaAgendamento;
        container.innerHTML = agenda.composicao.map(item => `
            <div class="card-item">
                <div>
                    <b>${item.descricao}</b><br>
                    <small>Cód: ${item.codigo || 'N/A'}</small>
                </div>
                <div style="text-align:right">
                    <span style="color:#D32F2F; font-weight:bold">${item.quantidade} UN</span>
                </div>
            </div>
        `).join('');
    } else {
        container.innerHTML = "Nenhum item detalhado nesta carga.";
    }
};

// 5. Troca de Data
window.alterarDataFiltro = () => {
    dataFiltroAtiva = document.getElementById('filtroDataGlobal').value;
    ouvirCargas(); // Reinicia a escuta para a nova data
};

// 6. Renderização
function renderizarTabela() {
    const corpo = document.getElementById('tabelaCorpo');
    corpo.innerHTML = "";
    document.getElementById('txtContador').innerText = dadosExibidos.length;

    dadosExibidos.forEach(ag => {
        corpo.innerHTML += `
            <tr>
                <td style="font-weight:bold">${ag.senhaAgendamento}</td>
                <td>${ag.data.split('-').reverse().join('/')}</td>
                <td>${ag.central}</td>
                <td>${ag.cargas || '1'}</td>
                <td>${ag.fornecedor}</td>
                <td>${ag.tipoProduto}</td>
                <td>
                    <button onclick="verComposicao('${ag.id}')" class="btn-abrir-filtro" style="width:auto; padding:5px 10px">
                        <i class="fas fa-list"></i> ITENS
                    </button>
                </td>
            </tr>
        `;
    });
}

window.fecharModalComposicao = () => document.getElementById('modalComposicao').style.display = 'none';

iniciar();

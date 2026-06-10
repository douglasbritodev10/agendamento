import { app } from './firebase-config.js';
import { 
    getFirestore, collection, onSnapshot, query, orderBy 
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";

const db = getFirestore(app);
const auth = getAuth(app);

// --- ESTADOS GLOBAIS ---
let todosLogsMestres = [];
let logsFiltrados = [];

// Paginação
let paginaAtual = 1;
const registrosPorPagina = 25; // Exibe 25 logs por folha para não sobrecarregar a tela

// --- 1. VERIFICAÇÃO DE USUÁRIO E ACESSO ---
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = "index.html";
        return;
    }

    // Carrega identificações da sessão padrão estabelecidas no seu auth.js
    const username = localStorage.getItem('username') || "USUÁRIO";
    const displayElement = document.getElementById('userNameDisplay');
    if (displayElement) {
        displayElement.innerText = username.toUpperCase();
    }

    // Inicia a escuta ativa da coleção de histórico
    escutarColecaoHistorico();
});

// --- 2. LEITURA EM TEMPO REAL DO FIRESTORE ---
function escutarColecaoHistorico() {
    const colRef = collection(db, "historico");
    // Ordena trazendo os eventos mais recentes primeiro (descendente)
    const q = query(colRef, orderBy("dataHora", "desc"));

    onSnapshot(q, (snapshot) => {
        todosLogsMestres = [];
        
        snapshot.forEach((docSnap) => {
            const dados = docSnap.data();
            todosLogsMestres.push({
                id: docSnap.id,
                ...dados
            });
        });

        // Inicialmente, os dados filtrados recebem a carga inteira do banco
        aplicarFiltros();
    }, (error) => {
        console.error("Erro ao escutar histórico: ", error);
        const tbody = document.getElementById('corpoHistorico');
        if(tbody) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#D32F2F; font-weight:bold;">Erro ao carregar dados do Firebase. Verifique suas regras de acesso.</td></tr>`;
        }
    });
}

// --- 3. LÓGICA DE FILTRAGEM (PERÍODO E BUSCA GERAL) ---
window.aplicarFiltros = function() {
    const termoBusca = document.getElementById('inputBuscaGeral').value.toLowerCase().trim();
    const dtInicialStr = document.getElementById('dataInicial').value; // Retorna YYYY-MM-DD
    const dtFinalStr = document.getElementById('dataFinal').value;     // Retorna YYYY-MM-DD

    logsFiltrados = todosLogsMestres.filter(log => {
        // A) Filtro de Busca Geral por Texto
        const usuario = (log.usuario || "").toLowerCase();
        const acao = (log.acao || "").toLowerCase();
        const senha = (log.senha || "").toLowerCase();
        const detalhes = (log.detalhes || "").toLowerCase();

        const bateTexto = !termoBusca || 
            usuario.includes(termoBusca) || 
            acao.includes(termoBusca) || 
            senha.includes(termoBusca) ||
            detalhes.includes(termoBusca);

        // B) Filtro de Período por Data
        let bateData = true;

        if (log.dataHora) {
            // Tratamento flexível: Se for ServerTimestamp do Firebase ele possui .toDate(), se for ISOString é string
            let dataLogObjeto;
            if (typeof log.dataHora.toDate === 'function') {
                dataLogObjeto = log.dataHora.toDate();
            } else {
                dataLogObjeto = new Date(log.dataHora);
            }

            // Normaliza a data do log para string YYYY-MM-DD para comparar de forma justa
            const dataLogFormatada = dataLogObjeto.toISOString().split('T')[0];

            if (dtInicialStr && dataLogFormatada < dtInicialStr) {
                bateData = false;
            }
            if (dtFinalStr && dataLogFormatada > dtFinalStr) {
                bateData = false;
            }
        } else if (dtInicialStr || dtFinalStr) {
            // Se o documento não tiver timestamp válido mas o usuário filtrou por data, descarta
            bateData = false;
        }

        return bateTexto && bateData;
    });

    // Sempre reinicia para a primeira página após qualquer filtragem
    paginaAtual = 1;
    renderizarTabela();
};

// Limpeza rápida dos seletores de data conforme solicitado
window.limparFiltrosPeríodo = function() {
    document.getElementById('dataInicial').value = "";
    document.getElementById('dataFinal').value = "";
    aplicarFiltros();
};

// --- 4. RENDERIZAÇÃO E PAGINAÇÃO ---
function renderizarTabela() {
    const tbody = document.getElementById('corpoHistorico');
    if (!tbody) return;

    if (logsFiltrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #666; padding: 30px;">Nenhum registro encontrado para os critérios selecionados.</td></tr>`;
        atualizarControlesPaginacao(0);
        return;
    }

    // Cálculos de índices para fatiamento de página
    const indiceInicial = (paginaAtual - 1) * registrosPorPagina;
    const indiceFinal = indiceInicial + registrosPorPagina;
    const itensDaPagina = logsFiltrados.slice(indiceInicial, indiceFinal);

    let html = "";
    itensDaPagina.forEach(log => {
        // Formatação legível da Data e Hora
        let dataExibicao = "---";
        if (log.dataHora) {
            const dataObj = typeof log.dataHora.toDate === 'function' ? log.dataHora.toDate() : new Date(log.dataHora);
            dataExibicao = dataObj.toLocaleString('pt-BR');
        }

        // Determinação de estilo visual do Badge com base na palavra-chave da ação
        const acaoTexto = log.acao || "AÇÃO";
        let classeBadge = "badge-padrao";
        
        if (acaoTexto.includes("ADICIONADO") || acaoTexto.includes("SALVAR") || acaoTexto.includes("CADASTRO")) {
            classeBadge = "badge-sucesso";
        } else if (acaoTexto.includes("EXCLUIR") || acaoTexto.includes("REMOVER") || acaoTexto.includes("CANCELADO")) {
            classeBadge = "badge-perigo";
        } else if (acaoTexto.includes("ALTERACAO") || acaoTexto.includes("EDITADO") || acaoTexto.includes("AJUSTE")) {
            classeBadge = "badge-aviso";
        }

        html += `
            <tr>
                <td><i class="far fa-clock" style="color:#aaa; margin-right:5px;"></i> <b>${dataExibicao}</b></td>
                <td><i class="far fa-user" style="color:#666; margin-right:5px;"></i> ${log.usuario || "SISTEMA"}</td>
                <td><span class="badge-acao ${classeBadge}">${acaoTexto}</span></td>
                <td><code style="background:#f5f5f5; padding:3px 6px; border-radius:4px; font-weight:700; color:#c00000;">${log.senha || "N/A"}</code></td>
                <td style="color:#555; font-size:0.85rem;">${log.detalhes || log.motivo || "---"}</td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
    atualizarControlesPaginacao(logsFiltrados.length);
}

function atualizarControlesPaginacao(totalRegistros) {
    const info = document.getElementById('infoPaginacao');
    const containerBotoes = document.getElementById('botoesPaginacao');
    
    if (!info || !containerBotoes) return;

    const totalPaginas = Math.ceil(totalRegistros / registrosPorPagina);
    const inicio = totalRegistros === 0 ? 0 : (paginaAtual - 1) * registrosPorPagina + 1;
    const fim = Math.min(paginaAtual * registrosPorPagina, totalRegistros);

    info.innerText = `Exibindo ${inicio}-${fim} de ${totalRegistros} registros`;
    containerBotoes.innerHTML = "";

    // Botão Voltar Anterior
    const btnAnt = document.createElement('button');
    btnAnt.className = "btn-page";
    btnAnt.innerHTML = `<i class="fas fa-chevron-left"></i>`;
    btnAnt.disabled = paginaAtual === 1;
    btnAnt.onclick = () => { paginaAtual--; renderizarTabela(); };
    containerBotoes.appendChild(btnAnt);

    // Renderiza mapeamento das páginas próximas (até 5 botões para não quebrar o layout mobile)
    let paginaInicialVisivel = Math.max(1, paginaAtual - 2);
    let paginaFinalVisivel = Math.min(totalPaginas, paginaInicialVisivel + 4);
    
    if (paginaFinalVisivel - paginaInicialVisivel < 4) {
        paginaInicialVisivel = Math.max(1, paginaFinalVisivel - 4);
    }

    for (let i = paginaInicialVisivel; i <= paginaFinalVisivel; i++) {
        const btnNum = document.createElement('button');
        btnNum.className = `btn-page ${i === paginaAtual ? 'active' : ''}`;
        btnNum.innerText = i;
        btnNum.onclick = () => { paginaAtual = i; renderizarTabela(); };
        containerBotoes.appendChild(btnNum);
    }

    // Botão Próxima Página
    const btnProx = document.createElement('button');
    btnProx.className = "btn-page";
    btnProx.innerHTML = `<i class="fas fa-chevron-right"></i>`;
    btnProx.disabled = paginaAtual === totalPaginas || totalPaginas === 0;
    btnProx.onclick = () => { paginaAtual++; renderizarTabela(); };
    containerBotoes.appendChild(btnProx);
}

// Vincula o evento 'keyup' ao campo de busca geral para efetuar a filtragem instantânea enquanto o usuário digita
document.getElementById('inputBuscaGeral').addEventListener('keyup', () => {
    aplicarFiltros();
});

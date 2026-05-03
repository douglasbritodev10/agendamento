import { app } from './firebase-config.js';
import { getFirestore, collection, query, onSnapshot, orderBy } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const db = getFirestore(app);

// --- ESTADOS GLOBAIS ---
let dadosMestres = [];
let dadosFiltrados = [];
let filtrosAtivos = { senhaAgendamento: [], data: [], central: [], fornecedor: [], tipoProduto: [] };
let colunaFiltroAtual = "";

let paginaAtual = 1;
let registrosPorPagina = 50;
let ordenacao = { coluna: 'data', direcao: 'desc' };

// --- 1. INICIALIZAÇÃO ---
function init() {
    const userDisplay = document.getElementById('txtUser');
    if(userDisplay) userDisplay.innerText = localStorage.getItem('username') || "D. BRITO";
    
    const q = query(collection(db, "agendamentos"), orderBy("data", "desc"));
    
    onSnapshot(q, (snapshot) => {
        dadosMestres = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(item => item.status !== "Rascunho");

        // Aplica filtro de hoje apenas se não houver outros filtros
        const hoje = new Date().toISOString().split('T')[0];
        if (dadosMestres.some(d => d.data === hoje) && Object.values(filtrosAtivos).every(v => v.length === 0)) {
            filtrosAtivos.data = [hoje];
        }

        window.atualizarFiltros();
    });
}

// --- 2. LÓGICA DE FILTROS ---
window.atualizarFiltros = () => {
    const termo = document.getElementById('inputBusca')?.value.toLowerCase() || "";

    dadosFiltrados = dadosMestres.filter(item => {
        // Validação das Colunas (Filtro Inteligente)
        const atendeColunas = Object.keys(filtrosAtivos).every(col => {
            if (!filtrosAtivos[col] || filtrosAtivos[col].length === 0) return true;
            return filtrosAtivos[col].includes(String(item[col]));
        });

        // Busca Geral
        const compStr = item.composicao ? JSON.stringify(item.composicao).toLowerCase() : "";
        const atendeBusca = (JSON.stringify(item).toLowerCase() + compStr).includes(termo);

        return atendeColunas && atendeBusca;
    });

    atualizarIndicadoresVisuais();
    paginaAtual = 1;
    renderizarTabela();
};

function atualizarIndicadoresVisuais() {
    // Remove badges antigos
    document.querySelectorAll('.badge-filtro').forEach(b => b.remove());

    Object.keys(filtrosAtivos).forEach(col => {
        if (filtrosAtivos[col].length > 0) {
            const container = document.getElementById(`th-${col}`);
            if (container) {
                const badge = document.createElement('span');
                badge.className = 'badge-filtro';
                badge.innerText = 'FILTRO APLICADO';
                container.appendChild(badge);
            }
        }
    });
}

// --- 3. RENDERIZAÇÃO ---
function renderizarTabela() {
    const tbody = document.getElementById('corpoTabela');
    if(!tbody) return;

    const dadosOrdenados = [...dadosFiltrados].sort((a, b) => {
        let valA = a[ordenacao.coluna] || "";
        let valB = b[ordenacao.coluna] || "";
        return ordenacao.direcao === 'asc' 
            ? valA.toString().localeCompare(valB.toString(), undefined, {numeric: true}) 
            : valB.toString().localeCompare(valA.toString(), undefined, {numeric: true});
    });

    const inicio = (paginaAtual - 1) * registrosPorPagina;
    const dadosPaginados = dadosOrdenados.slice(inicio, inicio + registrosPorPagina);

    tbody.innerHTML = "";
    dadosPaginados.forEach(item => {
        const dataBR = item.data ? item.data.split('-').reverse().join('/') : '---';
        const tipo = (item.tipoProduto || "").toLowerCase();
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input type="checkbox" class="row-check" value="${item.id}"></td>
            <td style="font-weight:bold">${item.senhaAgendamento || '---'}</td>
            <td>${dataBR}</td>
            <td>${item.central || '---'}</td>
            <td>${item.cargas || 1}</td>
            <td>${item.fornecedor || '---'}</td>
            <td class="cell-tipo" data-tipo="${item.tipoProduto}">${item.tipoProduto || '---'}</td>
            <td>
                <button onclick="verDetalhes('${item.id}')" style="background:none; border:none; color:var(--primary); cursor:pointer;">
                    <i class="fas fa-eye fa-lg"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    atualizarControlesPaginacao();
}

// --- 4. MODAL FILTRO INTELIGENTE ---
window.abrirModalFiltro = (coluna) => {
    colunaFiltroAtual = coluna;
    document.getElementById('nomeColunaFiltro').innerText = `Filtrar: ${coluna.toUpperCase()}`;
    const container = document.getElementById('opcoesFiltro');

    // Lógica Inteligente: Vê o que restou baseado nos OUTROS filtros aplicados
    const dadosParaOpcoes = dadosMestres.filter(item => {
        return Object.keys(filtrosAtivos).every(col => {
            if (col === coluna || filtrosAtivos[col].length === 0) return true;
            return filtrosAtivos[col].includes(String(item[col]));
        });
    });

    const todosValores = [...new Set(dadosMestres.map(d => String(d[coluna] || "")))].sort();
    const valoresDisponiveis = new Set(dadosParaOpcoes.map(d => String(d[coluna] || "")));

    container.innerHTML = todosValores.map(val => {
        const isDisponivel = valoresDisponiveis.has(val);
        const isChecked = filtrosAtivos[coluna].includes(val);
        
        return `
            <div style="padding:5px 0;" class="${!isDisponivel ? 'option-disabled' : ''}">
                <label style="cursor:pointer; display:flex; align-items:center; gap:10px;">
                    <input type="checkbox" class="chk-filtro" value="${val}" ${isChecked ? 'checked' : ''}> 
                    <span>${coluna === 'data' ? val.split('-').reverse().join('/') : val}</span>
                    ${!isDisponivel ? '<small>(Sem registros p/ filtros atuais)</small>' : ''}
                </label>
            </div>
        `;
    }).join('');

    document.getElementById('modalFiltro').style.display = "flex";
};

window.marcarTodosFiltro = (status) => {
    document.querySelectorAll('.chk-filtro').forEach(chk => chk.checked = status);
};

window.aplicarFiltroColuna = () => {
    const chks = document.querySelectorAll('.chk-filtro');
    const marcados = Array.from(document.querySelectorAll('.chk-filtro:checked')).map(c => c.value);
    
    // Se marcou tudo ou nada, limpa o filtro dessa coluna
    if (marcados.length === 0 || marcados.length === chks.length) {
        filtrosAtivos[colunaFiltroAtual] = [];
    } else {
        filtrosAtivos[colunaFiltroAtual] = marcados;
    }

    window.atualizarFiltros();
    window.fecharModais();
};

// --- 5. DETALHES ---
window.verDetalhes = (id) => {
    const item = dadosMestres.find(d => d.id === id);
    if(!item) return;

    document.getElementById('tituloComp').innerText = `Detalhes: ${item.senhaAgendamento}`;
    const container = document.getElementById('detalhesItens');

    let totalQtd = 0;
    let tabela = `
        <table style="width:100%; border-collapse:collapse; min-width:600px;">
            <thead style="background:#f4f4f4;">
                <tr><th style="padding:12px;">CÓDIGO</th><th style="padding:12px;">DESCRIÇÃO</th><th style="padding:12px;">QTD</th></tr>
            </thead>
            <tbody>`;

    if(item.composicao) {
        item.composicao.forEach(prod => {
            const q = parseInt(prod.qtd || prod.quantidade || 0);
            totalQtd += q;
            tabela += `
                <tr>
                    <td style="border-bottom:1px solid #eee; padding:10px; text-align:center;">${prod.codigo}</td>
                    <td style="border-bottom:1px solid #eee; padding:10px;">${prod.descricao}</td>
                    <td style="border-bottom:1px solid #eee; padding:10px; text-align:center; font-weight:bold; color:red;">${q}</td>
                </tr>`;
        });
    }

    tabela += `
            <tr style="background:#f9f9f9; font-weight:bold;">
                <td colspan="2" style="padding:12px; text-align:right;">TOTAL:</td>
                <td style="padding:12px; text-align:center; color:red;">${totalQtd}</td>
            </tr>
        </tbody></table>`;

    container.innerHTML = tabela;
    document.getElementById('modalComposicao').style.display = "flex";
};

// --- 6. UTILITÁRIOS PAGINAÇÃO ---
function atualizarControlesPaginacao() {
    const totalPaginas = Math.ceil(dadosFiltrados.length / registrosPorPagina);
    const container = document.getElementById('botoesPagina');
    const info = document.getElementById('infoPagina');
    
    info.innerText = `Mostrando ${dadosFiltrados.length > 0 ? (paginaAtual - 1) * registrosPorPagina + 1 : 0} até ${Math.min(paginaAtual * registrosPorPagina, dadosFiltrados.length)} de ${dadosFiltrados.length}`;

    container.innerHTML = `<button class="btn-page" ${paginaAtual === 1 ? 'disabled' : ''} onclick="irParaPagina(${paginaAtual - 1})">Anterior</button>`;
    for(let i = 1; i <= totalPaginas; i++) {
        if(i === 1 || i === totalPaginas || (i >= paginaAtual - 2 && i <= paginaAtual + 2)) {
            container.innerHTML += `<button class="btn-page ${i === paginaAtual ? 'active' : ''}" onclick="irParaPagina(${i})">${i}</button>`;
        }
    }
    container.innerHTML += `<button class="btn-page" ${paginaAtual === totalPaginas ? 'disabled' : ''} onclick="irParaPagina(${paginaAtual + 1})">Próximo</button>`;
}

window.irParaPagina = (p) => { paginaAtual = p; renderizarTabela(); };
window.mudarTamanhoPagina = () => {
    registrosPorPagina = parseInt(document.getElementById('selectPageSize').value);
    paginaAtual = 1;
    renderizarTabela();
};
window.fecharModais = () => {
    document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
};
window.marcarTodos = (el) => {
    document.querySelectorAll('.row-check').forEach(chk => chk.checked = el.checked);
};

// --- 7. EXPORTAÇÕES ---
const getCoresPorTipo = (tipo) => {
    const t = (tipo || "").toUpperCase();
    if (['ARMARIO','COMODA','PAINEL','MULTIUSO','MODULO','COZINHA','ROUPEIRO'].some(x => t.includes(x))) return { rgb: [255, 255, 0], hex: 'FFFF00', text: [0, 0, 0], txtHex: '000000' };
    if (t.includes('MESA')) return { rgb: [76, 175, 80], hex: '4CAF50', text: [255, 255, 255], txtHex: 'FFFFFF' };
    if (['CELULAR','TABLET','RELOGIO','NOTEBOOK'].some(x => t.includes(x))) return { rgb: [0, 191, 255], hex: '00BFFF', text: [255, 255, 255], txtHex: 'FFFFFF' };
    return { rgb: [255, 255, 255], hex: 'FFFFFF', text: [0, 0, 0], txtHex: '000000' };
};

window.exportarPDF = async (modo) => {
    const { jsPDF } = window.jspdf;
    const docPdf = new jsPDF('p', 'mm', 'a4');
    const selecionadosIds = Array.from(document.querySelectorAll('.row-check:checked')).map(c => c.value);
    
    if (selecionadosIds.length === 0) return alert("Selecione agendamentos!");
    const agendas = dadosMestres.filter(d => selecionadosIds.includes(d.id));

    docPdf.setFillColor(192, 0, 0); docPdf.rect(0, 0, 210, 20, 'F');
    docPdf.setTextColor(255); docPdf.text("MÓVEIS SIMONETTI - LOGÍSTICA", 14, 13);
    
    let y = 30;
    agendas.forEach(ag => {
        docPdf.autoTable({
            head: [['SENHA', 'DATA', 'CENTRAL', 'FORNECEDOR', 'TIPO']],
            body: [[ag.senhaAgendamento, ag.data.split('-').reverse().join('/'), ag.central, ag.fornecedor, ag.tipoProduto]],
            startY: y,
            theme: 'grid',
            headStyles: { fillColor: [192, 0, 0] },
            didParseCell: (data) => {
                if(data.column.index === 4 && data.section === 'body') {
                    const c = getCoresPorTipo(data.cell.raw);
                    data.cell.styles.fillColor = c.rgb;
                    data.cell.styles.textColor = c.text;
                }
            }
        });
        y = docPdf.lastAutoTable.finalY;
        if(modo === 'completo' && ag.composicao) {
            docPdf.autoTable({
                head: [['CÓDIGO', 'DESCRIÇÃO', 'QTD']],
                body: ag.composicao.map(i => [i.codigo, i.descricao, i.qtd]),
                startY: y,
                styles: { fontSize: 8 }
            });
            y = docPdf.lastAutoTable.finalY + 5;
        } else { y += 5; }
        if(y > 250) { docPdf.addPage(); y = 20; }
    });
    docPdf.save(`Simonetti_${modo}.pdf`);
};

window.exportarExcel = async (modo) => {
    const selecionadosIds = Array.from(document.querySelectorAll('.row-check:checked')).map(c => c.value);
    if (selecionadosIds.length === 0) return alert("Selecione agendamentos!");

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Relatorio');
    
    const cols = [
        {header:'Senha', key:'senha', width:15},
        {header:'Data', key:'data', width:12},
        {header:'Central', key:'central', width:15},
        {header:'Fornecedor', key:'fornecedor', width:30},
        {header:'Tipo', key:'tipo', width:20}
    ];
    if(modo === 'completo') cols.push({header:'Item', key:'item', width:10}, {header:'Desc', key:'desc', width:30}, {header:'Qtd', key:'qtd', width:8});
    sheet.columns = cols;

    dadosMestres.filter(d => selecionadosIds.includes(d.id)).forEach(ag => {
        const base = {senha:ag.senhaAgendamento, data:ag.data, central:ag.central, fornecedor:ag.fornecedor, tipo:ag.tipoProduto};
        if(modo === 'completo' && ag.composicao) {
            ag.composicao.forEach(i => {
                const row = sheet.addRow({...base, item:i.codigo, desc:i.descricao, qtd:i.qtd});
                pintarLinhaExcel(row, ag.tipoProduto);
            });
        } else {
            const row = sheet.addRow(base);
            pintarLinhaExcel(row, ag.tipoProduto);
        }
    });

    function pintarLinhaExcel(row, tipo) {
        const c = getCoresPorTipo(tipo);
        const cell = row.getCell('tipo');
        cell.fill = { type: 'pattern', pattern:'solid', fgColor: {argb: 'FF' + c.hex} };
        cell.font = { color: {argb: 'FF' + c.txtHex}, bold: true };
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/octet-stream' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Simonetti_${modo}.xlsx`;
    a.click();
};

init();

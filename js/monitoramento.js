import { app } from './firebase-config.js';
import { getFirestore, collection, query, onSnapshot, orderBy } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const db = getFirestore(app);

// --- ESTADOS GLOBAIS ---
let dadosMestres = [];
let dadosFiltrados = [];
let filtrosAtivos = { senhaAgendamento: [], data: [], central: [], fornecedor: [], tipoProduto: [], cargas: [] };
let colunaFiltroAtual = "";

// Paginação e Ordenação
let paginaAtual = 1;
let registrosPorPagina = 50;
let ordenacao = { coluna: 'data', direcao: 'desc' };

// --- 1. INICIALIZAÇÃO ---
function init() {
    const userDisplay = document.getElementById('txtUser');
    if(userDisplay) userDisplay.innerText = localStorage.getItem('username') || "D. BRITO";
    
    // Query ordenada por data descendente (padrão Simonetti)
    const q = query(collection(db, "agendamentos"), orderBy("data", "desc"));
    
    onSnapshot(q, (snapshot) => {
        dadosMestres = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(item => item.status !== "Rascunho");

        // Filtro automático de hoje apenas no primeiro load
        const hoje = new Date().toISOString().split('T')[0];
        if (dadosMestres.some(d => d.data === hoje) && paginaAtual === 1 && !termoBuscaAtivo()) {
            filtrosAtivos.data = [hoje];
        }

        window.atualizarFiltros();
    });
}

const termoBuscaAtivo = () => document.getElementById('inputBusca')?.value !== "";

// --- 2. LÓGICA DE FILTROS E BUSCA ---
window.atualizarFiltros = () => {
    const termo = document.getElementById('inputBusca')?.value.toLowerCase() || "";

    dadosFiltrados = dadosMestres.filter(item => {
        const atendeColunas = Object.keys(filtrosAtivos).every(col => {
            if (filtrosAtivos[col].length === 0) return true;
            return filtrosAtivos[col].includes(String(item[col]));
        });

        const compStr = item.composicao ? JSON.stringify(item.composicao).toLowerCase() : "";
        const atendeBusca = (JSON.stringify(item).toLowerCase() + compStr).includes(termo);

        return atendeColunas && atendeBusca;
    });

    paginaAtual = 1; // Reseta para primeira página ao filtrar
    renderizarTabela();
};

// --- 3. RENDERIZAÇÃO DA TABELA ---
function renderizarTabela() {
    const tbody = document.getElementById('corpoTabela');
    if(!tbody) return;

    // Ordenação
    const dadosOrdenados = [...dadosFiltrados].sort((a, b) => {
        let valA = a[ordenacao.coluna] || "";
        let valB = b[ordenacao.coluna] || "";
        return ordenacao.direcao === 'asc' 
            ? valA.toString().localeCompare(valB.toString(), undefined, {numeric: true}) 
            : valB.toString().localeCompare(valA.toString(), undefined, {numeric: true});
    });

    // Paginação
    const inicio = (paginaAtual - 1) * registrosPorPagina;
    const fim = inicio + registrosPorPagina;
    const dadosPaginados = dadosOrdenados.slice(inicio, fim);

    tbody.innerHTML = "";
    dadosPaginados.forEach(item => {
        // Formatação de data para o padrão brasileiro
        const dataBR = item.data ? item.data.split('-').reverse().join('/') : '---';
        const tipo = (item.tipoProduto || "").toLowerCase();
        const classeTipo = tipo.includes('eletro') ? 'row-eletro' : (tipo.includes('move') ? 'row-moveis' : '');

        const tr = document.createElement('tr');
        tr.className = classeTipo;
        tr.innerHTML = `
            <td><input type="checkbox" class="row-check" value="${item.id}"></td>
            <td style="font-weight:bold">${item.senhaAgendamento || '---'}</td>
            <td>${dataBR}</td>
            <td>${item.central || '---'}</td>
            <td>${item.cargas || 1}</td>
            <td>${item.fornecedor || '---'}</td>
            <td>${item.tipoProduto || '---'}</td>
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

// --- 4. PAGINAÇÃO E ORDENAÇÃO ---
function atualizarControlesPaginacao() {
    const totalPaginas = Math.ceil(dadosFiltrados.length / registrosPorPagina);
    const container = document.getElementById('botoesPagina');
    const info = document.getElementById('infoPagina');
    
    info.innerText = `Mostrando ${dadosFiltrados.length > 0 ? (paginaAtual - 1) * registrosPorPagina + 1 : 0} até ${Math.min(paginaAtual * registrosPorPagina, dadosFiltrados.length)} de ${dadosFiltrados.length} registros`;

    container.innerHTML = "";
    container.innerHTML += `<button class="btn-page" ${paginaAtual === 1 ? 'disabled' : ''} onclick="irParaPagina(${paginaAtual - 1})">Anterior</button>`;

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

window.ordenar = (coluna) => {
    if(ordenacao.coluna === coluna) {
        ordenacao.direcao = ordenacao.direcao === 'asc' ? 'desc' : 'asc';
    } else {
        ordenacao.coluna = coluna;
        ordenacao.direcao = 'asc';
    }
    renderizarTabela();
};

// --- 5. DETALHES (MODAL COMPOSIÇÃO) ---
window.verDetalhes = (id) => {
    const item = dadosMestres.find(d => d.id === id);
    if(!item) return;

    document.getElementById('tituloComp').innerText = `Detalhes: ${item.senhaAgendamento}`;
    const container = document.getElementById('detalhesItens');

    let totalQtd = 0;
    let tabela = `
        <table style="width:100%; border-collapse:collapse; min-width:600px;">
            <thead style="background:#f4f4f4;">
                <tr><th style="padding:12px;">CÓDIGO</th><th style="padding:12px;">DESCRIÇÃO DO PRODUTO</th><th style="padding:12px;">QTD</th></tr>
            </thead>
            <tbody>`;

    if(item.composicao && item.composicao.length > 0) {
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
                <td colspan="2" style="padding:12px; text-align:right;">TOTAL DE PEÇAS:</td>
                <td style="padding:12px; text-align:center; color:red; font-size:16px;">${totalQtd}</td>
            </tr>
        </tbody></table>`;

    container.innerHTML = tabela;
    document.getElementById('modalComposicao').style.display = "flex";
};

// --- 6. UTILITÁRIOS E FILTROS ---
window.abrirModalFiltro = (coluna) => {
    colunaFiltroAtual = coluna;
    const container = document.getElementById('opcoesFiltro');
    const valoresUnicos = [...new Set(dadosMestres.map(d => String(d[coluna] || "")))].sort();

    container.innerHTML = valoresUnicos.map(val => `
        <div style="padding:8px 0; border-bottom:1px solid #eee;">
            <label style="cursor:pointer; display:flex; align-items:center; gap:10px;">
                <input type="checkbox" class="chk-filtro" value="${val}" ${filtrosAtivos[coluna].includes(val) ? 'checked' : ''}> 
                ${coluna === 'data' ? val.split('-').reverse().join('/') : val}
            </label>
        </div>
    `).join('');
    document.getElementById('modalFiltro').style.display = "flex";
};

window.aplicarFiltroColuna = () => {
    const selecionados = Array.from(document.querySelectorAll('.chk-filtro:checked')).map(c => c.value);
    filtrosAtivos[colunaFiltroAtual] = selecionados;
    window.atualizarFiltros();
    window.fecharModais();
};

window.fecharModais = () => {
    document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
};

window.marcarTodos = (el) => {
    document.querySelectorAll('.row-check').forEach(chk => chk.checked = el.checked);
};

// --- 7. EXPORTAÇÃO PERSONALIZADA (PDF E EXCEL) ---
window.exportarPDF = async (modo) => {
    const { jsPDF } = window.jspdf;
    const docPdf = new jsPDF('p', 'mm', 'a4');
    
    const getCoresPorTipo = (tipo) => {
        const t = (tipo || "").toUpperCase();
        if (['ARMARIO','COMODA','PAINEL','MULTIUSO','MODULO','COZINHA','ROUPEIRO'].some(x => t.includes(x))) 
            return { rgb: [255, 255, 0], text: [0, 0, 0] };
        if (t.includes('MESA')) 
            return { rgb: [76, 175, 80], text: [255, 255, 255] };
        if (['CELULAR','TABLET','RELOGIO','NOTEBOOK'].some(x => t.includes(x))) 
            return { rgb: [0, 191, 255], text: [255, 255, 255] };
        return { rgb: [255, 255, 255], text: [0, 0, 0] };
    };

    const selecionadosIds = Array.from(document.querySelectorAll('.row-check:checked')).map(c => c.value);
    if (selecionadosIds.length === 0) return alert("Selecione agendamentos!");

    const agendas = dadosMestres.filter(d => selecionadosIds.includes(d.id));

    // Cabeçalho Vermelho Simonetti
    docPdf.setFillColor(192, 0, 0); 
    docPdf.rect(0, 0, 210, 25, 'F');
    docPdf.setFontSize(18);
    docPdf.setTextColor(255, 255, 255);
    docPdf.text("MÓVEIS SIMONETTI - LOGÍSTICA", 14, 16);
    
    docPdf.setFontSize(10);
    docPdf.setTextColor(0, 0, 0);
    docPdf.text(`TOTAL DE AGENDAS: ${agendas.length}`, 14, 32);
    docPdf.setTextColor(100);
    docPdf.text(`Emitido em: ${new Date().toLocaleString('pt-BR')}`, 145, 32);

    let currentY = 38;

    if (modo === 'completo') {
        agendas.forEach((ag) => {
            if (currentY > 240) { docPdf.addPage(); currentY = 20; }
            docPdf.autoTable({
                head: [['SENHA', 'DATA', 'CENTRAL', 'CARGAS', 'FORNECEDOR', 'TIPO', 'LINHA']],
                body: [[ag.senhaAgendamento, ag.data.split('-').reverse().join('/'), ag.central, ag.cargas || '-', ag.fornecedor, ag.tipoProduto, ag.linhaSeparacao || 'N/A']],
                startY: currentY,
                theme: 'grid',
                headStyles: { fillColor: [192, 0, 0], textColor: 255, fontSize: 8, halign: 'center' },
                styles: { fontSize: 8, halign: 'center', cellPadding: 3, lineColor: [0,0,0], lineWidth: 0.1 },
                didParseCell: (data) => {
                    if (data.section === 'body' && data.column.index === 5) {
                        const estilo = getCoresPorTipo(data.cell.raw);
                        data.cell.styles.fillColor = estilo.rgb;
                        data.cell.styles.textColor = estilo.text;
                    }
                }
            });
            currentY = docPdf.lastAutoTable.finalY;
            if (ag.composicao && ag.composicao.length > 0) {
                docPdf.autoTable({
                    head: [['CÓDIGO', 'DESCRIÇÃO DO PRODUTO', 'QTD']],
                    body: ag.composicao.map(i => [i.codigo, i.descricao, (i.qtd || i.quantidade)]),
                    startY: currentY,
                    margin: { left: 14 },
                    theme: 'grid',
                    headStyles: { fillColor: [235, 235, 235], textColor: 0, fontSize: 7.5, fontStyle: 'bold' },
                    styles: { fontSize: 7.5, cellPadding: 2 },
                    columnStyles: { 0: { cellWidth: 30 }, 2: { cellWidth: 20, halign: 'center' } }
                });
                currentY = docPdf.lastAutoTable.finalY + 10;
            } else { currentY += 8; }
        });
    } else {
        const tableBody = agendas.map(ag => [ag.senhaAgendamento, ag.data.split('-').reverse().join('/'), ag.central, ag.cargas || '-', ag.fornecedor, ag.tipoProduto, ag.linhaSeparacao || 'N/A']);
        docPdf.autoTable({
            head: [['SENHA', 'DATA', 'CENTRAL', 'CARGAS', 'FORNECEDOR', 'TIPO', 'LINHA']],
            body: tableBody,
            startY: currentY,
            theme: 'grid',
            headStyles: { fillColor: [192, 0, 0], textColor: 255, fontSize: 8, halign: 'center' },
            styles: { fontSize: 8, halign: 'center', cellPadding: 3, lineColor: [0,0,0], lineWidth: 0.1 },
            didParseCell: (data) => {
                if (data.section === 'body' && data.column.index === 5) {
                    const estilo = getCoresPorTipo(data.cell.raw);
                    data.cell.styles.fillColor = estilo.rgb;
                    data.cell.styles.textColor = estilo.text;
                }
            }
        });
    }
    docPdf.save(`Relatorio_Simonetti_${modo.toUpperCase()}.pdf`);
};

window.exportarExcel = async (modo) => {
    const selecionadosIds = Array.from(document.querySelectorAll('.row-check:checked')).map(c => c.value);
    if (selecionadosIds.length === 0) return alert("Selecione agendamentos!");

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Relatorio');
    
    const getEstiloExcel = (tipo) => {
        const t = (tipo || "").toUpperCase();
        if (['ARMARIO','COMODA','PAINEL','MULTIUSO','MODULO','COZINHA','ROUPEIRO'].some(x => t.includes(x))) return { fg: 'FFFF00', txt: '000000' }; 
        if (t.includes('MESA')) return { fg: '4CAF50', txt: 'FFFFFF' }; 
        if (['CELULAR','TABLET','RELOGIO','NOTEBOOK'].some(x => t.includes(x))) return { fg: '00BFFF', txt: 'FFFFFF' }; 
        return { fg: 'FFFFFF', txt: '000000' }; 
    };

    const columns = [
        { header: 'Senha', key: 'Senha', width: 25 },
        { header: 'Data', key: 'Data', width: 12 },
        { header: 'Central', key: 'Central', width: 15 },
        { header: 'Cargas', key: 'Cargas', width: 15 },
        { header: 'Fornecedor', key: 'Fornecedor', width: 25 },
        { header: 'Tipo', key: 'Tipo', width: 20 },
        { header: 'Linha', key: 'linhaSeparacao', width: 15 }
    ];

    if (modo === 'completo') {
        columns.push({ header: 'Cód. Item', key: 'Cod_Item', width: 15 }, { header: 'Descrição', key: 'Descricao', width: 40 }, { header: 'Qtd', key: 'Qtd', width: 10 });
    }
    worksheet.columns = columns;

    const agendamentosProcessados = dadosMestres.filter(d => selecionadosIds.includes(d.id)).sort((a, b) => a.data.localeCompare(b.data));
    let dataAnterior = null;

    agendamentosProcessados.forEach(d => {
        const dataFormatada = d.data.split('-').reverse().join('/');
        if (dataAnterior && dataAnterior !== dataFormatada) { worksheet.addRow({}); }
        const base = { Senha: d.senhaAgendamento, Data: dataFormatada, Central: d.central, Cargas: d.cargas || 1, Fornecedor: d.fornecedor, Tipo: d.tipoProduto, linhaSeparacao: d.linhaSeparacao || "N/A" };

        if (modo === 'completo' && d.composicao && d.composicao.length > 0) {
            d.composicao.forEach(item => {
                const row = worksheet.addRow({ ...base, Cod_Item: item.codigo, Descricao: item.descricao, Qtd: (item.qtd || item.quantidade) });
                aplicarEstiloCelula(row, d.tipoProduto);
            });
        } else {
            const row = worksheet.addRow(base);
            aplicarEstiloCelula(row, d.tipoProduto);
        }
        dataAnterior = dataFormatada;
    });

    function aplicarEstiloCelula(row, tipo) {
        row.eachCell({ includeEmpty: false }, (cell) => {
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });
        const estilo = getEstiloExcel(tipo);
        const cellTipo = row.getCell('Tipo');
        cellTipo.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: estilo.fg } };
        cellTipo.font = { color: { argb: estilo.txt }, bold: true };
    }

    worksheet.getRow(1).eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'C00000' } };
        cell.font = { color: { argb: 'FFFFFF' }, bold: true };
        cell.alignment = { horizontal: 'center' };
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Simonetti_Export_${modo.toUpperCase()}.xlsx`;
    a.click();
};

init();

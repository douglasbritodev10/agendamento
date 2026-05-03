import { app } from './firebase-config.js';
import { getFirestore, collection, query, onSnapshot, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const db = getFirestore(app);

// --- ESTADOS GLOBAIS ---
let dadosMestres = [];
let dadosFiltrados = [];
let filtrosAtivos = { 
    senhaAgendamento: [], 
    data: [], 
    central: [], 
    cargas: [],
    fornecedor: [], 
    tipoProduto: [],
    linhaSeparacao: [] // ADICIONE ESTA LINHA
};
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
        const cores = getCoresPorTipo(item.tipoProduto);
        tr.innerHTML = `
            <td><input type="checkbox" class="row-check" value="${item.id}"></td>
            <td style="font-weight:bold">${item.senhaAgendamento || '---'}</td>
            <td>${dataBR}</td>
            <td>${item.central || '---'}</td>
            <td>${item.cargas || 1}</td>
            <td>${item.fornecedor || '---'}</td>
            <td style="background-color: rgb(${cores.rgb.join(',')}); color: rgb(${cores.text.join(',')}); font-weight: bold;">
                ${item.tipoProduto || '---'}
            </td>
            <td style="font-weight: bold;">${item.linhaSeparacao || '-'}</td>
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
    // Seleciona os checkboxes dentro do corpo da tabela
    const checkboxes = document.querySelectorAll('#corpoTabela .row-check');
    checkboxes.forEach(chk => chk.checked = el.checked);
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

    const selecionados = Array.from(document.querySelectorAll('.row-check:checked')).map(c => c.value);
    if (selecionados.length === 0) return alert("Selecione agendamentos!");

    const snap = await getDocs(collection(db, "agendamentos"));
    const agendasMap = {};
    snap.forEach(d => { agendasMap[d.id] = d.data(); });
    const agendas = selecionados.map(id => agendasMap[id]).filter(a => a !== undefined);

    // Cabeçalho fixo do topo
    docPdf.setFillColor(192, 0, 0); 
    docPdf.rect(0, 0, 210, 25, 'F');
    docPdf.setFontSize(18);
    docPdf.setTextColor(255, 255, 255);
    docPdf.text("MÓVEIS SIMONETTI - LOGÍSTICA", 14, 16); //
    
    docPdf.setFontSize(10);
    docPdf.setTextColor(0, 0, 0);
    docPdf.text(`TOTAL DE AGENDAS: ${agendas.length}`, 14, 32);
    docPdf.setTextColor(100);
    docPdf.text(`Emitido em: ${new Date().toLocaleString('pt-BR')}`, 145, 32); //

    let currentY = 38;

    if (modo === 'completo') {
        // --- LÓGICA PARA O PDF COMPLETO (Blocos Elegantes) ---
        agendas.forEach((ag) => {
            if (currentY > 240) { docPdf.addPage(); currentY = 20; }

            docPdf.autoTable({
                head: [['SENHA', 'DATA', 'CENTRAL', 'CARGAS', 'FORNECEDOR', 'TIPO', 'LINHA']],
                body: [[
                    ag.senhaAgendamento, 
                    ag.data.split('-').reverse().join('/'), 
                    ag.central, 
                    ag.cargas || '-', 
                    ag.fornecedor, 
                    ag.tipoProduto,
                    ag.linhaSeparacao || 'N/A'
                ]],
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
                    body: ag.composicao.map(i => [i.codigo, i.descricao, i.qtd]),
                    startY: currentY,
                    margin: { left: 14 },
                    theme: 'grid',
                    headStyles: { fillColor: [235, 235, 235], textColor: 0, fontSize: 7.5, fontStyle: 'bold' },
                    styles: { fontSize: 7.5, cellPadding: 2 },
                    columnStyles: { 0: { cellWidth: 30 }, 2: { cellWidth: 20, halign: 'center' } }
                });
                currentY = docPdf.lastAutoTable.finalY + 10; // Espaço maior entre blocos
            } else {
                currentY += 8;
            }
        });
    } else {
        // --- LÓGICA PARA O PDF BÁSICO (Tabela Contínua do Print) ---
        const tableBody = agendas.map(ag => [
            ag.senhaAgendamento,
            ag.data.split('-').reverse().join('/'),
            ag.central,
            ag.cargas || '-',
            ag.fornecedor,
            ag.tipoProduto,
            ag.linhaSeparacao || 'N/A'
        ]);

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
    const selecionados = Array.from(document.querySelectorAll('.row-check:checked')).map(c => c.value);
    if (selecionados.length === 0) return alert("Selecione agendamentos!");

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Relatorio');

    const getEstiloExcel = (tipo) => {
        const t = (tipo || "").toUpperCase();
        if (['ARMARIO','COMODA','PAINEL','MULTIUSO','MODULO','COZINHA','ROUPEIRO'].some(x => t.includes(x))) 
            return { fg: 'FFFF00', txt: '000000' }; 
        if (t.includes('MESA')) 
            return { fg: '4CAF50', txt: 'FFFFFF' }; 
        if (['CELULAR','TABLET','RELOGIO','NOTEBOOK'].some(x => t.includes(x))) 
            return { fg: '00BFFF', txt: 'FFFFFF' }; 
        return { fg: 'FFFFFF', txt: '000000' }; 
    };

    const columns = [
        { header: 'Senha', key: 'Senha', width: 25 },
        { header: 'Data', key: 'Data', width: 12 },
        { header: 'Central', key: 'Central', width: 15 },
        { header: 'Cargas', key: 'Cargas', width: 15 },
        { header: 'Pedido', key: 'Pedido', width: 15 },
        { header: 'Fornecedor', key: 'Fornecedor', width: 25 },
        { header: 'Tipo', key: 'Tipo', width: 20 },
        { header: 'Linha', key: 'linhaSeparacao', width: 15 }
    ];

    if (modo === 'completo') {
        columns.push(
            { header: 'Cód. Item', key: 'Cod_Item', width: 15 },
            { header: 'Descrição', key: 'Descricao', width: 40 },
            { header: 'Qtd', key: 'Qtd', width: 10 }
        );
    }
    worksheet.columns = columns;

    const snap = await getDocs(collection(db, "agendamentos"));
    
    // Filtramos e ordenamos por data para a separação funcionar corretamente
    const agendamentosProcessados = [];
    snap.forEach(doc => {
        if (selecionados.includes(doc.id)) {
            agendamentosProcessados.push(doc.data());
        }
    });
    
    // Ordenar por data (garante que agendamentos do mesmo dia fiquem juntos)
    agendamentosProcessados.sort((a, b) => a.data.localeCompare(b.data));

    let dataAnterior = null;

    agendamentosProcessados.forEach(d => {
        const dataFormatada = d.data.split('-').reverse().join('/');
        
        // Se a data mudou e não é a primeira linha, insere linha em branco
        if (dataAnterior && dataAnterior !== dataFormatada) {
            worksheet.addRow({}); 
        }

        const base = {
            Senha: d.senhaAgendamento,
            Data: dataFormatada,
            Central: d.central,
            Cargas: d.cargas,
            Pedido: d.pedido,
            Fornecedor: d.fornecedor,
            Tipo: d.tipoProduto,
            linhaSeparacao: d.linhaSeparacao || "N/A"
        };

        if (modo === 'completo' && d.composicao && d.composicao.length > 0) {
            d.composicao.forEach(item => {
                const row = worksheet.addRow({ ...base, Cod_Item: item.codigo, Descricao: item.descricao, Qtd: item.qtd });
                aplicarEstiloCelula(row, d.tipoProduto);
            });
        } else {
            const row = worksheet.addRow(base);
            aplicarEstiloCelula(row, d.tipoProduto);
        }

        dataAnterior = dataFormatada;
    });

    // Função para aplicar bordas e cores
    function aplicarEstiloCelula(row, tipo) {
        row.eachCell({ includeEmpty: false }, (cell) => {
            // Aplicar bordas em todas as células com dados
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
            
            // Centralizar dados (opcional, para ficar mais limpo)
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });

        // Aplicar cor na coluna Tipo
        const estilo = getEstiloExcel(tipo);
        const cellTipo = row.getCell('Tipo');
        cellTipo.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: estilo.fg }
        };
        cellTipo.font = { color: { argb: estilo.txt }, bold: true };
    }

    // Estilo do Cabeçalho Vermelho Simonetti
    worksheet.getRow(1).eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'C00000' } };
        cell.font = { color: { argb: 'FFFFFF' }, bold: true };
        cell.alignment = { horizontal: 'center' };
        cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };
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

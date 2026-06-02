import { app } from './firebase-config.js';
import { getFirestore, collection, query, onSnapshot, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const db = getFirestore(app);

// --- CONFIGURAÇÕES DE CORES MASTER ---
const situacoesCoresMaster = {
    "CARGA RECEBIDA": { hex: "4CAF50", rgb: [76, 175, 80], txt: [255, 255, 255] },
    "NO PATIO - FICOU P/ AMANHÃ": { hex: "3ACFB9", rgb: [58, 207, 185], txt: [0, 0, 0] },
    "CANCELADA": { hex: "7A002B", rgb: [122, 0, 43], txt: [255, 255, 255] },
    "SOB AJUSTE": { hex: "8B27F5", rgb: [139, 39, 245], txt: [255, 255, 255] },
    "NO PATIO - SOB ENCAIXE": { hex: "FF7625", rgb: [255, 118, 37], txt: [0, 0, 0] },
    "NO PATIO - FICOU DE ONTEM": { hex: "B249BF", rgb: [178, 73, 191], txt: [255, 255, 255] },
    "EM RECEBIMENTO": { hex: "FFC107", rgb: [255, 193, 7], txt: [0, 0, 0] },
    "NO PATIO": { hex: "03A9F4", rgb: [3, 169, 244], txt: [0, 0, 0] },
    "EM ATRASO": { hex: "F44336", rgb: [244, 67, 54], txt: [255, 255, 255] },
    "REAGENDA": { hex: "9B591B", rgb: [155, 89, 27], txt: [255, 255, 255] },
    "DEFAULT": { hex: "646464", rgb: [100, 100, 100], txt: [255, 255, 255] }
};

const getCoresPorTipoFull = (tipo) => {
    const t = (tipo || "").toUpperCase();
    if (['ROUPEIRO', 'ARMARIO', 'COZINHA', 'PAINEL', 'MODULO', 'MULTIUSO', 'BALCAO', 'COMODA'].some(x => t.includes(x))) 
        return { hex: 'FFFF00', rgb: [255, 255, 0], txt: [0, 0, 0] };
    if (['CELULAR', 'TABLET', 'RELOGIO', 'ROBO', 'NOTEBOOK'].some(x => t.includes(x))) 
        return { hex: '00BFFF', rgb: [0, 191, 255], txt: [255, 255, 255] };
    if (t.includes('MESA')) 
        return { hex: '4CAF50', rgb: [76, 175, 80], txt: [255, 255, 255] };
    return { hex: 'FFFFFF', rgb: [255, 255, 255], txt: [0, 0, 0] };
};

// Variáveis de Controle
let dadosMestres = [];
let dadosFiltrados = [];

// --- INICIALIZAÇÃO ---
function init() {
    // Nome do usuário do Banco (via LocalStorage do Login)
    const user = localStorage.getItem('username') || "SISTEMAS";
    const userEl = document.getElementById('txtUser');
    if(userEl) userEl.innerText = user.toUpperCase();

    const q = query(collection(db, "agendamentos"), orderBy("data", "desc"));
    onSnapshot(q, (snapshot) => {
        dadosMestres = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        dadosFiltrados = [...dadosMestres];
        renderizarTabela();
    });
}

// --- RENDERIZAÇÃO DA TABELA NO SITE ---
function renderizarTabela() {
    const tbody = document.getElementById('corpoTabela');
    if(!tbody) return;
    tbody.innerHTML = "";

    dadosFiltrados.forEach(ag => {
        const situ = ag.agendasituacao || "NO PATIO";
        const configS = situacoesCoresMaster[situ] || situacoesCoresMaster['DEFAULT'];
        const configT = getCoresPorTipoFull(ag.tipoProduto || ag.tipo);

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input type="checkbox" class="check-export" value="${ag.id}"></td>
            <td style="font-weight:bold">${ag.senhaAgendamento}${ag.veiculoAgrupado ? `<br><small style="color:blue">VEÍCULO: ${ag.veiculoAgrupado}</small>` : ''}</td>
            <td>${ag.data ? ag.data.split('-').reverse().join('/') : '-'}</td>
            <td style="background:#${configS.hex}; color:rgb(${configS.txt.join(',')}); font-weight:bold;">${situ}</td>
            <td>${ag.fornecedor || '-'}</td>
            <td style="background:#${configT.hex}; color:rgb(${configT.txt.join(',')}); font-weight:bold;">${ag.tipoProduto || ag.tipo || '-'}</td>
            <td>${ag.box || '-'}</td>
            <td>
                <button onclick="verDetalhes('${ag.id}')" style="background:none; border:none; color:#d32f2f; cursor:pointer;">
                    <i class="fas fa-eye fa-lg"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// --- EXPORTAÇÃO PDF ---
window.exportarPDF = async () => {
    const { jsPDF } = window.jspdf;
    const docPdf = new jsPDF('l', 'mm', 'a4');

    const selecionadosIds = Array.from(document.querySelectorAll('.check-export:checked')).map(c => c.value);
    if (selecionadosIds.length === 0) return alert("Selecione agendamentos na tabela!");

    const agendas = dadosMestres.filter(ag => selecionadosIds.includes(ag.id));
    const veiculosUnicos = new Set(agendas.map(a => a.veiculoAgrupado || a.senhaAgendamento)).size;

    // Header Simonetti
    docPdf.setFillColor(211, 47, 47);
    docPdf.rect(0, 0, 297, 20, 'F');
    docPdf.setTextColor(255, 255, 255);
    docPdf.setFontSize(14);
    docPdf.text("MS RECEBIMENTO - MÓVEIS SIMONETTI", 10, 13);
    docPdf.setFontSize(10);
    docPdf.text(`VEÍCULOS: ${veiculosUnicos}  |  AGENDAS: ${agendas.length}`, 240, 13);

    const columns = ["SENHA", "DATA", "CENTRAL", "CARGAS", "SITUAÇÃO", "BOX", "FORNECEDOR", "TIPO"];
    const body = agendas.map(ag => [
        ag.veiculoAgrupado ? `${ag.senhaAgendamento}\n(VEÍCULO: ${ag.veiculoAgrupado})` : ag.senhaAgendamento,
        ag.data ? ag.data.split('-').reverse().join('/') : '-',
        ag.central || '-',
        ag.cargas || '-',
        ag.agendasituacao || 'NO PATIO',
        ag.box || '-',
        ag.fornecedor || '-',
        ag.tipoProduto || ag.tipo || '-'
    ]);

    docPdf.autoTable({
        head: [columns],
        body: body,
        startY: 25,
        theme: 'grid',
        headStyles: { fillColor: [211, 47, 47], fontSize: 8, halign: 'center' },
        styles: { fontSize: 7, halign: 'center' },
        didParseCell: (data) => {
            // Cores na Coluna Situação (Índice 4)
            if (data.section === 'body' && data.column.index === 4) {
                const config = situacoesCoresMaster[data.cell.raw] || situacoesCoresMaster['DEFAULT'];
                data.cell.styles.fillColor = config.rgb;
                data.cell.styles.textColor = config.txt;
            }
            // Cores na Coluna Tipo (Índice 7)
            if (data.section === 'body' && data.column.index === 7) {
                const config = getCoresPorTipoFull(data.cell.raw);
                data.cell.styles.fillColor = config.rgb;
                data.cell.styles.textColor = config.txt;
            }
        }
    });

    // Tabela de Resumo no final
    const resumo = agendas.reduce((acc, curr) => {
        const s = curr.agendasituacao || 'NO PATIO';
        acc[s] = (acc[s] || 0) + 1;
        return acc;
    }, {});

    docPdf.autoTable({
        head: [['RESUMO POR SITUAÇÃO', 'QTD']],
        body: Object.keys(resumo).map(k => [k, resumo[k]]),
        startY: docPdf.lastAutoTable.finalY + 10,
        tableWidth: 70,
        headStyles: { fillColor: [50, 50, 50] },
        didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 0) {
                const config = situacoesCoresMaster[data.cell.raw] || situacoesCoresMaster['DEFAULT'];
                data.cell.styles.fillColor = config.rgb;
                data.cell.styles.textColor = config.txt;
            }
        }
    });

    docPdf.save(`Recebimento_Simonetti_${new Date().toLocaleDateString()}.pdf`);
};

// --- EXPORTAÇÃO EXCEL ---
window.exportarExcel = async () => {
    const selecionadosIds = Array.from(document.querySelectorAll('.check-export:checked')).map(c => c.value);
    if (selecionadosIds.length === 0) return alert("Selecione agendamentos!");

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Relatorio');

    worksheet.columns = [
        { header: 'SENHA', key: 'senha', width: 25 },
        { header: 'DATA', key: 'data', width: 12 },
        { header: 'SITUAÇÃO', key: 'situacao', width: 25 },
        { header: 'FORNECEDOR', key: 'fornecedor', width: 30 },
        { header: 'TIPO', key: 'tipo', width: 20 },
        { header: 'BOX', key: 'box', width: 10 }
    ];

    const agendas = dadosMestres.filter(ag => selecionadosIds.includes(ag.id));

    agendas.forEach(ag => {
        const situ = ag.agendasituacao || "NO PATIO";
        const cS = situacoesCoresMaster[situ] || situacoesCoresMaster['DEFAULT'];
        const cT = getCoresPorTipoFull(ag.tipoProduto || ag.tipo);

        const row = worksheet.addRow({
            senha: ag.veiculoAgrupado ? `${ag.senhaAgendamento} (VEÍCULO: ${ag.veiculoAgrupado})` : ag.senhaAgendamento,
            data: ag.data ? ag.data.split('-').reverse().join('/') : '',
            situacao: situ,
            fornecedor: ag.fornecedor,
            tipo: ag.tipoProduto || ag.tipo,
            box: ag.box || '-'
        });

        // Aplicar cores Excel
        const cellS = row.getCell('situacao');
        cellS.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + cS.hex.replace('#','') } };
        cellS.font = { color: { argb: cS.txt[0] === 255 ? 'FFFFFF' : '000000' }, bold: true };

        const cellT = row.getCell('tipo');
        cellT.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + cT.hex.replace('#','') } };
        cellT.font = { color: { argb: cT.txt[0] === 255 ? 'FFFFFF' : '000000' }, bold: true };
    });

    // Estilo do Header
    worksheet.getRow(1).eachCell(c => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD32F2F' } };
        c.font = { color: { argb: 'FFFFFF' }, bold: true };
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Recebimento_Simonetti.xlsx`;
    link.click();
};

// Funções globais para botões do HTML
window.verDetalhes = (id) => { /* Sua lógica de modal de detalhes aqui */ };
window.logout = () => { localStorage.clear(); window.location.href = 'login.html'; };

init();

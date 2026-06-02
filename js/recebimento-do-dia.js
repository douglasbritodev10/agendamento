import { app } from './firebase-config.js';
import { getFirestore, collection, query, onSnapshot, orderBy, getDoc, doc } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

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

let dadosMestres = [];
let myChart = null;

// --- INICIALIZAÇÃO ---
function init() {
    const user = localStorage.getItem('username') || "SISTEMAS";
    const userEl = document.getElementById('txtUser');
    if(userEl) userEl.innerText = user.toUpperCase();

    const q = query(collection(db, "agendamentos"), orderBy("data", "desc"));
    onSnapshot(q, (snapshot) => {
        dadosMestres = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderizarPainel(dadosMestres);
    });

    // Filtro de Busca em Tempo Real
    document.getElementById('inputBusca')?.addEventListener('input', (e) => {
        const termo = e.target.value.toLowerCase();
        const filtrados = dadosMestres.filter(d => 
            (d.senhaAgendamento?.toLowerCase().includes(termo)) || 
            (d.fornecedor?.toLowerCase().includes(termo)) ||
            (d.cargas?.toLowerCase().includes(termo))
        );
        renderizarPainel(filtrados);
    });
}

// --- RENDERIZAÇÃO PRINCIPAL ---
function renderizarPainel(dados) {
    renderizarTabela(dados);
    renderizarGraficoEResumo(dados);
}

function renderizarTabela(dados) {
    const tbody = document.getElementById('corpoTabela');
    if(!tbody) return;
    tbody.innerHTML = "";

    dados.forEach(ag => {
        const situ = ag.agendasituacao || "NO PATIO";
        const configS = situacoesCoresMaster[situ] || situacoesCoresMaster['DEFAULT'];
        const configT = getCoresPorTipoFull(ag.tipoProduto || ag.tipo);

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input type="checkbox" class="check-export" value="${ag.id}"></td>
            <td style="font-weight:bold">${ag.senhaAgendamento}${ag.veiculoAgrupado ? `<br><small style="color:blue">VEÍCULO: ${ag.veiculoAgrupado}</small>` : ''}</td>
            <td>${ag.data ? ag.data.split('-').reverse().join('/') : '-'}</td>
            <td>${ag.central || '-'}</td>
            <td>${ag.cargas || '-'}</td>
            <td style="background:#${configS.hex}; color:rgb(${configS.txt.join(',')}); font-weight:bold;">${situ}</td>
            <td>${ag.fornecedor || '-'}</td>
            <td style="background:#${configT.hex}; color:rgb(${configT.txt.join(',')}); font-weight:bold;">${ag.tipoProduto || ag.tipo || '-'}</td>
            <td>${ag.box || '-'}</td>
            <td>
                <button onclick="verComp('${ag.id}')" style="background:none; border:none; color:#C00000; cursor:pointer;">
                    <i class="fas fa-eye fa-lg"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// --- GRÁFICO E LEGENDA COM TOTAIS ---
function renderizarGraficoEResumo(dados) {
    const resumo = dados.reduce((acc, curr) => {
        const s = curr.agendasituacao || 'NO PATIO';
        acc[s] = (acc[s] || 0) + 1;
        return acc;
    }, {});

    const labels = Object.keys(resumo);
    const valores = Object.values(resumo);
    const cores = labels.map(l => `#${(situacoesCoresMaster[l] || situacoesCoresMaster['DEFAULT']).hex}`);

    // Atualiza Gráfico
    const ctx = document.getElementById('chartSituacao').getContext('2d');
    if (myChart) myChart.destroy();
    myChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{ data: valores, backgroundColor: cores }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            plugins: { legend: { display: false } } 
        }
    });

    // Resumo de Texto (Parecido com o print)
    const resumoContainer = document.getElementById('resumoSituacoes');
    if (resumoContainer) {
        resumoContainer.innerHTML = labels.map(l => {
            const conf = situacoesCoresMaster[l] || situacoesCoresMaster['DEFAULT'];
            return `
                <div style="display:flex; align-items:center; margin-bottom:5px; font-size:12px;">
                    <span style="width:12px; height:12px; background:#${conf.hex}; display:inline-block; margin-right:8px; border-radius:2px;"></span>
                    <span style="font-weight:bold;">${l} (${resumo[l]})</span>
                </div>
            `;
        }).join('');
    }

    // Totalizador Central
    const totalCarros = new Set(dados.map(d => d.veiculoAgrupado || d.senhaAgendamento)).size;
    const totalAgendas = dados.length;
    const infoTotal = document.getElementById('infoTotal');
    if(infoTotal) infoTotal.innerText = `CARROS: ${totalCarros} | AGENDAS: ${totalAgendas}`;
}

// --- EXPORTAÇÃO PDF (O QUE VOCÊ GOSTOU) ---
window.exportarPDF = async () => {
    const { jsPDF } = window.jspdf;
    const docPdf = new jsPDF('l', 'mm', 'a4');
    const selecionadosIds = Array.from(document.querySelectorAll('.check-export:checked')).map(c => c.value);
    
    const agendas = selecionadosIds.length > 0 
        ? dadosMestres.filter(ag => selecionadosIds.includes(ag.id)) 
        : dadosMestres;

    docPdf.setFillColor(192, 0, 0);
    docPdf.rect(0, 0, 297, 15, 'F');
    docPdf.setTextColor(255, 255, 255);
    docPdf.text("MÓVEIS SIMONETTI - RECEBIMENTO DO DIA", 10, 10);

    const body = agendas.map(ag => [
        ag.senhaAgendamento,
        ag.data?.split('-').reverse().join('/') || '-',
        ag.central || '-',
        ag.cargas || '-',
        ag.agendasituacao || 'NO PATIO',
        ag.fornecedor || '-',
        ag.tipoProduto || '-',
        ag.box || '-'
    ]);

    docPdf.autoTable({
        head: [['SENHA', 'DATA', 'CENTRAL', 'CARGAS', 'SITUAÇÃO', 'FORNECEDOR', 'TIPO', 'BOX']],
        body: body,
        startY: 20,
        theme: 'grid',
        headStyles: { fillColor: [192, 0, 0], fontSize: 8 },
        styles: { fontSize: 7 },
        didParseCell: (data) => {
            if (data.column.index === 4 && data.section === 'body') {
                const conf = situacoesCoresMaster[data.cell.raw] || situacoesCoresMaster['DEFAULT'];
                data.cell.styles.fillColor = conf.rgb;
                data.cell.styles.textColor = conf.txt;
            }
        }
    });

    docPdf.save(`Recebimento_Simonetti_${new Date().toLocaleDateString()}.pdf`);
};

// --- EXPORTAÇÃO EXCEL (COM TODAS AS COLUNAS E COMPOSIÇÃO) ---
window.exportarExcel = async () => {
    const selecionadosIds = Array.from(document.querySelectorAll('.check-export:checked')).map(c => c.value);
    const agendas = selecionadosIds.length > 0 
        ? dadosMestres.filter(ag => selecionadosIds.includes(ag.id)) 
        : dadosMestres;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Relatorio Completo');

    worksheet.columns = [
        { header: 'SENHA', key: 'senha', width: 15 },
        { header: 'DATA', key: 'data', width: 12 },
        { header: 'CENTRAL', key: 'central', width: 15 },
        { header: 'CARGAS', key: 'cargas', width: 15 },
        { header: 'SITUAÇÃO', key: 'situacao', width: 20 },
        { header: 'FORNECEDOR', key: 'fornecedor', width: 25 },
        { header: 'TIPO', key: 'tipo', width: 15 },
        { header: 'BOX', key: 'box', width: 10 },
        { header: 'CÓD. ITEM', key: 'cod', width: 12 },
        { header: 'DESCRIÇÃO COMPOSIÇÃO', key: 'desc', width: 35 },
        { header: 'QTD', key: 'qtd', width: 8 }
    ];

    agendas.forEach(ag => {
        const base = {
            senha: ag.senhaAgendamento,
            data: ag.data?.split('-').reverse().join('/') || '',
            central: ag.central,
            cargas: ag.cargas,
            situacao: ag.agendasituacao || "NO PATIO",
            fornecedor: ag.fornecedor,
            tipo: ag.tipoProduto || ag.tipo,
            box: ag.box
        };

        if (ag.composicao && ag.composicao.length > 0) {
            ag.composicao.forEach(item => {
                worksheet.addRow({ ...base, cod: item.codigo, desc: item.descricao, qtd: item.qtd });
            });
        } else {
            worksheet.addRow(base);
        }
    });

    // Estilização Básica Header
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC00000' } };

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Recebimento_Simonetti_Completo.xlsx`);
};

window.verComp = async (id) => { /* Abre modal de composição igual no código anterior */ };
window.logout = () => { localStorage.clear(); window.location.href = 'login.html'; };

init();

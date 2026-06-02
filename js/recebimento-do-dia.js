import { app } from './firebase-config.js';
import { 
    getFirestore, collection, query, onSnapshot, orderBy 
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const db = getFirestore(app);
let todasAgendas = [];
let meuGrafico = null;

// Configurações de Cores (Mesma lógica do seu sistema principal)
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

document.addEventListener('DOMContentLoaded', () => {
    iniciarRelogio();
    popularSelectFiltro();
    ouvirDados();
});

function popularSelectFiltro() {
    const select = document.getElementById('filtroSituacao');
    Object.keys(situacoesCoresMaster).forEach(s => {
        if(s !== "DEFAULT") {
            const opt = document.createElement('option');
            opt.value = s; opt.textContent = s;
            select.appendChild(opt);
        }
    });
}

function ouvirDados() {
    const q = query(collection(db, "agendamentos"), orderBy("data", "desc"));
    onSnapshot(q, (snapshot) => {
        todasAgendas = snapshot.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(a => a.noPainel === true); // Só o que está no painel ativo
        filtrarTabela();
    });
}

window.filtrarTabela = () => {
    const busca = document.getElementById('filtroBusca').value.toUpperCase();
    const situacao = document.getElementById('filtroSituacao').value;

    const filtradas = todasAgendas.filter(a => {
        const texto = `${a.senhaAgendamento} ${a.fornecedor} ${a.cargas} ${a.veiculoAgrupado || ''}`.toUpperCase();
        const bateBusca = texto.includes(busca);
        const bateSitu = situacao === "" || (a.agendasituacao || "NO PATIO") === situacao;
        return bateBusca && bateSitu;
    });

    renderizarTabela(filtradas);
    atualizarGráfico(filtradas);
    
    // Atualiza Totais
    document.getElementById('txtTotalAgendas').textContent = filtradas.length;
    const veiculos = new Set(filtradas.map(f => f.veiculoAgrupado || f.senhaAgendamento)).size;
    document.getElementById('txtTotalVeiculos').textContent = veiculos;
};

function renderizarTabela(dados) {
    const tbody = document.getElementById('tbodyOperacional');
    tbody.innerHTML = dados.map(ag => {
        const situ = ag.agendasituacao || "NO PATIO";
        const configS = situacoesCoresMaster[situ] || situacoesCoresMaster['DEFAULT'];
        const configT = getCoresPorTipoFull(ag.tipoProduto || ag.tipo);
        
        return `
            <tr>
                <td>
                    <b>${ag.senhaAgendamento}</b>
                    ${ag.veiculoAgrupado ? `<br><small style="color:blue">🚚 ${ag.veiculoAgrupado}</small>` : ''}
                </td>
                <td>${ag.data ? ag.data.split('-').reverse().join('/') : '-'}</td>
                <td>${ag.central || '-'}</td>
                <td style="font-size:10px; max-width:200px;">${ag.cargas || '-'}</td>
                <td>
                    <span class="badge-situacao" style="background-color: ${configS.hex}; color: ${configS.txt[0] === 255 ? '#fff' : '#000'}">
                        ${situ}
                    </span>
                </td>
                <td>${ag.fornecedor || '-'}</td>
                <td>
                    <span class="badge-tipo" style="background-color: #${configT.hex};">
                        ${ag.tipoProduto || ag.tipo || '-'}
                    </span>
                </td>
                <td><b>${ag.box || '-'}</b></td>
            </tr>
        `;
    }).join('');
}

function atualizarGráfico(dados) {
    const resumo = dados.reduce((acc, curr) => {
        const s = curr.agendasituacao || 'NO PATIO';
        acc[s] = (acc[s] || 0) + 1;
        return acc;
    }, {});

    const labels = Object.keys(resumo);
    const valores = Object.values(resumo);
    const cores = labels.map(l => situacoesCoresMaster[l]?.hex || "#646464");

    if (meuGrafico) meuGrafico.destroy();

    const ctx = document.getElementById('chartSituacao').getContext('2d');
    meuGrafico = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: valores,
                backgroundColor: cores,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right', labels: { font: { size: 10 } } }
            }
        }
    });
}

window.exportarPDF = async () => {
    // Aqui usei exatamente a lógica da tabela de resumo que ajustamos antes
    const { jsPDF } = window.jspdf;
    const docPdf = new jsPDF('l', 'mm', 'a4');
    
    const busca = document.getElementById('filtroBusca').value.toUpperCase();
    const situacao = document.getElementById('filtroSituacao').value;
    const agendas = todasAgendas.filter(a => {
        const texto = `${a.senhaAgendamento} ${a.fornecedor} ${a.veiculoAgrupado || ''}`.toUpperCase();
        return texto.includes(busca) && (situacao === "" || (a.agendasituacao || "NO PATIO") === situacao);
    });

    if(agendas.length === 0) return alert("Nada para exportar");

    // Cabeçalho
    docPdf.setFillColor(211, 47, 47);
    docPdf.rect(0, 0, 297, 20, 'F');
    docPdf.setFontSize(14);
    docPdf.setTextColor(255, 255, 255);
    docPdf.text("MÓVEIS SIMONETTI - RELATÓRIO OPERACIONAL", 10, 13);

    const columns = ["SENHA/VEIC", "DATA", "CENTRAL", "SITUAÇÃO", "FORNECEDOR", "TIPO", "BOX"];
    const body = agendas.map(ag => [
        ag.veiculoAgrupado ? `${ag.senhaAgendamento}\n(${ag.veiculoAgrupado})` : ag.senhaAgendamento,
        ag.data ? ag.data.split('-').reverse().join('/') : '-',
        ag.central || '-',
        ag.agendasituacao || 'NO PATIO',
        ag.fornecedor || '-',
        ag.tipoProduto || ag.tipo || '-',
        ag.box || '-'
    ]);

    docPdf.autoTable({
        head: [columns],
        body: body,
        startY: 25,
        theme: 'grid',
        styles: { fontSize: 7, halign: 'center' },
        headStyles: { fillColor: [211, 47, 47] },
        didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 3) {
                const situ = data.cell.raw;
                const config = situacoesCoresMaster[situ] || situacoesCoresMaster['DEFAULT'];
                data.cell.styles.fillColor = config.rgb;
                data.cell.styles.textColor = config.txt;
            }
        }
    });

    // Tabela de Resumo no rodapé (Igual ao que você aprovou)
    const resumoObj = agendas.reduce((acc, curr) => {
        const s = curr.agendasituacao || 'NO PATIO';
        acc[s] = (acc[s] || 0) + 1;
        return acc;
    }, {});

    docPdf.autoTable({
        head: [['SITUAÇÃO', 'QUANTIDADE']],
        body: Object.keys(resumoObj).map(key => [key, resumoObj[key]]),
        startY: docPdf.lastAutoTable.finalY + 10,
        tableWidth: 80,
        theme: 'grid',
        styles: { fontSize: 8, fontStyle: 'bold' },
        didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 0) {
                const situ = data.cell.raw;
                const config = situacoesCoresMaster[situ] || situacoesCoresMaster['DEFAULT'];
                data.cell.styles.fillColor = config.rgb;
                data.cell.styles.textColor = config.txt;
            }
        }
    });

    docPdf.save(`Recebimento_Dia_${new Date().toLocaleDateString()}.pdf`);
};

function iniciarRelogio() {
    const div = document.getElementById('relogio');
    setInterval(() => {
        const now = new Date();
        div.textContent = now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR');
    }, 1000);
}

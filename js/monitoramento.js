import { app } from './firebase-config.js';
import { getFirestore, collection, query, onSnapshot, orderBy } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const db = getFirestore(app);

let dadosOriginais = []; 
let dadosExibidos = [];   
let filtrosAtivos = { senhaAgendamento: [], data: [], central: [], cargas: [], fornecedor: [], tipoProduto: [] };

function iniciar() {
    document.getElementById('user-display').innerText = localStorage.getItem('username') || "Douglas Brito";

    const q = query(collection(db, "agendamentos"), orderBy("data", "desc"));

    onSnapshot(q, (snap) => {
        dadosOriginais = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(item => item.status !== "Rascunho" && item.status !== "DRAFT");

        // Regra: Ao abrir, filtra pela data de hoje automaticamente
        const hoje = new Date().toISOString().split('T')[0];
        if (filtrosAtivos.data.length === 0 && dadosOriginais.some(d => d.data === hoje)) {
            filtrosAtivos.data = [hoje];
            document.getElementById('th-data').classList.add('filtrado');
        }

        aplicarLogicaDeFiltros();
    });
}

// Lógica de Cores por Tipo (Igual à sua ideia original)
const getClasseTipo = (tipo) => {
    const t = tipo.toLowerCase();
    if (t.includes('eletro')) return 'tipo-eletro';
    if (t.includes('moveis') || t.includes('móveis')) return 'tipo-moveis';
    return 'tipo-outros';
};

function aplicarLogicaDeFiltros() {
    const termoBusca = document.getElementById('inputBuscaGlobal').value.toLowerCase();
    
    dadosExibidos = dadosOriginais.filter(item => {
        // 1. Filtros de Coluna (Efeito Cascata)
        const passaFiltros = Object.keys(filtrosAtivos).every(col => {
            return filtrosAtivos[col].length === 0 || filtrosAtivos[col].includes(item[col]);
        });

        // 2. Busca Global Profunda (Inclui Itens da Composição)
        const composicaoString = item.composicao ? JSON.stringify(item.composicao).toLowerCase() : "";
        const itemString = JSON.stringify(item).toLowerCase() + composicaoString;
        const passaBusca = itemString.includes(termoBusca);

        return passaFiltros && passaBusca;
    });

    renderizarTabela();
}

function renderizarTabela() {
    const corpo = document.getElementById('tabelaCorpo');
    corpo.innerHTML = "";
    document.getElementById('txtContador').innerText = dadosExibidos.length;

    dadosExibidos.forEach(ag => {
        corpo.innerHTML += `
            <tr class="${getClasseTipo(ag.tipoProduto)}">
                <td><input type="checkbox" class="check-export" value="${ag.id}"></td>
                <td style="font-weight:bold">${ag.senhaAgendamento}</td>
                <td>${ag.data.split('-').reverse().join('/')}</td>
                <td>${ag.central}</td>
                <td>${ag.cargas || '1'}</td>
                <td>${ag.fornecedor}</td>
                <td>${ag.tipoProduto}</td>
                <td>
                    <button onclick="verComposicao('${ag.id}')" style="background:none; border:none; color:var(--primary); cursor:pointer;">
                        <i class="fas fa-eye" style="font-size:18px;"></i>
                    </button>
                </td>
            </tr>`;
    });
}

// --- FUNÇÕES DO MODAL DE FILTRO ---
window.abrirFiltroColuna = (coluna) => {
    window.colunaAtiva = coluna;
    const modal = document.getElementById('modalFiltro');
    const lista = document.getElementById('listaOpcoes');
    
    // Cascata: Mostra apenas opções que existem nos dados atualmente filtrados
    let opcoes = [...new Set(dadosExibidos.map(d => d[coluna]))].sort((a,b) => 
        String(a).localeCompare(String(b), undefined, {numeric: true})
    );

    lista.innerHTML = "";
    opcoes.forEach(opt => {
        const checked = filtrosAtivos[coluna].includes(opt);
        const label = (coluna === 'data') ? opt.split('-').reverse().join('/') : opt;
        lista.innerHTML += `
            <div class="opcao-item">
                <input type="checkbox" class="check-filtro" value="${opt}" ${checked ? 'checked' : ''}>
                <label>${label}</label>
            </div>`;
    });
    modal.style.display = 'flex';
};

window.toggleTodosFiltros = (status) => {
    document.querySelectorAll('.check-filtro').forEach(cb => cb.checked = status);
};

window.executarFiltro = () => {
    const selecionados = Array.from(document.querySelectorAll('.check-filtro:checked')).map(cb => cb.value);
    filtrosAtivos[window.colunaAtiva] = selecionados;
    
    // Atualiza o indicador amarelo (APLICADO)
    const th = document.getElementById(`th-${window.colunaAtiva}`);
    if (selecionados.length > 0) th.classList.add('filtrado');
    else th.classList.remove('filtrado');

    aplicarLogicaDeFiltros();
    fecharModal();
};

// --- MODAL DE COMPOSIÇÃO (VISUAL PREMIUM) ---
window.verComposicao = (id) => {
    const ag = dadosOriginais.find(d => d.id === id);
    const container = document.getElementById('detalheItens');
    
    if (!ag.composicao || ag.composicao.length === 0) {
        container.innerHTML = "<p style='text-align:center;'>Sem itens detalhados.</p>";
    } else {
        let html = `<table style="width:100%; border-collapse:collapse; background:white; border-radius:10px; overflow:hidden;">
            <tr style="background:#f4f4f4;">
                <th style="padding:10px; font-size:11px;">CÓDIGO</th>
                <th style="padding:10px; font-size:11px;">DESCRIÇÃO</th>
                <th style="padding:10px; font-size:11px;">QTD</th>
            </tr>`;
        ag.composicao.forEach(item => {
            html += `<tr>
                <td style="padding:10px; border-top:1px solid #eee; text-align:center;">${item.codigo}</td>
                <td style="padding:10px; border-top:1px solid #eee;">${item.descricao}</td>
                <td style="padding:10px; border-top:1px solid #eee; text-align:center; font-weight:bold;">${item.quantidade}</td>
            </tr>`;
        });
        html += `</table>`;
        container.innerHTML = html;
    }
    document.getElementById('modalComposicao').style.display = 'flex';
};

window.fecharModalComposicao = () => document.getElementById('modalComposicao').style.display = 'none';
window.fecharModal = () => document.getElementById('modalFiltro').style.display = 'none';

// --- EXPORTAÇÃO PDF (Sua lógica integrada) ---
window.exportarPDF = async (modo) => {
    const { jsPDF } = window.jspdf;
    const docPdf = new jsPDF('p', 'mm', 'a4');
    const selecionados = Array.from(document.querySelectorAll('.check-export:checked')).map(c => c.value);
    
    if (selecionados.length === 0) return alert("Selecione agendamentos na tabela!");

    const agendas = dadosOriginais.filter(d => selecionados.includes(d.id));

    // Cabeçalho Simonetti
    docPdf.setFillColor(192, 0, 0); 
    docPdf.rect(0, 0, 210, 25, 'F');
    docPdf.setFontSize(18);
    docPdf.setTextColor(255, 255, 255);
    docPdf.text("MÓVEIS SIMONETTI - MONITORAMENTO", 14, 16);
    
    docPdf.setFontSize(10);
    docPdf.text(`TOTAL: ${agendas.length}`, 14, 32);
    docPdf.setTextColor(100);
    docPdf.text(`Emitido em: ${new Date().toLocaleString()}`, 150, 32);

    let currentY = 38;

    agendas.forEach((ag) => {
        if (currentY > 250) { docPdf.addPage(); currentY = 20; }

        docPdf.autoTable({
            head: [['SENHA', 'DATA', 'CENTRAL', 'FORNECEDOR', 'TIPO']],
            body: [[ag.senhaAgendamento, ag.data.split('-').reverse().join('/'), ag.central, ag.fornecedor, ag.tipoProduto]],
            startY: currentY,
            theme: 'grid',
            headStyles: { fillColor: [192, 0, 0] },
            styles: { fontSize: 8, halign: 'center' }
        });

        currentY = docPdf.lastAutoTable.finalY;

        if (modo === 'completo' && ag.composicao) {
            docPdf.autoTable({
                head: [['CÓDIGO', 'DESCRIÇÃO', 'QTD']],
                body: ag.composicao.map(i => [i.codigo, i.descricao, i.quantidade]),
                startY: currentY,
                margin: { left: 25 },
                tableWidth: 160,
                styles: { fontSize: 7 }
            });
            currentY = docPdf.lastAutoTable.finalY + 5;
        } else {
            currentY += 5;
        }
    });

    docPdf.save(`Simonetti_PDF_${modo.toUpperCase()}.pdf`);
};

// --- EXPORTAÇÃO EXCEL ---
window.exportarExcel = async (modo) => {
    const selecionados = Array.from(document.querySelectorAll('.check-export:checked')).map(c => c.value);
    if (selecionados.length === 0) return alert("Selecione agendamentos!");

    const rows = [];
    const agendas = dadosOriginais.filter(d => selecionados.includes(d.id));

    agendas.forEach(d => {
        const base = {
            Senha: d.senhaAgendamento,
            Data: d.data.split('-').reverse().join('/'),
            Central: d.central,
            Fornecedor: d.fornecedor,
            Tipo: d.tipoProduto
        };

        if (modo === 'completo' && d.composicao) {
            d.composicao.forEach(item => {
                rows.push({ ...base, Codigo: item.codigo, Descricao: item.descricao, Qtd: item.quantidade });
            });
        } else {
            rows.push(base);
        }
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Monitoramento");
    XLSX.writeFile(wb, `Simonetti_Excel_${modo.toUpperCase()}.xlsx`);
};

iniciar();

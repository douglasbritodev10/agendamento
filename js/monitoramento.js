import { app } from './firebase-config.js';
import { getFirestore, collection, query, where, onSnapshot, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const db = getFirestore(app);

let dadosOriginais = []; 
let dadosExibidos = [];   
let filtrosAtivos = { senhaAgendamento: [], data: [], central: [], fornecedor: [], tipoProduto: [] };

// --- INICIALIZAÇÃO ---
function iniciar() {
    // Identidade visual no topo
    const userDisplay = document.getElementById('user-display');
    if(userDisplay) userDisplay.innerText = localStorage.getItem('username') || "DBRITO";

    // Carrega dados sem rascunhos
    const q = query(collection(db, "agendamentos"), orderBy("data", "desc"));

    onSnapshot(q, (snap) => {
        // Bloqueio de rascunhos: só entra o que é oficial
        dadosOriginais = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(item => item.status !== "Rascunho" && item.status !== "DRAFT");

        aplicarLogicaDeFiltros();
    });
}

// --- LÓGICA DE FILTROS CASCATA ---
window.abrirFiltroColuna = (coluna) => {
    const modal = document.getElementById('modalFiltro');
    const lista = document.getElementById('listaOpcoes');
    window.colunaAtiva = coluna;
    
    // Opções únicas baseadas no que já está filtrado (Cascata)
    let opcoes = [...new Set(dadosExibidos.map(d => d[coluna]))].sort();

    lista.innerHTML = "";
    opcoes.forEach(opt => {
        const label = (coluna === 'data') ? opt.split('-').reverse().join('/') : opt;
        const checked = filtrosAtivos[coluna].includes(opt);
        lista.innerHTML += `
            <div class="opcao-item">
                <input type="checkbox" class="check-filtro" value="${opt}" ${checked ? 'checked' : ''}>
                <label>${label}</label>
            </div>`;
    });
    modal.style.display = 'flex';
};

window.executarFiltro = () => {
    const selecionados = Array.from(document.querySelectorAll('.check-filtro:checked')).map(cb => cb.value);
    filtrosAtivos[window.colunaAtiva] = selecionados;
    aplicarLogicaDeFiltros();
    fecharModal();
};

function aplicarLogicaDeFiltros() {
    const termoBusca = document.getElementById('inputBuscaGlobal').value.toLowerCase();
    
    dadosExibidos = dadosOriginais.filter(item => {
        // Filtros de Coluna
        const passaFiltroCol = Object.keys(filtrosAtivos).every(col => {
            return filtrosAtivos[col].length === 0 || filtrosAtivos[col].includes(item[col]);
        });

        // Busca Global (Search Bar)
        const conteudo = JSON.stringify(item).toLowerCase();
        const passaBusca = conteudo.includes(termoBusca);

        return passaFiltroCol && passaBusca;
    });

    renderizarTabela();
}

// --- RENDERIZAÇÃO ---
function renderizarTabela() {
    const corpo = document.getElementById('tabelaCorpo');
    corpo.innerHTML = "";
    document.getElementById('txtContador').innerText = dadosExibidos.length;

    dadosExibidos.forEach(ag => {
        corpo.innerHTML += `
            <tr>
                <td><input type="checkbox" class="check-export" value="${ag.id}"></td>
                <td style="font-weight:bold">${ag.senhaAgendamento}</td>
                <td>${ag.data.split('-').reverse().join('/')}</td>
                <td>${ag.central}</td>
                <td>${ag.cargas || '1'}</td>
                <td>${ag.fornecedor}</td>
                <td>${ag.tipoProduto}</td>
                <td><button onclick="verComposicao('${ag.id}')" class="btn-acao"><i class="fas fa-eye"></i></button></td>
            </tr>`;
    });
}

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

window.fecharModal = () => document.querySelectorAll('.modal-filtro').forEach(m => m.style.display = 'none');
window.verComposicao = (id) => { /* Mesma lógica do modal anterior */ };

iniciar();

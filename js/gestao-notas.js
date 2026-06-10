import { app } from './firebase-config.js';
import { 
    getFirestore, doc, setDoc, collection, addDoc, onSnapshot, query, orderBy, 
    updateDoc, getDocs, limit, serverTimestamp, deleteDoc, getDoc, where 
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

// --- INICIALIZAÇÃO DO BANCO ---
const db = getFirestore(app);

// --- CONTROLE DE ACESSO AJUSTADO (Lendo as caixinhas do seu login) ---
// Douglas, aqui eu mudei para ler exatamente como o seu auth.js salva
const nivelAcessoRaw = localStorage.getItem('nivelAcesso') || ""; 
const usuarioNome = localStorage.getItem('username') || "Usuário";
const nivelAcesso = nivelAcessoRaw.toUpperCase().trim();

// 1. Verificação de Segurança
const niveisPermitidos = ["ADM", "LOGISTICA"];

if (!nivelAcesso || !niveisPermitidos.includes(nivelAcesso)) {
    console.error("Acesso negado! Nível lido:", nivelAcesso);
    // Se não encontrar o nível, ele volta pro login
    window.location.replace("index.html");
}

// 2. Exibição do Nome e Trava de Níveis
document.addEventListener('DOMContentLoaded', () => {
    // Tenta encontrar o ID do campo de nome (testa os dois nomes que usamos)
    const display = document.getElementById('txtUser') || document.getElementById('user-display');
    if (display) {
        display.innerText = usuarioNome.toUpperCase();
    }

    // Se for LEITOR, bloqueia as edições visualmente na hora
    if (nivelAcesso === "LEITOR") {
        const style = document.createElement('style');
        style.innerHTML = `
            .btn-edit, .btn-delete, .btn-save, [onclick*="excluir"], [onclick*="editar"], .btn-acoes { 
                display: none !important; 
            }
        `;
        document.head.appendChild(style);
    }
});

// 3. Função de Proteção para as funções de salvar/excluir
function temPermissao() {
    if (nivelAcesso === "ADM" || nivelAcesso === "LOGISTICA") {
        return true;
    }
    alert("Acesso Negado: Seu perfil (LEITOR) permite apenas a visualização.");
    return false;
}

// Função para registrar logs no Firebase (usando as variáveis novas)
async function registrarHistorico(acao, detalhes) {
    if (nivelAcesso === "ADM" || nivelAcesso === "LOGISTICA") {
        try {
            await addDoc(collection(db, "historico"), {
                usuario: usuarioNome,
                nivel: nivelAcesso,
                acao: acao,
                detalhes: detalhes,
                data: serverTimestamp()
            });
        } catch (e) { console.error("Erro ao registrar log:", e); }
    }
}

// --- ESTADO GLOBAL ---
let dadosOriginais = [];
let dadosFiltrados = [];
let paginaAtual = 1;
let itensPorPagina = 50;
let colunaFiltroAtual = '';
let ordemCrescente = true; // Controle de estado
let ultimaColuna = '';

// Define a data atual no fuso do Brasil (DD/MM/YYYY) como filtro inicial
const dataHojeBrasil = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
let filtrosSelecionados = {
    'data': [dataHojeBrasil]
};

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
    escutarDadosFirebase();
});

// --- BUSCA DE DADOS EM TEMPO REAL ---
function escutarDadosFirebase() {
    const q = query(collection(db, "agendamentos"));
    
    onSnapshot(q, (querySnapshot) => {
        dadosOriginais = [];
        querySnapshot.forEach((doc) => {
            dadosOriginais.push({ id: doc.id, ...doc.data() });
        });
        
        // Garante que aplica a busca/filtros e já atualiza o visual dos botões de filtro
        aplicarFiltrosEBusca();
        atualizarVisualFiltros();
    });
}

window.renderizarTabela = function() {
    const corpo = document.getElementById('corpoTabela');
    corpo.innerHTML = '';

    const inicio = (paginaAtual - 1) * itensPorPagina;
    const fim = inicio + itensPorPagina;
    const listaExibicao = dadosFiltrados.slice(inicio, fim);

    // Recupera o nível de acesso para aplicar a trava
    const usuarioLogado = JSON.parse(localStorage.getItem('usuarioLogado'));
    const isLeitor = usuarioLogado?.nivelAcesso === "LEITOR";

    const getClasseTipo = (tipo) => {
        const t = (tipo || "").toUpperCase();
        if (['ARMARIO','COMODA','PAINEL','MULTIUSO','MODULO','COZINHA','ROUPEIRO'].some(x => t.includes(x))) return 'tipo-amarelo';
        if (t.includes('MESA')) return 'tipo-verde';
        if (['CELULAR','TABLET','RELOGIO','NOTEBOOK'].some(x => t.includes(x))) return 'tipo-azul';
        return 'tipo-padrao';
    };

    listaExibicao.forEach(item => {
        const tr = document.createElement('tr');
        
        tr.innerHTML = `
            <td><input type="checkbox" class="check-export" value="${item.id}"></td>
            <td style="font-weight:bold; color:var(--primary)">${item.senhaAgendamento || '-'}</td>
            <td>${formatarData(item.data)}</td>
            <td>${item.central || '-'}</td>
            <td>${item.cargas || '-'}</td>
            
            <!-- COLUNA PEDIDO (Bloqueada se for LEITOR) -->
            <td>
                <input type="text" class="control-input" style="padding:4px; width:90%; text-align:center" 
                value="${item.pedido || ''}" 
                ${isLeitor ? 'disabled' : ''} 
                onchange="atualizarCampo('${item.id}', 'pedido', this.value)">
            </td>

            <!-- COLUNA NOTAS (Bloqueada se for LEITOR) -->
            <td>
                <input type="text" class="control-input" style="padding:4px; width:90%; text-align:center" 
                value="${item.notas || ''}" 
                ${isLeitor ? 'disabled' : ''} 
                onchange="atualizarCampo('${item.id}', 'notas', this.value)">
            </td>

            <td>${renderizarSelectSituacao(item)}</td>
            <td style="text-align:left">${item.fornecedor || '-'}</td>
            <td>
                <span class="${getClasseTipo(item.tipoProduto)}">
                    ${item.tipoProduto || '-'}
                </span>
            </td>
            <td>${item.linhaSeparacao || '-'}</td>
            <td>
                <button onclick="abrirComposicao('${item.id}')" style="border:none; background:none; cursor:pointer; color:#1565c0">
                    <i class="fas fa-eye"></i>
                </button>
            </td>
        `;
        corpo.appendChild(tr);
    });

    atualizarControlesPaginacao();
};

// --- FILTROS E BUSCA ---
window.atualizarFiltros = function() {
    aplicarFiltrosEBusca();
};

function aplicarFiltrosEBusca() {
    const termoBusca = document.getElementById('inputBusca').value.toLowerCase();
    
    dadosFiltrados = dadosOriginais.filter(item => {
        // 1. Busca Geral
        const matchCamposNormais = Object.values(item).some(val => 
            String(val).toLowerCase().includes(termoBusca)
        );

        const matchComposicao = item.composicao?.some(prod => 
            String(prod.codigo).toLowerCase().includes(termoBusca) || 
            String(prod.descricao).toLowerCase().includes(termoBusca)
        );

        const matchBusca = matchCamposNormais || matchComposicao;
        
        // 2. Filtros por Coluna (CORRIGIDO AQUI)
        const matchFiltros = Object.keys(filtrosSelecionados).every(coluna => {
            const selecionadosNaColuna = filtrosSelecionados[coluna]; // Nome corrigido
            if (!selecionadosNaColuna || selecionadosNaColuna.length === 0) return true;
            
            const valorParaComparar = (coluna === 'data') 
                ? formatarData(item[coluna]) 
                : String(item[coluna] || '');

            return selecionadosNaColuna.includes(valorParaComparar); // Nome corrigido
        });

        return matchBusca && matchFiltros;
    });

    atualizarVisualFiltros(); 
    paginaAtual = 1;
    renderizarTabela();
}

function atualizarVisualFiltros() {
    // Lista de colunas que possuem filtro (baseado no seu objeto de estado)
    const colunasComFiltro = Object.keys(filtrosSelecionados).filter(col => filtrosSelecionados[col].length > 0);

    // Resetar todos os botões primeiro (Remova ou ajuste os IDs conforme seu HTML)
    document.querySelectorAll('.btn-abrir-filtro').forEach(btn => {
        btn.style.background = 'none';
        btn.style.color = 'inherit';
        btn.innerHTML = '<i class="fas fa-filter"></i>'; // Ícone padrão
    });

    // Aplicar destaque nos ativos
    colunasComFiltro.forEach(coluna => {
        // Aqui buscamos o elemento que você clica para abrir o filtro
        // Exemplo: um elemento com id="filter-central"
        const btn = document.getElementById(`filter-${coluna}`);
        if (btn) {
            btn.style.background = '#ffeb3b'; // Amarelo
            btn.style.color = '#000';
            btn.style.padding = '2px 6px';
            btn.style.borderRadius = '4px';
            btn.style.fontSize = '10px';
            btn.innerHTML = 'APLICADO';
        }
    });
}

// --- MODAL DE FILTRO INTELIGENTE (COM ÁRVORE DE DATAS CORRIGIDA) ---
window.abrirFiltro = function(coluna, event) {
    event.stopPropagation();
    colunaFiltroAtual = coluna;
    const modal = document.getElementById('modalFiltro');
    const container = document.getElementById('opcoesFiltro');
    
    // 1. COMPORTAMENTO EXCLUSIVO PARA A COLUNA "DATA" (Agrupamento estilo Excel)
    if (coluna === 'data') {
        // Mapeamento dos nomes dos meses em PT-BR
        const nomesMeses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        const estrutura = {};

        // Organiza as datas originais em Anos e Meses
        dadosOriginais.forEach(item => {
            const dataBruta = item.data || '';
            if (!dataBruta) return;
            
            const [ano, mes, dia] = dataBruta.split('-');
            const dataFormatada = `${dia}/${mes}/${ano}`;

            if (!estrutura[ano]) estrutura[ano] = {};
            if (!estrutura[ano][mes]) estrutura[ano][mes] = [];
            
            // Guarda a data formatada e o valor bruto para o checkbox
            if (!estrutura[ano][mes].some(d => d.bruto === dataBruta)) {
                estrutura[ano][mes].push({ bruto: dataBruta, formatada: dataFormatada });
            }
        });

        const temFiltroAtivo = filtrosSelecionados['data'] && filtrosSelecionados['data'].length > 0;
        let htmlArvore = `<div style="font-family: sans-serif; font-size: 13px; user-select: none;">`;

        // Varre os Anos (Ordenado do mais recente para o mais antigo)
        Object.keys(estrutura).sort((a, b) => b - a).forEach(ano => {
            // Coleta todos os dias deste ano para validar o Ativo/Marcado
            const todosDiasAno = [];
            Object.keys(estrutura[ano]).forEach(m => {
                estrutura[ano][m].forEach(d => todosDiasAno.push(d.formatada));
            });

            // Regras dinâmicas do Ano
            const anoChecked = temFiltroAtivo ? todosDiasAno.every(d => filtrosSelecionados['data'].includes(d)) : true;
            const temDiaMarcadoNoAno = temFiltroAtivo && todosDiasAno.some(d => filtrosSelecionados['data'].includes(d));
            const displayAno = temDiaMarcadoNoAno ? 'block' : 'none';
            const setaAno = temDiaMarcadoNoAno ? '▼' : '▶';

            htmlArvore += `
                <div style="margin-bottom: 5px;">
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span onclick="this.parentElement.nextElementSibling.style.display = this.parentElement.nextElementSibling.style.display === 'none' ? 'block' : 'none'; this.innerText = this.innerText === '▶' ? '▼' : '▶';" style="cursor: pointer; width: 12px; font-size: 10px; color: #666;">${setaAno}</span>
                        <label style="font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 5px;">
                            <input type="checkbox" class="chk-ano-arvore" onchange="const chks = this.parentElement.parentElement.nextElementSibling.querySelectorAll('.check-item-filtro'); chks.forEach(c => c.checked = this.checked);" ${anoChecked ? 'checked' : ''}>
                            ${ano}
                        </label>
                    </div>
                    <div class="meses-container" style="display: ${displayAno}; margin-left: 18px; margin-top: 4px;">`;

            // Varre os Meses do Ano
            Object.keys(estrutura[ano]).sort((a, b) => b - a).forEach(mes => {
                const nomeMes = nomesMeses[parseInt(mes) - 1] || mes;
                const todosDiasMes = estrutura[ano][mes].map(d => d.formatada);

                // Regras dinâmicas do Mês
                const mesChecked = temFiltroAtivo ? todosDiasMes.every(d => filtrosSelecionados['data'].includes(d)) : true;
                const temDiaMarcadoNoMes = temFiltroAtivo && todosDiasMes.some(d => filtrosSelecionados['data'].includes(d));
                const displayMes = temDiaMarcadoNoMes ? 'block' : 'none';
                const setaMes = temDiaMarcadoNoMes ? '▼' : '▶';

                htmlArvore += `
                    <div style="margin-bottom: 3px;">
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <span onclick="this.parentElement.nextElementSibling.style.display = this.parentElement.nextElementSibling.style.display === 'none' ? 'block' : 'none'; this.innerText = this.innerText === '▶' ? '▼' : '▶';" style="cursor: pointer; width: 12px; font-size: 10px; color: #666;">${setaMes}</span>
                            <label style="cursor: pointer; display: flex; align-items: center; gap: 5px; font-weight: 500;">
                                <input type="checkbox" class="chk-mes-arvore" onchange="const chks = this.parentElement.parentElement.nextElementSibling.querySelectorAll('.check-item-filtro'); chks.forEach(c => c.checked = this.checked);" ${mesChecked ? 'checked' : ''}>
                                ${nomeMes}
                            </label>
                        </div>
                        <div class="dias-container" style="display: ${displayMes}; margin-left: 18px; margin-top: 2px;">`;

                // Varre os Dias do Mes (Ordenados por dia)
                estrutura[ano][mes].sort((a, b) => b.formatada.localeCompare(a.formatada)).forEach(dataObj => {
                    const estaChecado = filtrosSelecionados['data']?.includes(dataObj.formatada);
                    
                    htmlArvore += `
                        <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px; cursor: pointer; padding-left: 5px;">
                            <input type="checkbox" 
                                   value="${dataObj.formatada}" 
                                   ${estaChecado || !temFiltroAtivo ? 'checked' : ''} 
                                   class="check-item-filtro"> 
                            <span>${dataObj.formatada.split('/')[0]}</span>
                        </label>
                    `;
                });

                htmlArvore += `</div></div>`; // Fecha dias-container e bloco do mês
            });

            htmlArvore += `</div></div>`; // Fecha meses-container e bloco do ano
        });

        htmlArvore += `</div>`;
        container.innerHTML = htmlArvore;

    // 2. COMPORTAMENTO PADRÃO PARA AS OUTRAS COLUNAS (Mantém o original intacto)
    } else {
        const todosValoresUnicos = [...new Set(dadosOriginais.map(item => String(item[coluna] || '')))].sort();
        const valoresVivos = [...new Set(dadosFiltrados.map(item => String(item[coluna] || '')))];
        
        container.innerHTML = todosValoresUnicos.map(valor => {
            const estaVivo = valoresVivos.includes(valor);
            const estaChecado = filtrosSelecionados[coluna]?.includes(valor);
            const estiloLabel = estaVivo ? 'color: #333; font-weight: 500;' : 'color: #ccc; cursor: not-allowed;';

            return `
                <label style="display:flex; align-items:center; gap:10px; margin-bottom:8px; cursor:pointer; ${estiloLabel}">
                    <input type="checkbox" 
                           value="${valor}" 
                           ${estaChecado ? 'checked' : ''} 
                           class="check-item-filtro"> 
                    ${valor === '' ? '(Vazio)' : valor}
                </label>
            `;
        }).join('');
    }

    modal.style.display = 'flex';
};

window.aplicarFiltroColuna = function() {
    // Captura os valores que você marcou nos checkboxes do modal
    const selecionados = Array.from(document.querySelectorAll('.check-item-filtro:checked'))
        .map(cb => cb.value);
    
    // Salva no estado global de filtros
    filtrosSelecionados[colunaFiltroAtual] = selecionados;
    
    fecharModais();
    aplicarFiltrosEBusca(); // Dispara a atualização da tabela e dos outros filtros
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

    const selecionados = Array.from(document.querySelectorAll('.check-export:checked')).map(c => c.value);
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
    const selecionados = Array.from(document.querySelectorAll('.check-export:checked')).map(c => c.value);
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

// --- AUXILIARES ---
async function atualizarCampo(id, campo, valor) {
    try {
        await updateDoc(doc(db, "agendamentos", id), { [campo]: valor });
    } catch (e) { console.error("Erro ao atualizar:", e); }
}

function renderizarSelectSituacao(item) {
    // Lista de status atualizada com base no seu CSS
    const status = [
        'AGUARDANDO',
        'OK NO AJUSTE', 
        'SEM NOTA', 
        'REAGENDADA', 
        'SOBRE AJUSTE', 
        'CANCELADA', 
        'OC PENDENTE', 
        'SEM TRIANGULACAO', 
        'VENCIMENTO ERRADO', 
        'FALTA CTE', 
        'NOTA ERRADA', 
        'CTE DIVERGENTE'
    ];

    // Mapeamento de Cores (Fundo e Texto)
    const cores = {
        'AGUARDANDO': { bg: '#424242', text: '#ffffff' },
        'OK NO AJUSTE': { bg: '#066b3c', text: '#ffffff' },
        'SEM NOTA': { bg: '#0d47a1', text: '#ffffff' },
        'REAGENDADA': { bg: '#e1bee7', text: '#4a148c' },
        'SOBRE AJUSTE': { bg: '#ffe082', text: '#5f4b00' },
        'CANCELADA': { bg: '#b71c1c', text: '#ffffff' },
        'OC PENDENTE': { bg: '#cfd8dc', text: '#37474f' },
        'SEM TRIANGULACAO': { bg: '#ffcdd2', text: '#b71c1c' },
        'VENCIMENTO ERRADO': { bg: '#b71c1c', text: '#ffffff' },
        'FALTA CTE': { bg: '#512da8', text: '#ffffff' },
        'NOTA ERRADA': { bg: '#ffccbc', text: '#e64a19' },
        'CTE DIVERGENTE': { bg: '#795548', text: '#ffffff' }
    };

    const estiloAtual = cores[item.situacao] || { bg: '#424242', text: '#ffffff' };
    
    // Adicionei um contorno amarelo caso seja VENCIMENTO ERRADO
    const borderExtra = item.situacao === 'VENCIMENTO ERRADO' ? 'outline: 2px solid #ffd600;' : '';

    // --- NOVA REGRA DE ACESSO ---
    const usuarioLogado = JSON.parse(localStorage.getItem('usuarioLogado'));
    const isLeitor = usuarioLogado?.nivelAcesso === "LEITOR";

    return `
        <select onchange="atualizarCampo('${item.id}', 'situacao', this.value)" 
            ${isLeitor ? 'disabled' : ''} 
            style="background:${estiloAtual.bg}; color:${estiloAtual.text}; border:none; border-radius:15px; padding:4px 8px; font-size:10px; font-weight:bold; cursor:pointer; ${borderExtra} opacity: ${isLeitor ? '0.8' : '1'};">
            ${status.map(s => `<option value="${s}" ${item.situacao === s ? 'selected' : ''} style="background: white; color: black;">${s}</option>`).join('')}
        </select>
    `;
}

function formatarData(data) {
    if (!data) return '-';
    const [ano, mes, dia] = data.split('-');
    return `${dia}/${mes}/${ano}`;
}

window.fecharModais = function() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
};

window.atualizarControlesPaginacao = function() {
    const totalItens = dadosFiltrados.length;
    const totalPaginas = Math.ceil(totalItens / itensPorPagina) || 1;
    
    // 1. Atualiza o texto informativo
    const info = document.getElementById('infoPaginacao');
    if (info) {
        info.innerText = `Mostrando ${totalItens} registros (Página ${paginaAtual} de ${totalPaginas})`;
    }
    
    // 2. Atualiza o número no meio dos botões
    const numPagina = document.getElementById('numeroPaginaAtiva');
    if (numPagina) {
        numPagina.innerText = paginaAtual;
    }

    // 3. Opcional: Desativar botões visualmente se não houver para onde ir
    // Isso evita que o usuário clique em "Próximo" sem necessidade
    const btnAnterior = document.querySelector("button[onclick*='anterior']");
    const btnProximo = document.querySelector("button[onclick*='proximo']");
    
    if (btnAnterior) btnAnterior.disabled = (paginaAtual === 1);
    if (btnProximo) btnProximo.disabled = (paginaAtual === totalPaginas);
};

// Função para mudar a quantidade de itens por página
window.mudarTamanhoPagina = function(valor) {
    itensPorPagina = parseInt(valor);
    paginaAtual = 1;
    renderizarTabela();
};

window.mudarPagina = function(direcao) {
    const totalPaginas = Math.ceil(dadosFiltrados.length / itensPorPagina);
    if (direcao === 'proximo' && paginaAtual < totalPaginas) {
        paginaAtual++;
    } else if (direcao === 'anterior' && paginaAtual > 1) {
        paginaAtual--;
    }
    renderizarTabela();
};

// --- ATUALIZAÇÃO DE CAMPOS ---
window.atualizarCampo = async function(id, campo, valor) {
    if (nivelAcesso === "LEITOR") return;

    try {
        const docRef = doc(db, "agendamentos", id);
        const docSnap = await getDoc(docRef);
        const dadoAntigo = docSnap.exists() ? docSnap.data()[campo] : "";

        await updateDoc(docRef, { [campo]: valor });
        
        // REGISTRA NO HISTÓRICO
        registrarHistorico("ALTERAÇÃO", `Campo ${campo} alterado de "${dadoAntigo}" para "${valor}" no ID: ${id}`);
        
        console.log("Atualizado com sucesso!");
    } catch (e) {
        console.error("Erro ao atualizar campo:", e);
    }
};

window.marcarTodos = function(masterCheckbox) {
    const checkboxes = document.querySelectorAll('#corpoTabela input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = masterCheckbox.checked);
};

window.marcarTodosFiltro = function(valor) {
    const checkboxes = document.querySelectorAll('.check-item-filtro');
    checkboxes.forEach(cb => cb.checked = valor);
};

window.ordenarTabela = function(coluna) {
    // Se clicar na mesma coluna, inverte a ordem. Se for outra, começa crescente.
    if (ultimaColuna === coluna) {
        ordemCrescente = !ordemCrescente;
    } else {
        ordemCrescente = true;
        ultimaColuna = coluna;
    }

    dadosFiltrados.sort((a, b) => {
        let valA = String(a[coluna] || "").toLowerCase();
        let valB = String(b[coluna] || "").toLowerCase();
        
        // Lógica para datas (se a coluna for 'data', inverte para comparar corretamente)
        if (coluna === 'data') {
            return ordemCrescente ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }

        if (valA < valB) return ordemCrescente ? -1 : 1;
        if (valA > valB) return ordemCrescente ? 1 : -1;
        return 0;
    });

    renderizarTabela();
};

window.abrirComposicao = async function(id) {
    const docSnap = await getDoc(doc(db, "agendamentos", id));
    
    if (docSnap.exists()) {
        const dados = docSnap.data();
        const modal = document.getElementById('modalComposicao');
        const container = document.getElementById('detalhesItens');
        const titulo = document.getElementById('tituloComp');

        titulo.innerText = `Detalhes: ${dados.senhaAgendamento || 'N/A'}`;

        if (dados.composicao && dados.composicao.length > 0) {
            // Calcula o total das quantidades
            const totalQtd = dados.composicao.reduce((acc, item) => acc + (Number(item.qtd) || 0), 0);

            container.innerHTML = `
                <div style="overflow-x: auto; overflow-y: auto; max-height: 400px;">
                    <table style="width:100%; border-collapse: collapse; font-family: sans-serif; font-size: 13px;">
                        <thead>
                            <tr style="background: #c00000; color: white;">
                                <th style="padding:12px; border: 1px solid #ddd; width: 20%;">CÓDIGO</th>
                                <th style="padding:12px; border: 1px solid #ddd; width: 65%;">DESCRIÇÃO</th>
                                <th style="padding:12px; border: 1px solid #ddd; width: 15%;">QTD</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${dados.composicao.map(item => `
                                <tr style="border-bottom: 1px solid #eee;">
                                    <td style="padding:10px; text-align:center; border: 1px solid #ddd;">${item.codigo}</td>
                                    <td style="padding:10px; border: 1px solid #ddd; text-transform: uppercase;">${item.descricao}</td>
                                    <td style="padding:10px; text-align:center; border: 1px solid #ddd; font-weight: bold; color: red;">${item.qtd}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot>
                            <tr style="background: #f9f9f9; font-weight: bold;">
                                <td colspan="2" style="padding:10px; text-align: right; border: 1px solid #ddd;">TOTAL:</td>
                                <td style="padding:10px; text-align: center; border: 1px solid #ddd; color: red;">${totalQtd}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            `;
        } else {
            container.innerHTML = '<p style="text-align:center; padding:20px;">Nenhum item encontrado.</p>';
        }

        modal.style.display = 'flex';
    }
};

// --- FUNÇÃO AUXILIAR PARA DEFINIR CORES DOS CARDS NA CÓPIA ---
const getCoresPorTipoCard = (tipo) => {
    const t = (tipo || "").toUpperCase();
    if (['ARMARIO','COMODA','PAINEL','MULTIUSO','MODULO','COZINHA','ROUPEIRO'].some(x => t.includes(x))) 
        return { bg: '#fff9c4', text: '#827717' }; // Amarelo suave
    if (t.includes('MESA')) 
        return { bg: '#c8e6c9', text: '#1b5e20' }; // Verde suave
    if (['CELULAR','TABLET','RELOGIO','NOTEBOOK'].some(x => t.includes(x))) 
        return { bg: '#e1f5fe', text: '#01579b' }; // Azul suave
    return { bg: '#f5f5f5', text: '#424242' };     // Cinza padrão
};

// --- FUNÇÃO DE COPIAR AGENDAMENTOS (ESTILO CARD HTML) ---
window.copiarAgendamentosSelecionados = () => {
    const selecionados = Array.from(document.querySelectorAll('.check-export:checked'));
    if (selecionados.length === 0) return alert("Selecione os agendamentos na tabela!");

    let html = `<div style="font-family: Arial, sans-serif; max-width: 450px;">`;

    selecionados.forEach(cb => {
        const tr = cb.closest('tr');
        
        // Ajuste dos índices conforme seu renderizarTabela:
        // cells[1]=Senha, [2]=Data, [3]=Central, [4]=Cargas, [8]=Fornecedor, [9]=Tipo
        const senha = tr.cells[1].innerText;
        const data = tr.cells[2].innerText;
        const central = tr.cells[3].innerText;
        const cargas = tr.cells[4].innerText;
        const fornecedor = tr.cells[8].innerText; 
        const tipo = tr.cells[9].innerText;       
        
        const cores = getCoresPorTipoCard(tipo);

        html += `
            <div style="background: ${cores.bg}; color: ${cores.text}; padding: 12px; border-radius: 8px; margin-bottom: 10px; border: 1px solid rgba(0,0,0,0.1); box-shadow: 2px 2px 5px rgba(0,0,0,0.05);">
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(0,0,0,0.1); padding-bottom: 5px; margin-bottom: 8px; font-size: 14px;">
                    <b style="color:#c00000;">SENHA: ${senha}</b> <span style="font-size: 12px;">DATA: ${data}</span>
                </div>
                <div style="font-size: 13px; line-height: 1.5;">
                    <b>FORNECEDOR:</b> ${fornecedor}<br>
                    <b>CENTRAL:</b> ${central} | <b>TIPO:</b> ${tipo}<br>
                    <b>REFERENTE:</b> ${cargas}
                </div>
            </div>`;
    });
    
    html += `</div>`;

    const blob = new Blob([html], { type: 'text/html' });
    const clipboardItem = new ClipboardItem({ 'text/html': blob });
    
    navigator.clipboard.write([clipboardItem]).then(() => {
        alert("Agendamentos copiados com sucesso!");
    }).catch(err => {
        console.error("Erro ao copiar:", err);
        alert("Erro ao copiar. Tente novamente.");
    });
};

window.selecionarTudoFiltro = (status) => {
    const checkboxes = document.querySelectorAll('#opcoesFiltro input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = status);
};

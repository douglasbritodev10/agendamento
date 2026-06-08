import { app } from './firebase-config.js';
import { 
    getFirestore, collection, query, where, getDocs, orderBy 
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const db = getFirestore(app);

// Controle de Sessão e Nível de Acesso (ADM)
const usuarioLogin = localStorage.getItem('username') || "SISTEMA";
const userRole = localStorage.getItem('role') || "COLABORADOR"; // Garante bloqueio se não for ADM

document.addEventListener('DOMContentLoaded', () => {
    // Verificação de Segurança de nível ADM
    if (userRole.toUpperCase() !== "ADMIN" && userRole.toUpperCase() !== "ADM") {
        alert("Acesso restrito! Apenas administradores podem visualizar esta página.");
        window.location.href = "cargas-do-dia.html";
        return;
    }

    document.getElementById('userNameDisplay').textContent = usuarioLogin;
    
    // Inicializar datas com o mês corrente
    const hoje = new Date();
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
    const ultimoDia = hoje.toISOString().split('T')[0];
    document.getElementById('dataInicio').value = primeiroDia;
    document.getElementById('dataFim').value = ultimoDia;

    carregarListaFiltroCooperados();
    
    // Fechar dropdown de checkboxes ao clicar fora
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.dropdown-checkbox')) {
            document.getElementById('dropdownCooperados').classList.remove('show');
        }
    });
});

let listaCooperadosBanco = [];
let dadosProcessadosReport = [];
let totaisIndividuaisReport = {};

// Carrega os nomes dos cooperados para compor o Dropdown Inteligente
async function carregarListaFiltroCooperados() {
    try {
        const querySnapshot = await getDocs(collection(db, "cooperados"));
        listaCooperadosBanco = querySnapshot.docs
            .map(doc => doc.data().nome)
            .sort((a, b) => a.localeCompare(b.nome));

        const container = document.getElementById('listaCheckCooperados');
        container.innerHTML = listaCooperadosBanco.map(nome => `
            <div class="dropdown-item">
                <input type="checkbox" class="chk-cooperado-filtro" value="${nome}" onchange="atualizarLabelDropdown()">
                <span>${nome}</span>
            </div>
        `).join('');
    } catch (error) {
        console.error("Erro ao carregar cooperados:", error);
    }
}

// Funções expostas no Objeto window para os triggers inline do HTML
window.toggleDropdown = () => {
    document.getElementById('dropdownCooperados').classList.toggle('show');
};

window.marcarTodosCooperados = (status) => {
    document.querySelectorAll('.chk-cooperado-filtro').forEach(ck => ck.checked = status);
    window.atualizarLabelDropdown();
};

window.atualizarLabelDropdown = () => {
    const selecionados = Array.from(document.querySelectorAll('.chk-cooperado-filtro:checked'));
    const label = document.getElementById('dropdownLabel');
    if (selecionados.length === 0) {
        label.textContent = "Todos os Cooperados";
    } else if (selecionados.length === listaCooperadosBanco.length) {
        label.textContent = "Todos Selecionados";
        document.getElementById('chkTodos').checked = true;
    } else {
        label.textContent = `${selecionados.length} Cooperado(s) Selecionado(s)`;
        document.getElementById('chkTodos').checked = false;
    }
};

// Gerador Matemático do Relatório
window.gerarRelatorio = async () => {
    const dataInicio = document.getElementById('dataInicio').value;
    const dataFim = document.getElementById('dataFim').value;

    if (!dataInicio || !dataFim) {
        alert("Por favor, preencha o período inicial e final.");
        return;
    }

    // Coleta filtros de cooperados selecionados (se vazio, considera TODOS)
    const cooperadosSelecionados = Array.from(document.querySelectorAll('.chk-cooperado-filtro:checked')).map(cb => cb.value);

    try {
        // Query buscando agendamentos dentro do Range de Data
        const q = query(
            collection(db, "agendamentos"), 
            where("data", ">=", dataInicio), 
            where("data", "<=", dataFim),
            orderBy("data", "asc")
        );
        
        const querySnapshot = await getDocs(q);
        const agendas = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        // Filtrar apenas agendas que contenham cooperados associados e valor de descarga maior que zero
        dadosProcessadosReport = agendas.filter(a => {
            const temCooperados = a.cooperados && Array.from(a.cooperados).length > 0;
            const valorValido = parseFloat(a.valorDescarga) > 0;
            
            // Se o usuário filtrou nomes, valida se algum participante da descarga está na lista filtrada
            if (cooperadosSelecionados.length > 0 && temCooperados) {
                const encontrou = a.cooperados.some(nome => cooperadosSelecionados.includes(nome));
                return temCooperados && valorValido && encontrou;
            }
            return temCooperados && valorValido;
        });

        if (dadosProcessadosReport.length === 0) {
            alert("Nenhuma movimentação de carga com cooperados encontrada neste período.");
            limparResultados();
            return;
        }

        renderizarTabelasTela();
    } catch (e) {
        console.error("Erro ao gerar relatório:", e);
        alert("Erro ao buscar dados do banco.");
    }
};

function limparResultados() {
    document.getElementById('botoesExportacao').style.display = 'none';
    document.getElementById('secaoAgrupado').style.display = 'none';
    document.getElementById('secaoIndividual').style.display = 'none';
}

function renderizarTabelasTela() {
    const corpoAgrupado = document.getElementById('corpoAgrupado');
    const corpoIndividual = document.getElementById('corpoIndividual');
    
    corpoAgrupado.innerHTML = "";
    corpoIndividual.innerHTML = "";
    
    totaisIndividuaisReport = {};
    let dataReferenciaAnterior = "";
    let classeEstiloDia = "dia-par";

    dadosProcessadosReport.forEach(agenda => {
        const dataFormatada = formatarDataBR(agenda.data);
        
        // Altera a cor de fundo das linhas baseado na mudança de data para organização visual (PDF compliance)
        if (agenda.data !== dataReferenciaAnterior) {
            classeEstiloDia = (classeEstiloDia === "dia-par") ? "dia-impar" : "dia-par";
            dataReferenciaAnterior = agenda.data;
        }

        const valorTotal = parseFloat(agenda.valorDescarga) || 0;
        const valorLíquidoSetenta = valorTotal * 0.70; // Desconto corporativo de 30% Simonetti
        const listaEquipe = agenda.cooperados || [];
        const qtdParticipantes = listaEquipe.length;

        // Cálculos individuais baseados na planilha (Valor por Cada + 20% INSS)
        const quotaParteBruta = valorLíquidoSetenta / qtdParticipantes;
        const inssCalculado = quotaParteBruta * 0.20;
        const liquidoTotalIndividual = quotaParteBruta + inssCalculado;

        // Inserção na Tabela Agrupada
        const trAgrupado = document.createElement('tr');
        trAgrupado.className = classeEstiloDia;
        trAgrupado.innerHTML = `
            <td data-label="Data">${dataFormatada}</td>
            <td data-label="Fornecedor">${agenda.fornecedor || 'N/A'}</td>
            <td data-label="Valor Total (R$)">R$ ${valorTotal.toFixed(2)}</td>
            <td data-label="Líquido (70%)">R$ ${valorLíquidoSetenta.toFixed(2)}</td>
            <td data-label="Qtd. Transbordo" class="fw-bold">${qtdParticipantes} Coops.</td>
            <td data-label="Nomes dos Cooperados">${listaEquipe.join(', ')}</td>
        `;
        corpoAgrupado.appendChild(trAgrupado);

        // Somatório da carteira individual de cada cooperado participante
        listaEquipe.forEach(nome => {
            if (!totaisIndividuaisReport[nome]) {
                totaisIndividuaisReport[nome] = { bruto: 0, inss: 0, liquido: 0 };
            }
            totaisIndividuaisReport[nome].bruto += quotaParteBruta;
            totaisIndividuaisReport[nome].inss += inssCalculado;
            totaisIndividuaisReport[nome].liquido += liquidoTotalIndividual;
        });
    });

    // Renderização do Relatório Individual final
    Object.keys(totaisIndividuaisReport).sort().forEach(nome => {
        const item = totaisIndividuaisReport[nome];
        const trIndiv = document.createElement('tr');
        trIndiv.innerHTML = `
            <td data-label="Nome do Cooperado" class="fw-bold"><i class="fas fa-user-circle"></i> ${nome}</td>
            <td data-label="Valor Bruto Rateado (R$)" class="text-end">R$ ${item.bruto.toFixed(2)}</td>
            <td data-label="INSS Próprio (+20%)" class="text-end" style="color: #c62828;">R$ ${item.inss.toFixed(2)}</td>
            <td data-label="Líquido Final a Receber (R$)" class="text-end fw-bold" style="color: #2e7d32;">R$ ${item.liquido.toFixed(2)}</td>
        `;
        corpoIndividual.appendChild(trIndiv);
    });

    // Exibe os containers ocultos
    document.getElementById('botoesExportacao').style.display = 'flex';
    document.getElementById('secaoAgrupado').style.display = 'block';
    document.getElementById('secaoIndividual').style.display = 'block';
}

function formatarDataBR(dataString) {
    if(!dataString) return "";
    const partes = dataString.split('-');
    if(partes.length !== 3) return dataString;
    return `${partes[2]}/${partes[1]}/${partes[0]}`; // Retorno DD/MM/YYYY preferencial do usuário
}

// ==================== ENGINE DE EXPORTAÇÃO EXCEL ====================
window.exportarExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Fechamento de Cooperados');

    // Cabeçalho da Empresa
    sheet.mergeCells('A1:F1');
    const headerCell = sheet.getCell('A1');
    headerCell.value = "MÓVEIS SIMONETTI - RELATÓRIO DE REPASSE DE COOPERADOS";
    headerCell.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FFFFFF' } };
    headerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D32F2F' } };
    headerCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 40;

    // Linha de Informações de Filtro
    sheet.mergeCells('A2:F2');
    sheet.getCell('A2').value = `Período Analisado: ${formatarDataBR(document.getElementById('dataInicio').value)} até ${formatarDataBR(document.getElementById('dataFim').value)}`;
    sheet.getCell('A2').font = { italic: true, size: 11 };

    // Tabela 1: Resumo das Cargas
    sheet.addRow([]); // Pula Linha
    const rowTitle1 = sheet.addRow(["1. Detalhamento de Lançamentos e Movimentações"]);
    rowTitle1.getCell(1).font = { bold: true, size: 12 };
    
    const headersT1 = ["Data", "Fornecedor", "Valor Total Carga", "Líquido Rateio (70%)", "Participantes", "Equipe Escalada"];
    const headerRowT1 = sheet.addRow(headersT1);
    headerRowT1.eachCell(c => {
        c.font = { bold: true, color: { argb: 'FFFFFF' } };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '424242' } };
    });

    dadosProcessadosReport.forEach(agenda => {
        sheet.addRow([
            formatarDataBR(agenda.data),
            agenda.fornecedor,
            parseFloat(agenda.valorDescarga),
            parseFloat(agenda.valorDescarga) * 0.7,
            agenda.cooperados.length,
            agenda.cooperados.join(', ')
        ]);
    });

    // Formata números da Tabela 1
    sheet.eachRow((row, rowNumber) => {
        if(rowNumber > 5 && row.getCell(3).value) {
            row.getCell(3).numberFormat = '"R$"#,##0.00';
            row.getCell(4).numberFormat = '"R$"#,##0.00';
        }
    });

    // REQUISITO EXPLICITO: Saltar linha conforme espaço de divisão entre as tabelas
    sheet.addRow([]);
    sheet.addRow([]);

    // Tabela 2: Resumo Individual Final
    const rowTitle2 = sheet.addRow(["2. Demonstrativo de Acerto por Cooperado (Individual)"]);
    rowTitle2.getCell(1).font = { bold: true, size: 12 };

    const headersT2 = ["Nome do Cooperado", "Valor Quota Parte (Bruto)", "Adicional INSS (20%)", "Total Líquido a Receber", "", ""];
    const headerRowT2 = sheet.addRow(headersT2);
    headerRowT2.eachCell(c => {
        c.font = { bold: true, color: { argb: 'FFFFFF' } };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1B5E20' } };
    });

    Object.keys(totaisIndividuaisReport).sort().forEach(nome => {
        const item = totaisIndividuaisReport[nome];
        sheet.addRow([
            nome,
            item.bruto,
            item.inss,
            item.liquido
        ]);
    });

    // Formata números da Tabela 2
    let totalGeralRepasse = 0;
    sheet.eachRow((row, rowNumber) => {
        if(rowNumber > dadosProcessadosReport.length + 8 && row.getCell(2).value) {
            row.getCell(2).numberFormat = '"R$"#,##0.00';
            row.getCell(3).numberFormat = '"R$"#,##0.00';
            row.getCell(4).numberFormat = '"R$"#,##0.00';
            if(typeof row.getCell(4).value === 'number') {
                totalGeralRepasse += row.getCell(4).value;
            }
        }
    });

    // Adiciona Linha de Totalizador Geral do Fechamento
    sheet.addRow([]);
    const linhaTotal = sheet.addRow(["TOTAL GERAL A SER PAGO:", "", "", totalGeralRepasse]);
    linhaTotal.getCell(1).font = { bold: true };
    linhaTotal.getCell(4).font = { bold: true, color: { argb: 'B71C1C' } };
    linhaTotal.getCell(4).numberFormat = '"R$"#,##0.00';

    // Auto-ajuste de colunas para legibilidade
    sheet.columns.forEach(column => {
        let maxLen = 0;
        column.eachCell({ includeEmpty: true }, cell => {
            const valLen = cell.value ? cell.value.toString().length : 0;
            if (valLen > maxLen) maxLen = valLen;
        });
        column.width = maxLen < 15 ? 15 : maxLen + 3;
    });

    // Download do arquivo Excel
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Relatorio_Fechamento_Cooperados_${document.getElementById('dataInicio').value}_a_${document.getElementById('dataFim').value}.xlsx`;
    link.click();
};

// ==================== ENGINE DE EXPORTAÇÃO PDF ====================
window.exportarPDF = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'pt', 'a4');

    // Cabeçalho institucional do PDF
    doc.setFillColor(211, 47, 47); // Vermelho Simonetti Primary
    doc.rect(0, 0, 595, 60, 'F');
    
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text("MÓVEIS SIMONETTI - LOGÍSTICA E SUPRIMENTOS", 40, 36);
    
    doc.setFontSize(10);
    doc.setFont("Helvetica", "normal");
    doc.text(`Relatório Gerencial de Pagamento de Cooperados | Emitido por: ${usuarioLogin}`, 40, 50);

    // Texto de escopo do período
    doc.setTextColor(51, 51, 51);
    doc.setFontSize(11);
    doc.setFont("Helvetica", "bold");
    doc.text(`Período de Apuração: ${formatarDataBR(document.getElementById('dataInicio').value)} até ${formatarDataBR(document.getElementById('dataFim').value)}`, 40, 90);

    // Tabela 1: Lançamentos Agrupados por Dia
    doc.text("1. Detalhamento das Movimentações de Descarga", 40, 115);
    
    const columnsT1 = ["Data", "Fornecedor", "Total (R$)", "Líq 70% (R$)", "Qtd", "Equipe"];
    let dataReferenciaAnteriorPDF = "";
    let flagDiaAlternado = false;

    const rowsT1 = dadosProcessadosReport.map(agenda => {
        // REQUISITO EXPLÍCITO: No PDF o fundo das linhas muda conforme o dia de lançamento
        if (agenda.data !== dataReferenciaAnteriorPDF) {
            flagDiaAlternado = !flagDiaAlternado;
            dataReferenciaAnteriorPDF = agenda.data;
        }
        return [
            formatarDataBR(agenda.data),
            agenda.fornecedor,
            agenda.valorDescarga.toFixed(2),
            (agenda.valorDescarga * 0.70).toFixed(2),
            agenda.cooperados.length,
            agenda.cooperados.join(', ')
        ];
    });

    doc.autoTable({
        startY: 125,
        head: [columnsT1],
        body: rowsT1,
        theme: 'striped',
        headStyles: { fillColor: [66, 66, 66], fontStyle: 'bold' },
        styles: { fontSize: 8 },
        columnStyles: {
            5: { cellWidth: 200 } // Dá mais espaço para caber a listagem dos nomes
        },
        didParseCell: function(data) {
            // Aplicação da regra de coloração dinâmica baseada na mudança de DIA
            if (data.section === 'body') {
                const dataRowIndex = data.row.index;
                let refData = dadosProcessadosReport[dataRowIndex].data;
                
                // Calcula mudancas
                let todasDatas = dadosProcessadosReport.map(d => d.data);
                let listaDatasUnicas = [...new Set(todasDatas)];
                let indiceData = listaDatasUnicas.indexOf(refData);

                if (indiceData % 2 === 0) {
                    data.cell.styles.fillColor = [255, 255, 255]; // Branco para dias pares
                } else {
                    data.cell.styles.fillColor = [240, 244, 250]; // Azul bem claro para dias ímpares
                }
            }
        }
    });

    // Tabela 2: Relatório Individual de Repasse
    let currentY = doc.lastAutoTable.finalY + 30;
    doc.setFont("Helvetica", "bold");
    doc.text("2. Demonstrativo Líquido de Repasse Individual", 40, currentY);

    const columnsT2 = ["Nome do Cooperado Cooperado", "Quota Parte Rateio (R$)", "INSS Próprio +20% (R$)", "Líquido Líquido a Pagar (R$)"];
    const rowsT2 = Object.keys(totaisIndividuaisReport).sort().map(nome => {
        const item = totaisIndividuaisReport[nome];
        return [
            nome,
            item.bruto.toFixed(2),
            item.inss.toFixed(2),
            item.liquido.toFixed(2)
        ];
    });

    doc.autoTable({
        startY: currentY + 10,
        head: [columnsT2],
        body: rowsT2,
        theme: 'grid',
        headStyles: { fillColor: [46, 125, 50], fontStyle: 'bold' }, // Verde para fechamento financeiro
        styles: { fontSize: 9 },
        columnStyles: {
            1: { halign: 'right' },
            2: { halign: 'right' },
            3: { halign: 'right', fontStyle: 'bold' }
        }
    });

    // Assinatura de auditoria no rodapé
    let finalY = doc.lastAutoTable.finalY + 50;
    if(finalY > 750) { doc.addPage(); finalY = 60; }
    
    doc.line(40, finalY, 240, finalY);
    doc.text("Assinatura do Conferente (ADM)", 40, finalY + 15);

    doc.save(`Relatorio_Gerencial_Cooperados_${document.getElementById('dataInicio').value}.pdf`);
};

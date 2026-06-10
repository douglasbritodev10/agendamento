import { app } from './firebase-config.js';
import { 
    getFirestore, collection, query, where, getDocs 
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const db = getFirestore(app);

// Recupera os dados iniciais salvos no navegador
let usuarioLogin = localStorage.getItem('username') || "SISTEMA";
let userRole = localStorage.getItem('role') || "COLABORADOR"; 

document.addEventListener('DOMContentLoaded', async () => {
    
    // ==========================================
    // TRAVA DE SEGURANÇA & PERSISTÊNCIA DE TELA
    // ==========================================
    if (usuarioLogin !== "SISTEMA") {
        try {
            const qUser = query(collection(db, "users"), where("username", "==", usuarioLogin.toUpperCase()));
            const querySnapshotUser = await getDocs(qUser);
            
            if (!querySnapshotUser.empty) {
                const dadosUsuario = querySnapshotUser.docs[0].data();
                userRole = dadosUsuario.nivelAcesso || "COLABORADOR";
                localStorage.setItem('role', userRole);
            }
        } catch (error) {
            console.error("Erro ao validar credenciais no Firestore:", error);
        }
    }

    // Validação final do Nível de Acesso
    if (userRole.toUpperCase() !== "ADM") {
        alert("Acesso restrito! Apenas administradores podem visualizar esta página.");
        window.location.href = "index.html";
        return;
    }

    // Exibe o nome do usuário na tela
    document.getElementById('user-display').textContent = usuarioLogin;
    
    // Inicializa campos de data vazios
    document.getElementById('dataInicio').value = "";
    document.getElementById('dataFim').value = "";

    carregarListaFiltroCooperados();
    
    // Fechar dropdown de checkboxes ao clicar fora
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.dropdown-checkbox')) {
            const drop = document.getElementById('dropdownCooperados');
            if(drop) drop.classList.remove('show');
        }
    });
});

let listaCooperadosBanco = [];
let dadosProcessadosReport = [];
let totaisIndividuaisReport = {};
let todasAgendasDoPeriodo = [];

// Carrega os nomes dos cooperados para compor o Dropdown
async function carregarListaFiltroCooperados() {
    try {
        const querySnapshot = await getDocs(collection(db, "cooperados"));
        listaCooperadosBanco = querySnapshot.docs
            .map(doc => doc.data().nome)
            .filter(nome => nome)
            .sort((a, b) => a.localeCompare(b));

        const container = document.getElementById('listaCheckCooperados');
        if (!container) return;
        
        container.innerHTML = listaCooperadosBanco.map(nome => `
            <div class="dropdown-item">
                <input type="checkbox" class="chk-cooperado-filtro" value="${nome}" onchange="window.atualizarLabelDropdown()">
                <span>${nome}</span>
            </div>
        `).join('');
    } catch (error) {
        console.error("Erro ao carregar cooperados:", error);
    }
}

// Funções expostas no Objeto window
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
    const chkTodos = document.getElementById('chkTodos');
    
    if (!label) return;

    if (selecionados.length === 0) {
        label.textContent = "Todos os Cooperados";
    } else if (selecionados.length === listaCooperadosBanco.length) {
        label.textContent = "Todos Selecionados";
        if(chkTodos) chkTodos.checked = true;
    } else {
        label.textContent = `${selecionados.length} Cooperado(s) Selecionado(s)`;
        if(chkTodos) chkTodos.checked = false;
    }

    if (todasAgendasDoPeriodo.length > 0) {
        window.aplicarFiltroEmTempoReal();
    }
};

// Gerador do Relatório adaptado para a sua estrutura real
window.gerarRelatorio = async () => {
    const dataInicioRaw = document.getElementById('dataInicio').value;
    const dataFimRaw = document.getElementById('dataFim').value;

    if (!dataInicioRaw || !dataFimRaw) {
        alert("Por favor, preencha o período inicial e final.");
        return;
    }

    // Garante o formato YYYY-MM-DD para busca no Firestore
    const dataInicio = dataInicioRaw.split('T')[0];
    const dataFim = dataFimRaw.split('T')[0];

    try {
        // Traz apenas o status "Agendada" direto do Banco de Dados
        const q = query(
            collection(db, "agendamentos"), 
            where("data", ">=", dataInicio), 
            where("data", "<=", dataFim),
            where("status", "==", "Agendada")
        );
        
        const querySnapshot = await getDocs(q);
        const agendas Cruas = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        // Filtragem local complementar: valorDescarga > 0
        const agendasValidas = agendasCruas.filter(a => {
            const valor = parseFloat(a.valorDescarga) || 0;
            return valor > 0;
        });

        // --- LÓGICA DE TRATAMENTO DE VEÍCULO AGRUPADO ---
        const gruposVeiculo = {};

        agendasValidas.forEach(a => {
            // Se tiver veículo agrupado usa o identificador dele, senhas individuais usam o próprio ID da senha
            const chaveGrupo = (a.veiculoAgrupado && a.veiculoAgrupado.trim() !== "") 
                ? `GRP_${a.veiculoAgrupado.trim().toUpperCase()}` 
                : `IND_${a.id}`;

            // Tratamento da string de equipe para Array
            let listaEquipe = [];
            if (a.equipe && typeof a.equipe === 'string') {
                listaEquipe = a.equipe.split(',').map(n => n.trim()).filter(n => n.length > 0);
            } else if (Array.isArray(a.equipe)) {
                listaEquipe = a.equipe;
            }

            if (!gruposVeiculo[chaveGrupo]) {
                gruposVeiculo[chaveGrupo] = {
                    data: a.data,
                    fornecedor: a.fornecedor || "N/A",
                    valorDescarga: 0,
                    cooperadosArray: listaEquipe,
                    senhas: [a.senhaAgendamento || "N/A"]
                };
            } else {
                // Se for o mesmo veículo agrupado, vai somando o valor da descarga das senhas juntas
                if (a.senhaAgendamento && !gruposVeiculo[chaveGrupo].senhas.includes(a.senhaAgendamento)) {
                    gruposVeiculo[chaveGrupo].senhas.push(a.senhaAgendamento);
                }
                // Mescla os cooperados caso venham mapeados separados (garante nomes únicos)
                listaEquipe.forEach(nome => {
                    if (!gruposVeiculo[chaveGrupo].cooperadosArray.includes(nome)) {
                        gruposVeiculo[chaveGrupo].cooperadosArray.push(nome);
                    }
                });
            }
            gruposVeiculo[chaveGrupo].valorDescarga += parseFloat(a.valorDescarga) || 0;
        });

        // Transforma o objeto de agrupamentos de volta em Array para o relatório
        todasAgendasDoPeriodo = Object.values(gruposVeiculo);

        // Chama a renderização dinâmica
        window.aplicarFiltroEmTempoReal();

    } catch (e) {
        console.error("Erro ao gerar relatório:", e);
        alert("Erro ao buscar dados do banco de dados. Verifique o console (F12).");
    }
};

window.aplicarFiltroEmTempoReal = () => {
    const cooperadosSelecionados = Array.from(document.querySelectorAll('.chk-cooperado-filtro:checked')).map(cb => cb.value);

    dadosProcessadosReport = todasAgendasDoPeriodo
        .filter(a => {
            const temCooperados = a.cooperadosArray && a.cooperadosArray.length > 0;
            
            if (cooperadosSelecionados.length > 0) {
                // Filtra para exibir apenas se o cooperado selecionado participou daquela equipe
                return temCooperados && a.cooperadosArray.some(nome => cooperadosSelecionados.includes(nome));
            }
            return temCooperados;
        })
        .sort((a, b) => (a.data || "").localeCompare(b.data || ""));

    if (dadosProcessadosReport.length === 0) {
        window.limparResultados();
        return;
    }

    window.renderizarTabelasTela();
};

window.limparResultados = () => {
    document.getElementById('botoesExportacao').style.display = 'none';
    document.getElementById('secaoAgrupado').style.display = 'none';
    document.getElementById('secaoIndividual').style.display = 'none';
};

window.renderizarTabelasTela = () => {
    const corpoAgrupado = document.getElementById('corpoAgrupado');
    const corpoIndividual = document.getElementById('corpoIndividual');
    
    corpoAgrupado.innerHTML = "";
    corpoIndividual.innerHTML = "";
    
    totaisIndividuaisReport = {};
    let dataReferenciaAnterior = "";
    let classeEstiloDia = "dia-par";

    dadosProcessadosReport.forEach(agenda => {
        const dataFormatada = window.formatarDataBR(agenda.data);
        
        if (agenda.data !== dataReferenciaAnterior) {
            classeEstiloDia = (classeEstiloDia === "dia-par") ? "dia-impar" : "dia-par";
            dataReferenciaAnterior = agenda.data;
        }

        const valorTotal = agenda.valorDescarga;
        const valorLíquidoSetenta = valorTotal * 0.70; 
        const listaEquipe = agenda.cooperadosArray || [];
        const qtdParticipantes = listaEquipe.length;

        // Evita divisão por zero se a equipe estiver vazia no cadastro
        const quotaParteBruta = qtdParticipantes > 0 ? (valorLíquidoSetenta / qtdParticipantes) : 0;
        const inssCalculado = quotaParteBruta * 0.20;
        const liquidoTotalIndividual = quotaParteBruta + inssCalculado;

        const trAgrupado = document.createElement('tr');
        trAgrupado.className = classeEstiloDia;
        trAgrupado.innerHTML = `
            <td data-label="Data">${dataFormatada}</td>
            <td data-label="Fornecedor">${agenda.fornecedor || 'N/A'}</td>
            <td data-label="Valor Total (R$)">R$ ${valorTotal.toFixed(2)}</td>
            <td data-label="Líquido (70%)">R$ ${valorLíquidoSetenta.toFixed(2)}</td>
            <td data-label="Qtd. Transbordo" class="fw-bold">${qtdParticipantes} Coops.</td>
            <td data-label="Nomes dos Cooperados">${listaEquipe.join(', ') || 'Nenhum'}</td>
        `;
        corpoAgrupado.appendChild(trAgrupado);

        listaEquipe.forEach(nome => {
            if (!totaisIndividuaisReport[nome]) {
                totaisIndividuaisReport[nome] = { bruto: 0, inss: 0, liquido: 0 };
            }
            totaisIndividuaisReport[nome].bruto += quotaParteBruta;
            totaisIndividuaisReport[nome].inss += inssCalculado;
            totaisIndividuaisReport[nome].liquido += liquidoTotalIndividual;
        });
    });

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

    document.getElementById('botoesExportacao').style.display = 'flex';
    document.getElementById('secaoAgrupado').style.display = 'block';
    document.getElementById('secaoIndividual').style.display = 'block';
};

window.formatarDataBR = (dataString) => {
    if(!dataString) return "";
    const partes = dataString.split('-');
    if(partes.length !== 3) return dataString;
    return `${partes[2]}/${partes[1]}/${partes[0]}`; 
};

// ==================== ENGINE DE EXPORTAÇÃO EXCEL ====================
window.exportarExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Fechamento de Cooperados');

    sheet.mergeCells('A1:F1');
    const headerCell = sheet.getCell('A1');
    headerCell.value = "MÓVEIS SIMONETTI - RELATÓRIO DE REPASSE DE COOPERADOS";
    headerCell.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FFFFFF' } };
    headerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D32F2F' } };
    headerCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 40;

    sheet.mergeCells('A2:F2');
    sheet.getCell('A2').value = `Período Analisado: ${window.formatarDataBR(document.getElementById('dataInicio').value)} até ${window.formatarDataBR(document.getElementById('dataFim').value)}`;
    sheet.getCell('A2').font = { italic: true, size: 11 };

    sheet.addRow([]); 
    const rowTitle1 = sheet.addRow(["1. Detalhamento de Lançamentos e Movimentações"]);
    rowTitle1.getCell(1).font = { bold: true, size: 12 };
    
    const headersT1 = ["Data", "Fornecedor", "Valor Total Carga", "Líquido Rateio (70%)", "Participantes", "Equipe Escalada"];
    const headerRowT1 = sheet.addRow(headersT1);
    headerRowT1.eachCell(c => {
        c.font = { bold: true, color: { argb: 'FFFFFF' } };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '424242' } };
    });

    dadosProcessadosReport.forEach(agenda => {
        const equipe = agenda.cooperadosArray || [];
        const r = sheet.addRow([
            window.formatarDataBR(agenda.data),
            agenda.fornecedor,
            agenda.valorDescarga,
            agenda.valorDescarga * 0.7,
            equipe.length,
            equipe.join(', ')
        ]);
        r.getCell(3).numberFormat = '"R$"#,##0.00';
        r.getCell(4).numberFormat = '"R$"#,##0.00';
    });

    sheet.addRow([]);
    sheet.addRow([]);

    const rowTitle2 = sheet.addRow(["2. Demonstrativo de Acerto por Cooperado (Individual)"]);
    rowTitle2.getCell(1).font = { bold: true, size: 12 };

    const headersT2 = ["Nome do Cooperado", "Valor Quota Parte (Bruto)", "Adicional INSS (20%)", "Total Líquido a Receber"];
    const headerRowT2 = sheet.addRow(headersT2);
    headerRowT2.eachCell(c => {
        c.font = { bold: true, color: { argb: 'FFFFFF' } };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1B5E20' } };
    });

    let totalGeralRepasse = 0;

    Object.keys(totaisIndividuaisReport).sort().forEach(nome => {
        const item = totaisIndividuaisReport[nome];
        const r = sheet.addRow([
            nome,
            item.bruto,
            item.inss,
            item.liquido
        ]);
        r.getCell(2).numberFormat = '"R$"#,##0.00';
        r.getCell(3).numberFormat = '"R$"#,##0.00';
        r.getCell(4).numberFormat = '"R$"#,##0.00';
        
        totalGeralRepasse += item.liquido;
    });

    sheet.addRow([]);
    const linhaTotal = sheet.addRow(["TOTAL GERAL A SER PAGO:", "", "", totalGeralRepasse]);
    linhaTotal.getCell(1).font = { bold: true };
    linhaTotal.getCell(4).font = { bold: true, color: { argb: 'B71C1C' } };
    linhaTotal.getCell(4).numberFormat = '"R$"#,##0.00';

    sheet.columns.forEach(column => {
        let maxLen = 0;
        column.eachCell({ includeEmpty: true }, cell => {
            const valLen = cell.value ? cell.value.toString().length : 0;
            if (valLen > maxLen) maxLen = valLen;
        });
        column.width = maxLen < 15 ? 15 : maxLen + 3;
    });

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

    doc.setFillColor(211, 47, 47); 
    doc.rect(0, 0, 595, 60, 'F');
    
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text("MÓVEIS SIMONETTI - LOGÍSTICA E SUPRIMENTOS", 40, 36);
    
    doc.setFontSize(10);
    doc.setFont("Helvetica", "normal");
    doc.text(`Relatório Gerencial de Pagamento de Cooperados | Emitido por: ${usuarioLogin}`, 40, 50);

    doc.setTextColor(51, 51, 51);
    doc.setFontSize(11);
    doc.setFont("Helvetica", "bold");
    doc.text(`Período de Apuração: ${window.formatarDataBR(document.getElementById('dataInicio').value)} até ${window.formatarDataBR(document.getElementById('dataFim').value)}`, 40, 90);

    doc.text("1. Detalhamento das Movimentações de Descarga", 40, 115);
    
    const columnsT1 = ["Data", "Fornecedor", "Total (R$)", "Líq 70% (R$)", "Qtd", "Equipe"];

    const rowsT1 = dadosProcessadosReport.map(agenda => {
        const vDescarga = agenda.valorDescarga;
        const equipe = agenda.cooperadosArray || [];
        return [
            window.formatarDataBR(agenda.data),
            agenda.fornecedor || 'N/A',
            vDescarga.toFixed(2),
            (vDescarga * 0.70).toFixed(2),
            equipe.length,
            equipe.join(', ')
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
            5: { cellWidth: 200 } 
        },
        didParseCell: function(data) {
            if (data.section === 'body') {
                const dataRowIndex = data.row.index;
                let refData = dadosProcessadosReport[dataRowIndex].data;
                
                let todasDatas = dadosProcessadosReport.map(d => d.data);
                let listaDatasUnicas = [...new Set(todasDatas)];
                let indiceData = listaDatasUnicas.indexOf(refData);

                if (indiceData % 2 === 0) {
                    data.cell.styles.fillColor = [255, 255, 255]; 
                } else {
                    data.cell.styles.fillColor = [240, 244, 250]; 
                }
            }
        }
    });

    let currentY = doc.lastAutoTable.finalY + 30;
    doc.setFont("Helvetica", "bold");
    doc.text("2. Demonstrativo Líquido de Repasse Individual", 40, currentY);

    const columnsT2 = ["Nome do Cooperado", "Quota Parte Rateio (R$)", "INSS Próprio +20% (R$)", "Líquido a Pagar (R$)"];
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
        headStyles: { fillColor: [46, 125, 50], fontStyle: 'bold' }, 
        styles: { fontSize: 9 },
        columnStyles: {
            1: { halign: 'right' },
            2: { halign: 'right' },
            3: { halign: 'right', fontStyle: 'bold' }
        }
    });

    let finalY = doc.lastAutoTable.finalY + 50;
    if(finalY > 750) { doc.addPage(); finalY = 60; }
    
    doc.line(40, finalY, 240, finalY);
    doc.text("Assinatura do Conferente (ADM)", 40, finalY + 15);

    doc.save(`Relatorio_Gerencial_Cooperados_${document.getElementById('dataInicio').value}.pdf`);
};

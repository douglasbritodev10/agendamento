import { app } from './firebase-config.js';
import { 
    getFirestore, collection, query, onSnapshot, doc, updateDoc, orderBy, addDoc, serverTimestamp, getDocs 
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const db = getFirestore(app);
const usuarioLogin = localStorage.getItem('username') || "SISTEMA";
let todasAgendasDoBanco = [];
let listaCooperados = [];

const situacoesCores = {
    "CARGA RECEBIDA": '#4CAF50', "NO PATIO - FICOU P/ AMANHÃ": '#3ACFB9', "CANCELADA": '#7a002b',
    "SOB AJUSTE": '#8B27F5', "NO PATIO - SOB ENCAIXE": '#ff7625', "NO PATIO - FICOU DE ONTEM": '#B249BF',
    "EM RECEBIMENTO": '#FFC107', "NO PATIO": '#03A9F4', "EM ATRASO": '#F44336', "REAGENDA": '#9B591B'
};

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('userNameDisplay').textContent = usuarioLogin;
    ouvirDados();
    carregarCooperados(); // Carrega os nomes para o modal
});

// Ajuste para carregar como Checkboxes
async function carregarCooperados() {
    const querySnapshot = await getDocs(collection(db, "cooperados"));
    listaCooperados = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    const container = document.getElementById('listaCheckCooperados');
    container.innerHTML = listaCooperados.map(c => `
        <div style="margin-bottom:5px;">
            <label style="cursor:pointer; display:block;">
                <input type="checkbox" class="check-cooperado" value="${c.nome}"> ${c.nome}
            </label>
        </div>`).join('');
}

// Função auxiliar para marcar/desmarcar todos
window.toggleTodosCooperados = (status) => {
    document.querySelectorAll('.check-cooperado').forEach(ck => ck.checked = status);
};

function ouvirDados() {
    const q = query(collection(db, "agendamentos"), orderBy("data", "desc"));
    onSnapshot(q, (snapshot) => {
        todasAgendasDoBanco = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        renderizarPainelPrincipal();
    });
}

function getCorTipo(tp) {
    const t = (tp || "").toUpperCase();
    if (['ROUPEIRO', 'ARMARIO', 'COZINHA', 'PAINEL', 'MODULO', 'MULTIUSO', 'BALCAO', 'COMODA'].some(x => t.includes(x))) return '#FFFF00';
    if (['CELULAR', 'TABLET', 'RELOGIO', 'ROBO', 'NOTEBOOK'].some(x => t.includes(x))) return '#00BFFF';
    if (t.includes('MESA')) return '#4CAF50';
    return 'transparent';
}

function renderizarPainelPrincipal() {
    const tbody = document.getElementById('tabelaCargas');
    const noPainel = todasAgendasDoBanco.filter(a => a.noPainel === true);
    
    tbody.innerHTML = noPainel.map(c => {
        const options = Object.keys(situacoesCores).map(s => 
            `<option value="${s}" ${c.agendasituacao === s ? 'selected' : ''}>${s}</option>`).join('');

        const tipoExibicao = c.tipo || c.tipoProduto || '';
        const infoCarga = c.veiculoAgrupado ? `<br><small style="color:blue;"><b>🚚 ${c.veiculoAgrupado}</b></small>` : '';

        return `
            <tr>
                <td style="text-align:center;"><input type="checkbox" class="check-export" value="${c.id}"></td>
                <td><b>${c.senhaAgendamento || ''}</b>${infoCarga}</td>
                <td>${c.data || ''}</td>
                <td>${c.central || ''}</td>
                <td style="font-size:10px; max-width:200px;">${c.cargas || ''}</td>
                <td style="width:180px;"> 
                    <select class="select-situacao" onchange="atualizarCampo('${c.id}', 'agendasituacao', this.value)" 
                        style="background:${situacoesCores[c.agendasituacao] || '#999'};">
                        <option value="">PENDENTE</option>${options}
                    </select>
                </td>
                <td>${c.fornecedor || ''}</td>
                <td style="background-color:${getCorTipo(tipoExibicao)}; font-weight:bold; text-align:center;">
                    ${tipoExibicao}
                </td>
                <td><input type="text" value="${c.box || ''}" onchange="atualizarCampo('${c.id}', 'box', this.value)" style="width:50px; text-align:center;"></td>
                <td>
                    <button onclick="removerDoPainel('${c.id}')" style="color:red; border:none; background:none; cursor:pointer;"><i class="fas fa-eye-slash fa-lg"></i></button>
                </td>
            </tr>`;
    }).join('');

    document.getElementById('totalAgendas').textContent = noPainel.length;
    // Lógica para contar veículos: considera senhas únicas ou veículos agrupados
    const veiculosUnicos = new Set(noPainel.map(p => p.veiculoAgrupado || p.senhaAgendamento));
    document.getElementById('totalVeiculos').textContent = veiculosUnicos.size;
}

// --- LÓGICA DE SELEÇÃO E AÇÕES EM MASSA ---

window.toggleAllPainel = (status) => {
    document.querySelectorAll('.check-export').forEach(ck => ck.checked = status);
};

window.removerSelecionados = async () => {
    const selecionados = Array.from(document.querySelectorAll('.check-export:checked')).map(cb => cb.value);
    if (selecionados.length === 0) return alert("Selecione os itens que deseja remover!");
    
    if (confirm(`Remover ${selecionados.length} agendamentos do painel?`)) {
        for (let id of selecionados) {
            await updateDoc(doc(db, "agendamentos", id), { noPainel: false });
        }
        document.getElementById('selectAllPainel').checked = false;
    }
};

// Função para unir várias agendas em uma "Carga" (Veículo)
window.agruparEmCarga = async () => {
    const selecionados = Array.from(document.querySelectorAll('.check-export:checked')).map(cb => cb.value);
    if (selecionados.length < 2) return alert("Selecione ao menos 2 agendas para unir em uma carga!");

    const identificadorCarga = prompt("Informe uma identificação para este veículo/carga (Ex: PLACA ou NOME DO MOTORISTA):");
    if (!identificadorCarga) return;

    try {
        for (let id of selecionados) {
            await updateDoc(doc(db, "agendamentos", id), { 
                veiculoAgrupado: identificadorCarga.toUpperCase(),
                agendasituacao: "NO PATIO" // Status automático ao identificar veículo
            });
        }
        alert("Agendas unidas com sucesso!");
        document.getElementById('selectAllPainel').checked = false;
    } catch (e) {
        alert("Erro ao agrupar.");
    }
};

window.copiarSelecionados = () => {
    const checks = Array.from(document.querySelectorAll('.check-export:checked'));
    if (checks.length === 0) return alert("Selecione os agendamentos primeiro!");

    let html = `<div style="font-family: Arial, sans-serif; max-width: 450px;">`;
    
    checks.forEach(cb => {
        const tr = cb.closest('tr');
        const senha = tr.cells[1].innerText;
        const data = tr.cells[2].innerText;
        const central = tr.cells[3].innerText;
        const cargas = tr.cells[4].innerText;
        const fornecedor = tr.cells[6].innerText;
        const tipo = tr.cells[7].innerText;

        html += `
            <div style="background: #f9f9f9; padding: 10px; border-radius: 8px; margin-bottom: 8px; border: 1px solid #ccc;">
                <b>SENHA: ${senha}</b> | DATA: ${data}<br>
                <b>FORNECEDOR:</b> ${fornecedor}<br>
                <b>TIPO:</b> ${tipo} | <b>CENTRAL:</b> ${central}<br>
                <small>REF: ${cargas}</small>
            </div>`;
    });
    html += `</div>`;

    const blob = new Blob([html], { type: 'text/html' });
    const data = [new ClipboardItem({ 'text/html': blob })];
    navigator.clipboard.write(data).then(() => alert("Dados copiados para o rascunho!"));
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

// Ajuste para abrir o modal limpando ou marcando os existentes
window.abrirModalAcerto = (id, senha, equipeExistente, valorExistente) => {
    document.getElementById('idAgendamentoAcerto').value = id;
    document.getElementById('senhaAgendamentoAcerto').value = senha;
    document.getElementById('valorDescarga').value = valorExistente;
    document.getElementById('checkTodosCooperados').checked = false;

    // Converte a string de equipe em array para marcar os checks
    const equipesArray = equipeExistente ? equipeExistente.split(', ') : [];
    document.querySelectorAll('.check-cooperado').forEach(ck => {
        ck.checked = equipesArray.includes(ck.value);
    });

    document.getElementById('modalAcerto').style.display = 'flex';
};

// Ajuste para salvar unindo os nomes selecionados
window.salvarAcerto = async () => {
    const id = document.getElementById('idAgendamentoAcerto').value;
    const senha = document.getElementById('senhaAgendamentoAcerto').value;
    const valor = document.getElementById('valorDescarga').value;

    // Coleta todos os nomes marcados
    const selecionados = Array.from(document.querySelectorAll('.check-cooperado:checked'))
                              .map(ck => ck.value);
    
    const equipeString = selecionados.join(', ');

    if (selecionados.length === 0 || !valor) {
        alert("Selecione ao menos um colaborador e informe o valor!");
        return;
    }

    try {
        await updateDoc(doc(db, "agendamentos", id), {
            equipe: equipeString,
            valorDescarga: valor
        });

        await addDoc(collection(db, "historico"), {
            usuario: usuarioLogin,
            acao: "ACERTO MULTIPLO DESCARGA",
            detalhe: `Equipe: ${equipeString} | Valor: R$ ${valor}`,
            senha: senha,
            dataHora: serverTimestamp()
        });

        fecharModais();
        alert("Acerto salvo com sucesso!");
    } catch (e) {
        console.error(e);
        alert("Erro ao salvar.");
    }
};

window.filtrarModal = () => {
    const dataFiltro = document.getElementById('filtroDataModal').value;
    const busca = document.getElementById('buscaTextoModal').value.toUpperCase();
    let dataBR = dataFiltro ? dataFiltro.split('-').reverse().join('/') : "";

    document.querySelectorAll('.linha-modal').forEach(tr => {
        const bateData = dataBR === "" || tr.getAttribute('data-data') === dataBR;
        const bateTexto = busca === "" || tr.getAttribute('data-txt').toUpperCase().includes(busca);
        tr.style.display = (bateData && bateTexto) ? '' : 'none';
    });
};

window.abrirModalSelecao = () => {
    const lista = todasAgendasDoBanco.filter(a => !a.noPainel);
    document.getElementById('corpoBuscaModal').innerHTML = lista.map(a => `
        <tr class="linha-modal" data-data="${a.data}" data-txt="${a.senha} ${a.fornecedor}">
            <td><input type="checkbox" class="check-item" value="${a.id}" data-senha="${a.senha}"></td>
            <td><b>${a.senhaAgendamento}</b></td>
            <td>${a.data}</td>
            <td style="font-size:10px;">${a.cargas || ''}</td>
            <td>${a.agendasituacao || 'PENDENTE'}</td>
            <td>${a.fornecedor}</td>
            <td>${a.tipoProduto}</td>
        </tr>`).join('');
    document.getElementById('modalSelecao').style.display = 'flex';
};

window.atualizarCampo = async (id, campo, valor) => {
    await updateDoc(doc(db, "agendamentos", id), { [campo]: valor.toUpperCase() });
};

window.puxarSelecionados = async () => {
    const checks = document.querySelectorAll('.check-item:checked');
    for(let cb of checks) {
        await updateDoc(doc(db, "agendamentos", cb.value), { noPainel: true });
        await addDoc(collection(db, "historico"), { usuario: usuarioLogin, acao: "ADICIONADO AO PAINEL", senha: cb.dataset.senha, dataHora: serverTimestamp() });
    }
    fecharModais();
};

window.removerDoPainel = async (id) => { if(confirm("Remover do painel?")) await updateDoc(doc(db, "agendamentos", id), { noPainel: false }); };

window.fecharModais = () => {
    document.getElementById('modalSelecao').style.display = 'none';
    document.getElementById('modalAcerto').style.display = 'none';
};

window.toggleAllModal = () => { const s = document.getElementById('selectAll').checked; document.querySelectorAll('.check-item').forEach(c => c.checked = s); };
window.logout = () => { localStorage.clear(); window.location.href = "index.html"; };

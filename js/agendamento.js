import { app } from './firebase-config.js';
import { 
    getFirestore, doc, setDoc, collection, addDoc, onSnapshot, query, orderBy, 
    updateDoc, getDocs, limit, serverTimestamp, deleteDoc, getDoc, where 
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const db = getFirestore(app);
const usuarioNome = localStorage.getItem('usuarioNome') || "DESCONHECIDO";
let itensCargaTmp = []; 
let senhaAbertaNoModal = ""; 

// Mudança aqui: Pegamos o 'username' que o seu auth.js já salva!
const usuarioUsername = localStorage.getItem('username') || "DESCONHECIDO";
const usuarioNomeCompleto = localStorage.getItem('usuarioNome') || "DESCONHECIDO";

async function verificarAcessoADM() {
    const loginParaBusca = usuarioUsername.trim(); 

    if (loginParaBusca === "DESCONHECIDO") {
        window.location.href = "index.html";
        return;
    }

    try {
        // Como o seu auth.js salva o documento pelo UID, precisamos fazer uma QUERY
        // para achar o documento onde o campo 'username' seja igual ao nosso login
        const q = query(collection(db, "users"), where("username", "==", loginParaBusca));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const dadosUser = querySnapshot.docs[0].data();
            
            // EXIBIÇÃO: Mostra o DBRITO no canto superior
            if (document.getElementById('user-display')) {
                document.getElementById('user-display').innerText = dadosUser.username;
            }

            // SEGURANÇA: Verifica se é ADM
            if (dadosUser.nivelAcesso !== "ADM") { 
                alert("ACESSO NEGADO: Somente administradores.");
                window.location.href = "portal.html";
            }
            
            console.log("Autenticado como ADM:", dadosUser.username);

        } else {
            console.error("Usuário não encontrado no Firestore:", loginParaBusca);
            alert(`Usuário "${loginParaBusca}" não encontrado.`);
            window.location.href = "index.html";
        }
    } catch (error) {
        console.error("Erro na validação:", error);
        window.location.href = "index.html";
    }
}

const getDataBR = () => {
    const d = new Date();
    return new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
};

// --- CONFIGURAÇÃO INICIAL ---
// Chamamos a verificação logo de cara
verificarAcessoADM();

document.getElementById('dataAgendamento').value = getDataBR();
document.getElementById('buscaInicio').value = getDataBR();
document.getElementById('buscaFim').value = getDataBR();

const getCoresPorTipo = (tipo) => {
    const t = (tipo || "").toUpperCase();
    if (['ARMARIO','COMODA','PAINEL','MULTIUSO','MODULO','COZINHA','ROUPEIRO'].some(x => t.includes(x))) return { bg: '#FFFF00', text: '#000000', rgb: [255, 255, 0] };
    if (t.includes('MESA')) return { bg: '#4CAF50', text: '#FFFFFF', rgb: [76, 175, 80] };
    if (['CELULAR','TABLET','RELOGIO','NOTEBOOK'].some(x => t.includes(x))) return { bg: '#00BFFF', text: '#FFFFFF', rgb: [0, 191, 255] };
    return { bg: '#FFFFFF', text: '#000000', rgb: [255, 255, 255] };
};

// --- GERAÇÃO DE SENHA ---
async function gerarSenha() {
    const q = query(collection(db, "agendamentos"), orderBy("timestamp", "desc"), limit(10));
    const snap = await getDocs(q);
    let num = 1;
    if (!snap.empty) {
        const numeros = snap.docs.map(d => {
            const s = d.data().senhaAgendamento;
            return s && s.includes('-') ? parseInt(s.split('-')[0]) : 0;
        });
        num = Math.max(...numeros) + 1;
    }
    document.getElementById('senhaAgendamento').value = String(num).padStart(2, '0') + "-SM";
}

// --- SALVAR/RASCUNHO ---
async function salvarAgenda(status) {
    // Re-verifica o nome no momento de salvar
    if (localStorage.getItem('usuarioNome') !== usuarioNome) {
         alert("Tentativa de alteração de identidade detectada!");
         return;
    }
    
    const senha = document.getElementById('senhaAgendamento').value;
    const fornecedor = document.getElementById('selectFornecedor').value;
    if (!fornecedor) return alert("Selecione um fornecedor!");

    const dados = {
        senhaAgendamento: senha,
        data: document.getElementById('dataAgendamento').value,
        central: document.getElementById('central').value,
        fornecedor: fornecedor,
        cargas: document.getElementById('cargas').value,
        pedido: document.getElementById('pedido').value,
        tipoProduto: document.getElementById('tipoProduto').value.toUpperCase(),
        linhaSeparacao: document.getElementById('linhaSeparacao').value,
        status: status,
        composicao: itensCargaTmp, 
        timestamp: serverTimestamp(),
        usuario: usuarioUsername // Salva "DBRITO" em vez do nome completo
    };

    await setDoc(doc(db, "agendamentos", senha), dados, { merge: true });
    alert(status === "Rascunho" ? "Rascunho Salvo!" : "Agendamento Finalizado!");
    resetaForm();
}

// --- COPIAR RASCUNHOS (VERSÃO COMPRIMIDA) ---
window.copiarRascunhosSelecionados = () => {
    const selecionados = Array.from(document.querySelectorAll('.check-copy-rascunho:checked'));
    if (selecionados.length === 0) return alert("Selecione os rascunhos!");

    let html = `<div style="font-family: Arial, sans-serif; max-width: 400px;">`;

    selecionados.forEach(cb => {
        const tr = cb.closest('tr');
        const senha = tr.cells[1].innerText;
        const data = tr.cells[2].innerText;
        const central = tr.cells[3].innerText;
        const cargas = tr.cells[4].innerText;
        const fornecedor = tr.cells[6].innerText;
        const tipo = tr.cells[7].innerText;
        const cores = getCoresPorTipo(tipo);

        html += `
            <div style="background: ${cores.bg}; color: ${cores.text}; padding: 10px; border-radius: 8px; margin-bottom: 8px; border: 1px solid #ccc;">
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(0,0,0,0.1); padding-bottom: 4px; margin-bottom: 4px;">
                    <b>SENHA: ${senha}</b> <span>DATA: ${data}</span>
                </div>
                <div style="font-size: 13px;">
                    <b>FORNECEDOR:</b> ${fornecedor}<br>
                    <b>CENTRAL:</b> ${central} | <b>TIPO:</b> ${tipo}<br>
                    <b>REFERENTE:</b> ${cargas}
                </div>
            </div>`;
    });
    html += `</div>`;

    const blob = new Blob([html], { type: 'text/html' });
    const data = [new ClipboardItem({ 'text/html': blob })];
    navigator.clipboard.write(data).then(() => alert("Copiado em formato comprimido!"));
};

window.toggleSelectAll = (el) => {
    // Seleciona apenas os checkboxes que estão visíveis na tabela de agendamentos definitivos
    const checkboxes = document.querySelectorAll('#corpoTabela .check-export');
    checkboxes.forEach(c => c.checked = el.checked);
};

window.exportarPDF = async (modo) => {
    const { jsPDF } = window.jspdf;
    const docPdf = new jsPDF('p', 'mm', 'a4');
    const selecionados = Array.from(document.querySelectorAll('.check-export:checked')).map(c => c.value);
    
    if (selecionados.length === 0) return alert("Selecione agendamentos!");

    const snap = await getDocs(collection(db, "agendamentos"));
    const agendas = [];
    snap.forEach(d => { if(selecionados.includes(d.id)) agendas.push(d.data()); });

    docPdf.setFillColor(192, 0, 0); 
    docPdf.rect(0, 0, 210, 25, 'F');
    docPdf.setFontSize(18);
    docPdf.setTextColor(255, 255, 255);
    docPdf.text("MÓVEIS SIMONETTI - AGENDAMENTO", 14, 16);
    
    docPdf.setFontSize(10);
    docPdf.text(`TOTAL DE AGENDAMENTOS: ${agendas.length}`, 14, 32);
    docPdf.setTextColor(100);
    docPdf.text(`Emitido em: ${new Date().toLocaleString()}`, 150, 32);

    let currentY = 38;

    agendas.forEach((ag, index) => {
        if (currentY > 260) { docPdf.addPage(); currentY = 20; }

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
            headStyles: { fillGray: 50, fillColor: [192, 0, 0], textColor: 255, fontSize: 8, halign: 'center' },
            styles: { fontSize: 8, halign: 'center' },
            columnStyles: { 0: { fontStyle: 'bold' } }
        });

        currentY = docPdf.lastAutoTable.finalY;

        if (modo === 'completo' && ag.composicao && ag.composicao.length > 0) {
            docPdf.autoTable({
                head: [['CÓDIGO', 'DESCRIÇÃO DO PRODUTO', 'QTD']],
                body: ag.composicao.map(i => [i.codigo, i.descricao, i.qtd]),
                startY: currentY,
                margin: { left: 25 }, 
                tableWidth: 160,
                theme: 'plain',
                headStyles: { fillColor: [240, 240, 240], textColor: 50, fontSize: 7 },
                styles: { fontSize: 7 },
            });
            currentY = docPdf.lastAutoTable.finalY + 10;
        } else {
            currentY += 5;
        }
    });

    docPdf.save(`Relatorio_Simonetti_${modo.toUpperCase()}.pdf`);
};

window.exportarExcel = async (modo) => {
    const selecionados = Array.from(document.querySelectorAll('.check-export:checked')).map(c => c.value);
    if (selecionados.length === 0) return alert("Selecione agendamentos!");

    const snap = await getDocs(collection(db, "agendamentos"));
    const rows = [];

    snap.forEach(doc => {
        if(selecionados.includes(doc.id)) {
            const d = doc.data();
            const base = {
                Senha: d.senhaAgendamento,
                Data: d.data.split('-').reverse().join('/'),
                Central: d.central,
                Cargas: d.cargas,
                Pedido: d.pedido,
                Fornecedor: d.fornecedor,
                Tipo: d.tipoProduto,
                linhaSeparacao: d.linhaSeparacao || "N/A"
            };

            if (modo === 'completo' && d.composicao && d.composicao.length > 0) {
                d.composicao.forEach(item => {
                    rows.push({ ...base, Cod_Item: item.codigo, Descricao: item.descricao, Qtd: item.qtd });
                });
            } else {
                rows.push(base);
            }
        }
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Relatorio");
    XLSX.writeFile(wb, `Simonetti_Export_${modo.toUpperCase()}.xlsx`);
};

function carregarDados() {
    onSnapshot(query(collection(db, "agendamentos"), orderBy("timestamp", "desc")), (snap) => {
        const corpo = document.getElementById('corpoTabela');
        const rascunhos = document.getElementById('corpoRascunhos');
        const dIni = document.getElementById('buscaInicio').value;
        const dFim = document.getElementById('buscaFim').value;
        const termo = document.getElementById('buscaGeral').value.toLowerCase();

        corpo.innerHTML = ""; rascunhos.innerHTML = "";

        snap.forEach(d => {
            const ag = d.data();
            const cores = getCoresPorTipo(ag.tipoProduto);
            const dataFormat = ag.data.split('-').reverse().join('/');
            
            const atendeBusca = ag.senhaAgendamento.toLowerCase().includes(termo) || 
                                ag.fornecedor.toLowerCase().includes(termo) || 
                                (ag.pedido && ag.pedido.toLowerCase().includes(termo)) ||
                                (ag.composicao && ag.composicao.some(item => 
                                    (item.codigo && item.codigo.toLowerCase().includes(termo)) || 
                                    (item.descricao && item.descricao.toLowerCase().includes(termo))
                                ));

            const badgeTipo = `<span style="background-color: ${cores.bg}; color: ${cores.text}; padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 11px; border: 1px solid rgba(0,0,0,0.1);">${ag.tipoProduto}</span>`;

            const acoes = `
                <button onclick="verComp('${ag.senhaAgendamento}')" title="Ver Itens" style="border:none; background:none; cursor:pointer;"><i class="fas fa-boxes"></i></button>
                <button onclick="editarAg('${ag.senhaAgendamento}')" title="Editar" style="border:none; background:none; cursor:pointer;"><i class="fas fa-edit"></i></button>
            `;

            if (ag.status === "Rascunho") {
                rascunhos.innerHTML += `
                    <tr>
                        <td><input type="checkbox" class="check-copy-rascunho" value="${ag.senhaAgendamento}"></td>
                        <td><b>${ag.senhaAgendamento}</b></td>
                        <td>${dataFormat}</td>
                        <td>${ag.central}</td>
                        <td>${ag.cargas || '-'}</td>
                        <td>${ag.pedido || '-'}</td>
                        <td>${ag.fornecedor}</td>
                        <td>${badgeTipo}</td>
                        <td>
                            <button onclick="finalizarDireto('${ag.senhaAgendamento}')" title="Finalizar" style="color:green; border:none; background:none; cursor:pointer;"><i class="fas fa-check-circle"></i></button>
                            ${acoes}
                        </td>
                    </tr>`;
            } else {
                if (ag.data >= dIni && ag.data <= dFim && atendeBusca) {
                    corpo.innerHTML += `
                        <tr>
                            <td><input type="checkbox" class="check-export" value="${ag.senhaAgendamento}"></td>
                            <td><b>${ag.senhaAgendamento}</b></td>
                            <td>${dataFormat}</td>
                            <td>${ag.central}</td>
                            <td>${ag.cargas || '-'}</td>
                            <td>${ag.pedido || '-'}</td>
                            <td>${ag.fornecedor}</td>
                            <td>${badgeTipo}</td>
                            <td>${acoes}</td>
                        </tr>`;
                }
            }
        });
    });
}

// --- RESTANTE DAS FUNÇÕES AUXILIARES ---
window.finalizarDireto = async (senha) => {
    if(confirm(`Confirmar agendamento definitivo da carga ${senha}?`)) {
        await updateDoc(doc(db, "agendamentos", senha), { status: "Agendada", timestamp: serverTimestamp() });
    }
};

window.resetaForm = () => {
    document.getElementById('pedido').value = "";
    document.getElementById('cargas').value = "";
    document.getElementById('tipoProduto').value = "";
    document.getElementById('inputExcel').value = "";
    document.getElementById('linhaSeparacao').value = "Selecione...";
    document.getElementById('selectFornecedor').value = "";
    itensCargaTmp = [];
    document.getElementById('btnSalvar').style.display = 'block';
    document.getElementById('btnRascunho').style.display = 'block';
    document.getElementById('btnAtualizar').style.display = 'none';
    if(document.getElementById('btnCancelarEdicao')) document.getElementById('btnCancelarEdicao').style.display = 'none';
    gerarSenha();
};

window.fecharModais = () => document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');

window.verComp = async (senha) => {
    senhaAbertaNoModal = senha;
    const snap = await getDocs(collection(db, "agendamentos"));
    const docEncontrado = snap.docs.find(x => x.id === senha);
    if(!docEncontrado) return;
    itensCargaTmp = docEncontrado.data().composicao || [];
    renderizarItensModal();
    document.getElementById('tituloComp').innerText = "Carga: " + senha;
    document.getElementById('modalComp').style.display = 'flex';
};

function renderizarItensModal() {
    const corpo = document.getElementById('corpoItensComp');
    corpo.innerHTML = ""; let total = 0;
    itensCargaTmp.forEach((item, index) => {
        total += parseInt(item.qtd || 0);
        corpo.innerHTML += `<tr><td>${item.codigo}</td><td>${item.descricao}</td><td>${item.qtd}</td><td><button onclick="removerItemLocal(${index})" style="color:red; border:none; background:none;"><i class="fas fa-trash"></i></button></td></tr>`;
    });
    document.getElementById('totalPecas').innerText = total;
}

window.removerItemLocal = (i) => { itensCargaTmp.splice(i,1); renderizarItensModal(); };
window.adicionarItemManual = () => {
    const cod = document.getElementById('itemCod').value || "N/A";
    const desc = document.getElementById('itemDesc').value.toUpperCase();
    const qtd = parseInt(document.getElementById('itemQtd').value);
    if(!desc || isNaN(qtd)) return alert("Preencha descrição e quantidade!");
    itensCargaTmp.push({ codigo: cod, descricao: desc, qtd: qtd });
    renderizarItensModal();
};

document.getElementById('btnSalvarEdicaoItens').onclick = async () => {
    await updateDoc(doc(db, "agendamentos", senhaAbertaNoModal), { composicao: itensCargaTmp });
    fecharModais();
};

window.editarAg = async (senha) => {
    const snap = await getDocs(collection(db, "agendamentos"));
    const d = snap.docs.find(x => x.id === senha).data();
    
    document.getElementById('senhaAgendamento').value = d.senhaAgendamento;
    document.getElementById('dataAgendamento').value = d.data;
    document.getElementById('central').value = d.central;
    document.getElementById('selectFornecedor').value = d.fornecedor;
    document.getElementById('tipoProduto').value = d.tipoProduto;
    document.getElementById('pedido').value = d.pedido || "";
    document.getElementById('cargas').value = d.cargas || "";
    document.getElementById('linhaSeparacao').value = d.linhaSeparacao || "Selecione..."; // ADICIONAR ISSO
    
    itensCargaTmp = d.composicao || [];
    
    // Alterna visibilidade dos botões
    document.getElementById('btnSalvar').style.display = 'none';
    document.getElementById('btnRascunho').style.display = 'none';
    document.getElementById('btnAtualizar').style.display = 'block';
    
    // Se você tiver um botão de cancelar no HTML, mostre-o:
    const btnCancel = document.getElementById('btnCancelarEdicao');
    if(btnCancel) btnCancel.style.display = 'block';

    // Rola a página para o topo para facilitar a edição
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// --- FORNECEDORES ---
async function carregarFornecedores() {
    onSnapshot(collection(db, "fornecedores"), (snap) => {
        const select = document.getElementById('selectFornecedor');
        const lista = document.getElementById('listaForn');
        select.innerHTML = '<option value="">Selecione...</option>';
        lista.innerHTML = "";
        snap.forEach(d => {
            const f = d.data().nome;
            select.innerHTML += `<option value="${f}">${f}</option>`;
            lista.innerHTML += `<li style="display:flex; justify-content:space-between; padding:8px; border-bottom:1px solid #eee;">${f} <i class="fas fa-trash" style="color:red; cursor:pointer;" onclick="removerForn('${d.id}')"></i></li>`;
        });
    });
}
window.abrirFornecedor = () => document.getElementById('modalFornecedor').style.display = 'flex';
document.getElementById('btnAddForn').onclick = async () => {
    const nome = document.getElementById('nomeNovoForn').value.toUpperCase().trim();
    if (nome) await addDoc(collection(db, "fornecedores"), { nome });
    document.getElementById('nomeNovoForn').value = "";
};
window.removerForn = async (id) => { if (confirm("Excluir?")) await deleteDoc(doc(db, "fornecedores", id)); };

// --- LISTENERS ---
document.getElementById('btnSalvar').onclick = () => salvarAgenda("Agendada");
document.getElementById('btnRascunho').onclick = () => salvarAgenda("Rascunho");
document.getElementById('btnAtualizar').onclick = () => salvarAgenda("Agendada");
document.getElementById('buscaGeral').oninput = carregarDados;
document.getElementById('buscaInicio').onchange = carregarDados;
document.getElementById('buscaFim').onchange = carregarDados;

window.addEventListener('DOMContentLoaded', async () => { 
    await verificarAcessoADM(); 
    gerarSenha();  
    carregarDados(); 
    carregarFornecedores(); 
});

// --- FUNÇÕES DE ORDENAÇÃO DE TABELAS ---

// Função para a tabela Definitiva
window.ordenarTabelaDefinitiva = (indiceColuna) => {
    // Somamos +1 porque a primeira coluna (index 0) é o checkbox
    ordenarLogicaDOM('corpoTabela', indiceColuna + 1);
};

// Função para a tabela Rascunho
window.ordenarTabelaRascunho = (indiceColuna) => {
    // Somamos +1 porque a primeira coluna (index 0) é o checkbox
    ordenarLogicaDOM('corpoRascunhos', indiceColuna + 1);
};

window.ordenarLogicaDOM = (idCorpo, indexReal) => {
    const corpo = document.getElementById(idCorpo);
    const linhas = Array.from(corpo.querySelectorAll('tr'));
    const direcaoAtual = corpo.dataset.direcao === 'asc' ? 'desc' : 'asc';
    corpo.dataset.direcao = direcaoAtual;

    linhas.sort((a, b) => {
        let valA = a.cells[indexReal].innerText.trim().toUpperCase();
        let valB = b.cells[indexReal].innerText.trim().toUpperCase();

        if (indexReal === 2) { // Data
            valA = valA.split('/').reverse().join('');
            valB = valB.split('/').reverse().join('');
        }
        
        const numA = parseFloat(valA.replace('-', '.'));
        const numB = parseFloat(valB.replace('-', '.'));

        if (!isNaN(numA) && !isNaN(numB)) {
            return direcaoAtual === 'asc' ? numA - numB : numB - numA;
        }

        return direcaoAtual === 'asc' ? valA.localeCompare(valB, 'pt-BR') : valB.localeCompare(valA, 'pt-BR');
    });
    linhas.forEach(linha => corpo.appendChild(linha));
};

// Listener para a importação em massa
document.getElementById('inputExcelMassa').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Dentro da função reader.onload do inputExcelMassa:

        const rows = XLSX.utils.sheet_to_json(worksheet);
        const cargasAgrupadas = {};

        rows.forEach(row => {
            // IGNORA LINHAS TOTALMENTE VAZIAS (como o espaço que você deu entre as cargas)
            if (!row.Cargas && !row.Pedido) return;

            // Se a linha tem Pedido mas não tem Carga (ou vice-versa), 
            // ou se é uma linha de continuação de itens.
            // Usamos Carga + Pedido + Data como "Chave Única"
            const chave = `${row.Cargas}_${row.Pedido}_${row.Data}`;
    
            if (!cargasAgrupadas[chave]) {
                cargasAgrupadas[chave] = {
                    data: row.Data,
                    central: row.Central || "N/A",
                    cargas: row.Cargas || "N/A",
                    pedido: row.Pedido || "N/A",
                    fornecedor: row.Fornecedor || "N/A",
                    tipo: row.Tipo || "DIVERSOS",
                    linhaSeparacao: row.linhaSeparacao || "EMBALADO",
                    composicao: []
                };
            }

            // Adiciona o item na composição se houver código ou descrição
            if (row.Cod_Item || row.Descricao) {
                cargasAgrupadas[chave].composicao.push({
                    codigo: String(row.Cod_Item || "N/A"),
                    descricao: (row.Descricao || "SEM DESCRIÇÃO").toUpperCase(),
                    qtd: parseInt(row.Qtd || 0)
                });
            }
        });

        // Agora salvamos cada carga no Firebase
        let contador = 0;
        const total = Object.keys(cargasAgrupadas).length;

        try {
            for (const chave in cargasAgrupadas) {
                const info = cargasAgrupadas[chave];
                
                // Gera uma senha única para cada carga da planilha
                const proximaSenha = await gerarSenhaParaMassa(); 
                
                const dados = {
                    senhaAgendamento: proximaSenha,
                    data: converterDataExcel(info.data),
                    central: info.central ? info.central.toUpperCase() : "N/A",
                    fornecedor: info.fornecedor ? info.fornecedor.toUpperCase() : "N/A",
                    cargas: info.cargas || "",
                    pedido: info.pedido || "",
                    tipoProduto: info.tipo ? info.tipo.toUpperCase() : "DIVERSOS",
                    linhaSeparacao: info.linhaSeparacao ? info.linhaSeparacao.toUpperCase() : "EMBALADO",
                    status: "Rascunho",
                    composicao: info.composicao,
                    timestamp: serverTimestamp(),
                    usuario: usuarioUsername
                };

                await setDoc(doc(db, "agendamentos", proximaSenha), dados);
                contador++;
            }
            alert(`${contador} agendamentos importados com sucesso como RASCUNHO!`);
            e.target.value = ""; // Limpa o input
        } catch (error) {
            console.error("Erro na importação:", error);
            alert("Erro ao importar dados. Verifique o console.");
        }
    };
    reader.readAsArrayBuffer(file);
});

// Função auxiliar para gerar senhas em sequência na importação
async function gerarSenhaParaMassa() {
    const q = query(collection(db, "agendamentos"), orderBy("timestamp", "desc"), limit(20));
    const snap = await getDocs(q);
    let num = 1;
    if (!snap.empty) {
        const numeros = snap.docs.map(d => {
            const s = d.data().senhaAgendamento;
            return s && s.includes('-') ? parseInt(s.split('-')[0]) : 0;
        });
        num = Math.max(...numeros) + 1;
    }
    // Retorna a senha mas não injeta no campo da tela, pois é para o loop
    return String(num).padStart(2, '0') + "-SM";
}

// Função para tratar a data que vem do Excel (pode vir como número ou string)
function converterDataExcel(dataExcel) {
    if (!dataExcel) return getDataBR();
    
    // Se a data vier no formato DD/MM/YYYY
    if (typeof dataExcel === 'string' && dataExcel.includes('/')) {
        const partes = dataExcel.split('/');
        return `${partes[2]}-${partes[1]}-${partes[0]}`;
    }
    
    // Se vier como número serial do Excel
    if (typeof dataExcel === 'number') {
        const date = new Date((dataExcel - 25569) * 86400 * 1000);
        return date.toISOString().split('T')[0];
    }

    return dataExcel; // Retorna o que vier se já estiver no padrão YYYY-MM-DD
}

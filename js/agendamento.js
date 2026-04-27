import { app } from './firebase-config.js';
import { 
    getFirestore, doc, setDoc, collection, addDoc, onSnapshot, query, orderBy, 
    updateDoc, getDocs, limit, serverTimestamp, deleteDoc, getDoc, where 
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const db = getFirestore(app);
const usuarioNome = localStorage.getItem('usuarioNome') || "DESCONHECIDO";
let itensCargaTmp = []; 
let senhaAbertaNoModal = ""; 

// --- TRAVA DE SEGURANÇA CORRIGIDA ---
async function verificarAcessoADM() {
    if (usuarioNome === "DESCONHECIDO") {
        window.location.href = "login.html";
        return;
    }

    try {
        // Busca na coleção 'users' onde o campo 'username' é igual ao usuarioNome
        const q = query(collection(db, "users"), where("username", "==", usuarioNome));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const dadosUser = querySnapshot.docs[0].data();
            if (dadosUser.nivelAcesso !== "ADM") {
                alert("ACESSO NEGADO: Somente administradores podem acessar esta página.");
                window.location.href = "portal.html";
            }
        } else {
            alert("Usuário não cadastrado.");
            window.location.href = "login.html";
        }
    } catch (error) {
        console.error("Erro na validação:", error);
        window.location.href = "login.html";
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
document.getElementById('user-display').innerText = usuarioNome;

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
        usuario: usuarioNome
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
                    <b>FORN:</b> ${fornecedor}<br>
                    <b>CENTRAL:</b> ${central} | <b>TIPO:</b> ${tipo}<br>
                    <b>CARGA:</b> ${cargas}
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

    // --- ESTILIZAÇÃO DO CABEÇALHO (Inspirado no print) ---
    docPdf.setFillColor(192, 0, 0); // Vermelho Simonetti
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
        // Verifica se precisa de nova página
        if (currentY > 260) { docPdf.addPage(); currentY = 20; }

        // Tabela da Carga (Cabeçalho Vermelho para cada carga)
        docPdf.autoTable({
            head: [['SENHA', 'DATA', 'CENTRAL', 'CARGAS', 'FORNECEDOR', 'TIPO']],
            body: [[
                ag.senhaAgendamento, 
                ag.data.split('-').reverse().join('/'), 
                ag.central, 
                ag.cargas || '-', 
                ag.fornecedor, 
                ag.tipoProduto
            ]],
            startY: currentY,
            theme: 'grid',
            headStyles: { fillGray: 50, fillColor: [192, 0, 0], textColor: 255, fontSize: 8, halign: 'center' },
            styles: { fontSize: 8, halign: 'center' },
            columnStyles: { 0: { fontStyle: 'bold' } }
        });

        currentY = docPdf.lastAutoTable.finalY;

        // Se for modo completo, desenha a composição logo abaixo
        if (modo === 'completo' && ag.composicao && ag.composicao.length > 0) {
            docPdf.autoTable({
                head: [['CÓDIGO', 'DESCRIÇÃO DO PRODUTO', 'QTD']],
                body: ag.composicao.map(i => [i.codigo, i.descricao, i.qtd]),
                startY: currentY,
                margin: { left: 25 }, // Recuo para parecer sub-item
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
                Tipo: d.tipoProduto
            };

            // Se for completo, expande as linhas para cada item
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

// --- CARREGAR E MONITORAR (REAL-TIME) ---
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
            
            // Verifica nos dados principais
            const buscaNoPrincipal = ag.senhaAgendamento.toLowerCase().includes(termo) || 
                                     ag.fornecedor.toLowerCase().includes(termo) || 
                                     (ag.pedido && ag.pedido.toLowerCase().includes(termo));

            // Verifica se o termo está em algum item da composição (Código ou Descrição)
            const buscaNosItens = ag.composicao && ag.composicao.some(item => 
                (item.codigo && item.codigo.toLowerCase().includes(termo)) || 
                (item.descricao && item.descricao.toLowerCase().includes(termo))
            );

            const atendeBusca = buscaNoPrincipal || buscaNosItens;
            
            const acoes = `
                <button onclick="verComp('${ag.senhaAgendamento}')" title="Ver Itens" style="border:none; background:none; cursor:pointer;"><i class="fas fa-boxes"></i></button>
                <button onclick="editarAg('${ag.senhaAgendamento}')" title="Editar" style="border:none; background:none; cursor:pointer;"><i class="fas fa-edit"></i></button>
            `;

            if (ag.status === "Rascunho") {
                rascunhos.innerHTML += `
                    <tr data-tipo="${(ag.tipoProduto || '').toUpperCase()}">
                        <td><input type="checkbox" class="check-copy-rascunho" value="${ag.senhaAgendamento}"></td>
                        <td><b>${ag.senhaAgendamento}</b></td>
                        <td>${dataFormat}</td>
                        <td>${ag.central}</td>
                        <td>${ag.cargas || '-'}</td>
                        <td>${ag.pedido || '-'}</td>
                        <td>${ag.fornecedor}</td>
                        <td>${ag.tipoProduto}</td>
                        <td>
                            <button onclick="finalizarDireto('${ag.senhaAgendamento}')" title="Finalizar" style="color:green; border:none; background:none; cursor:pointer;"><i class="fas fa-check-circle"></i></button>
                            ${acoes}
                        </td>
                    </tr>`;
            } else {
                if (ag.data >= dIni && ag.data <= dFim && atendeBusca) {
                    corpo.innerHTML += `
                        <tr style="background-color: ${cores.bg}; color: ${cores.text}">
                            <td><input type="checkbox" class="check-export" value="${ag.senhaAgendamento}"></td>
                            <td><b>${ag.senhaAgendamento}</b></td>
                            <td>${dataFormat}</td>
                            <td>${ag.central}</td>
                            <td>${ag.cargas || '-'}</td>
                            <td>${ag.pedido || '-'}</td>
                            <td>${ag.fornecedor}</td>
                            <td>${ag.tipoProduto}</td>
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
    itensCargaTmp = [];
    document.getElementById('btnSalvar').style.display = 'block';
    document.getElementById('btnRascunho').style.display = 'block';
    document.getElementById('btnAtualizar').style.display = 'none';
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
    itensCargaTmp = d.composicao || [];
    document.getElementById('btnSalvar').style.display = 'none';
    document.getElementById('btnRascunho').style.display = 'none';
    document.getElementById('btnAtualizar').style.display = 'block';
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
    await verificarAcessoADM(); // Agora o await funciona porque a arrow function é async
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

function ordenarLogicaDOM(idCorpo, indexReal) {
    const corpo = document.getElementById(idCorpo);
    const linhas = Array.from(corpo.querySelectorAll('tr'));
    
    // Define a direção (ascendente ou descendente)
    const direcaoAtual = corpo.dataset.direcao === 'asc' ? 'desc' : 'asc';
    corpo.dataset.direcao = direcaoAtual;

    linhas.sort((a, b) => {
        let valA = a.cells[indexReal].innerText.trim().toUpperCase();
        let valB = b.cells[indexReal].innerText.trim().toUpperCase();

        // Tratamento especial para coluna de DATA (sempre index 2 no seu HTML)
        if (indexReal === 2) {
            valA = valA.split('/').reverse().join(''); // DD/MM/YYYY -> YYYYMMDD
            valB = valB.split('/').reverse().join('');
        }
        
        // Tratamento para números (Senha ou Pedido se forem só números)
        const numA = parseFloat(valA.replace('-', '.'));
        const numB = parseFloat(valB.replace('-', '.'));

        if (!isNaN(numA) && !isNaN(numB)) {
            return direcaoAtual === 'asc' ? numA - numB : numB - numA;
        }

        return direcaoAtual === 'asc' 
            ? valA.localeCompare(valB, 'pt-BR') 
            : valB.localeCompare(valA, 'pt-BR');
    });

    // Reinsere as linhas ordenadas no corpo da tabela
    linhas.forEach(linha => corpo.appendChild(linha));
}

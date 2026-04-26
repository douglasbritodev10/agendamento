import { app } from './firebase-config.js';
import { 
    getFirestore, doc, setDoc, collection, addDoc, onSnapshot, query, orderBy, 
    updateDoc, getDocs, limit, serverTimestamp, deleteDoc 
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const db = getFirestore(app);
const usuarioNome = localStorage.getItem('usuarioNome') || "DBRITO";
let itensCargaTmp = []; 
let senhaAbertaNoModal = ""; 

const getDataBR = () => {
    const d = new Date();
    return new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
};

// --- CONFIGURAÇÃO INICIAL ---
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

// --- EXPORTAR PDF (BÁSICO VS COMPLETO) ---
window.exportarPDF = async (modo) => {
    const { jsPDF } = window.jspdf;
    const docPdf = new jsPDF('p', 'mm', 'a4');
    const selecionados = Array.from(document.querySelectorAll('.check-export:checked')).map(c => c.value);
    
    if (selecionados.length === 0) return alert("Selecione agendamentos na tabela!");

    const snap = await getDocs(collection(db, "agendamentos"));
    const agendas = [];
    snap.forEach(d => { if(selecionados.includes(d.id)) agendas.push(d.data()); });
    
    // Cabeçalho
    docPdf.setFontSize(16);
    docPdf.setTextColor(211, 47, 47);
    docPdf.text("MÓVEIS SIMONETTI - GESTÃO DE CARGAS", 14, 15);
    docPdf.setFontSize(10);
    docPdf.setTextColor(100);
    docPdf.text(`Total de Agendamentos: ${agendas.length} | Emitido em: ${new Date().toLocaleString()}`, 14, 22);

    let currentY = 28;

    const head = [['SENHA', 'DATA', 'CENTRAL', 'CARGAS', 'PEDIDO', 'FORNECEDOR', 'TIPO']];
    const body = agendas.map(a => [
        a.senhaAgendamento, 
        a.data.split('-').reverse().join('/'), 
        a.central, 
        a.cargas || '-', 
        a.pedido || '-', 
        a.fornecedor, 
        a.tipoProduto
    ]);

    docPdf.autoTable({
        head: head,
        body: body,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillGray: 200, textColor: 50, fontSize: 8 },
        styles: { fontSize: 8, cellPadding: 2 },
        didParseCell: function(data) {
            if (data.section === 'body') {
                const tipo = data.row.raw[6]; 
                const cores = getCoresPorTipo(tipo);
                if (cores.bg !== '#FFFFFF') {
                    data.cell.styles.fillColor = cores.rgb;
                    data.cell.styles.textColor = (cores.text === '#FFFFFF') ? 255 : 0;
                }
            }
        }
    });

    if (modo === 'completo') {
        let finalY = docPdf.lastAutoTable.finalY + 10;
        docPdf.setFontSize(12);
        docPdf.text("DETALHAMENTO DA COMPOSIÇÃO", 14, finalY);
        
        agendas.forEach(ag => {
            if (ag.composicao && ag.composicao.length > 0) {
                finalY += 7;
                docPdf.setFontSize(9);
                docPdf.setTextColor(0);
                docPdf.text(`Carga: ${ag.senhaAgendamento} - ${ag.fornecedor}`, 14, finalY);
                
                const compBody = ag.composicao.map(i => [i.codigo, i.descricao, i.qtd]);
                docPdf.autoTable({
                    head: [['Cód', 'Descrição do Item', 'Qtd']],
                    body: compBody,
                    startY: finalY + 2,
                    margin: { left: 20 },
                    tableWidth: 150,
                    styles: { fontSize: 7 },
                    headStyles: { fillGray: 240 }
                });
                finalY = docPdf.lastAutoTable.finalY + 5;
            }
        });
    }

    docPdf.save(`Simonetti_${modo.toUpperCase()}_${getDataBR()}.pdf`);
};

// --- EXPORTAR EXCEL ---
window.exportarExcel = async () => {
    const selecionados = Array.from(document.querySelectorAll('.check-export:checked')).map(c => c.value);
    if (selecionados.length === 0) return alert("Selecione agendamentos!");

    const snap = await getDocs(collection(db, "agendamentos"));
    const rows = [];

    snap.forEach(doc => {
        if(selecionados.includes(doc.id)) {
            const d = doc.data();
            const base = {
                Senha: d.senhaAgendamento,
                Data: d.data,
                Central: d.central,
                Cargas: d.cargas,
                Pedido: d.pedido,
                Fornecedor: d.fornecedor,
                Tipo: d.tipoProduto
            };

            if (d.composicao && d.composicao.length > 0) {
                d.composicao.forEach(item => {
                    rows.push({ ...base, Item_Cod: item.codigo, Item_Desc: item.descricao, Item_Qtd: item.qtd });
                });
            } else {
                rows.push(base);
            }
        }
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Agendamentos_Completos");
    XLSX.writeFile(wb, `Logistica_Simonetti_${getDataBR()}.xlsx`);
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
            
            const atendeBusca = ag.senhaAgendamento.toLowerCase().includes(termo) || 
                                ag.fornecedor.toLowerCase().includes(termo) || 
                                (ag.pedido && ag.pedido.toLowerCase().includes(termo));

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

window.addEventListener('DOMContentLoaded', () => { 
    gerarSenha(); 
    carregarDados(); 
    carregarFornecedores(); 
});

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

// Inicialização de campos de data e usuário
document.getElementById('dataAgendamento').value = getDataBR();
document.getElementById('buscaInicio').value = getDataBR();
document.getElementById('buscaFim').value = getDataBR();
document.getElementById('user-display').innerText = usuarioNome;

// --- GERAÇÃO DE SENHA ---
async function gerarSenha() {
    const q = query(collection(db, "agendamentos"), orderBy("timestamp", "desc"), limit(1));
    const snap = await getDocs(q);
    let num = 1;
    if (!snap.empty) {
        const ultima = snap.docs[0].data().senhaAgendamento;
        if(ultima && ultima.includes('-')) num = parseInt(ultima.split('-')[0]) + 1;
    }
    document.getElementById('senhaAgendamento').value = String(num).padStart(2, '0') + "-SM";
}

// --- IMPORTAR EXCEL (COMPOSIÇÃO) ---
document.getElementById('inputExcel').addEventListener('change', (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (evt) => {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws);
        
        itensCargaTmp = data.map(row => ({
            codigo: row.Codigo || row.CODIGO || row.cod || "N/A",
            descricao: row.Descricao || row.DESCRICAO || row.desc || "SEM DESCRIÇÃO",
            qtd: parseInt(row.Qtd || row.QTD || row.qtd || 0)
        }));
        alert(`${itensCargaTmp.length} itens carregados! Termine de preencher o formulário.`);
    };
    reader.readAsBinaryString(file);
});

// --- SALVAR AGENDAMENTO ---
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

// --- CARREGAR DADOS E MONITORAR ---
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
            const classe = getClasseTipo(ag.tipoProduto);
            const dataFormat = ag.data.split('-').reverse().join('/');
            const compString = (ag.composicao || []).map(i => (i.codigo + " " + i.descricao).toLowerCase()).join(" ");

            const atendeBusca = 
                ag.senhaAgendamento.toLowerCase().includes(termo) || 
                ag.fornecedor.toLowerCase().includes(termo) || 
                (ag.pedido && ag.pedido.toLowerCase().includes(termo)) ||
                (ag.central && ag.central.toLowerCase().includes(termo)) ||
                (ag.cargas && ag.cargas.toLowerCase().includes(termo)) ||
                compString.includes(termo);

            if (ag.status === "Rascunho") {
                rascunhos.innerHTML += `
                    <tr>
                        <td><b>${ag.senhaAgendamento}</b></td>
                        <td>${dataFormat}</td>
                        <td>${ag.central}</td>
                        <td>${ag.cargas || '-'}</td>
                        <td>${ag.pedido || '-'}</td>
                        <td>${ag.fornecedor}</td>
                        <td>${ag.tipoProduto}</td>
                        <td>
                            <button onclick="verComp('${ag.senhaAgendamento}')"><i class="fas fa-boxes"></i></button>
                            <button onclick="editarAg('${ag.senhaAgendamento}')"><i class="fas fa-edit"></i></button>
                        </td>
                    </tr>`;
            } else {
                if (ag.data >= dIni && ag.data <= dFim && atendeBusca) {
                    corpo.innerHTML += `
                        <tr class="${classe}">
                            <td><input type="checkbox" class="check-export" value="${ag.senhaAgendamento}"></td>
                            <td><b>${ag.senhaAgendamento}</b></td>
                            <td>${dataFormat}</td>
                            <td>${ag.central}</td>
                            <td>${ag.cargas || '-'}</td>
                            <td>${ag.pedido || '-'}</td>
                            <td>${ag.fornecedor}</td>
                            <td>${ag.tipoProduto}</td>
                            <td>
                                <button onclick="verComp('${ag.senhaAgendamento}')" title="Composição"><i class="fas fa-boxes"></i></button>
                                <button onclick="editarAg('${ag.senhaAgendamento}')"><i class="fas fa-edit"></i></button>
                            </td>
                        </tr>`;
                }
            }
        });
    });
}

// --- EXPORTAÇÕES ---
window.toggleSelectAll = (el) => {
    document.querySelectorAll('.check-export').forEach(c => c.checked = el.checked);
};

function getSelecionados() {
    return Array.from(document.querySelectorAll('.check-export:checked')).map(c => c.value);
}

window.exportarExcel = async () => {
    const selecionados = getSelecionados();
    if (selecionados.length === 0) return alert("Selecione ao menos um agendamento para exportar!");

    const snap = await getDocs(collection(db, "agendamentos"));
    const dadosExport = [];

    snap.forEach(doc => {
        if (selecionados.includes(doc.id)) {
            const d = doc.data();
            dadosExport.push({
                Senha: d.senhaAgendamento,
                Data: d.data,
                Central: d.central,
                Fornecedor: d.fornecedor,
                Cargas: d.cargas || "",
                Pedido: d.pedido || "",
                Tipo: d.tipoProduto,
                Linha: d.linhaSeparacao
            });
        }
    });

    const ws = XLSX.utils.json_to_sheet(dadosExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Agendamentos");
    XLSX.writeFile(wb, `Agendamentos_Simonetti_${getDataBR()}.xlsx`);
};

window.exportarPDF = async (tipo) => {
    const { jsPDF } = window.jspdf;
    const docPdf = new jsPDF('p', 'mm', 'a4');
    const selecionados = getSelecionados();

    if (selecionados.length === 0) return alert("Selecione ao menos um agendamento!");

    const snap = await getDocs(collection(db, "agendamentos"));
    const agendas = [];
    snap.forEach(d => { if(selecionados.includes(d.id)) agendas.push(d.data()); });

    if (tipo === 'basico') {
        docPdf.text("Relatório de Agendamentos - Móveis Simonetti", 14, 15);
        const rows = agendas.map(a => [a.senhaAgendamento, a.data, a.fornecedor, a.pedido, a.tipoProduto]);
        docPdf.autoTable({
            startY: 20,
            head: [['Senha', 'Data', 'Fornecedor', 'Pedido', 'Tipo']],
            body: rows
        });
    } else {
        // PDF Completo - Detalha itens de cada carga
        agendas.forEach((a, index) => {
            if (index > 0) docPdf.addPage();
            docPdf.setFontSize(14);
            docPdf.text(`AGENDA: ${a.senhaAgendamento} - ${a.fornecedor}`, 14, 15);
            docPdf.setFontSize(10);
            docPdf.text(`Data: ${a.data} | Pedido: ${a.pedido || '-'} | Central: ${a.central}`, 14, 22);
            
            const itens = (a.composicao || []).map(i => [i.codigo, i.descricao, i.qtd]);
            docPdf.autoTable({
                startY: 28,
                head: [['Cód', 'Descrição do Produto', 'Qtd']],
                body: itens,
                foot: [['', 'TOTAL DE PEÇAS', (a.composicao || []).reduce((acc, cur) => acc + (cur.qtd || 0), 0)]]
            });
        });
    }
    docPdf.save(`Relatorio_Simonetti_${tipo}.pdf`);
};

// --- EDIÇÃO DE ITENS NO MODAL ---
window.verComp = async (senha) => {
    senhaAbertaNoModal = senha;
    const snap = await getDocs(query(collection(db, "agendamentos")));
    const docFound = snap.docs.find(x => x.id === senha);
    if (!docFound) return;
    itensCargaTmp = docFound.data().composicao || [];
    renderizarItensModal();
    document.getElementById('tituloComp').innerText = "Carga: " + senha;
    document.getElementById('modalComp').style.display = 'flex';
};

function renderizarItensModal() {
    const corpo = document.getElementById('corpoItensComp');
    corpo.innerHTML = "";
    let total = 0;

    itensCargaTmp.forEach((item, index) => {
        total += parseInt(item.qtd || 0);
        corpo.innerHTML += `
            <tr>
                <td><input type="text" value="${item.codigo}" onchange="atualizarCampoItem(${index}, 'codigo', this.value)" style="width:100%; border:none; background:transparent;"></td>
                <td><input type="text" value="${item.descricao}" onchange="atualizarCampoItem(${index}, 'descricao', this.value.toUpperCase())" style="width:100%; border:none; background:transparent;"></td>
                <td><input type="number" value="${item.qtd}" onchange="atualizarCampoItem(${index}, 'qtd', this.value)" style="width:65px; border:1px solid #ddd; border-radius:4px; padding:2px;"></td>
                <td><button onclick="removerItemLocal(${index})" style="color:red; border:none; background:none; cursor:pointer;"><i class="fas fa-trash"></i></button></td>
            </tr>`;
    });
    document.getElementById('totalPecas').innerText = total;
}

window.atualizarCampoItem = (index, campo, valor) => {
    if (campo === 'qtd') {
        itensCargaTmp[index][campo] = parseInt(valor) || 0;
        const novoTotal = itensCargaTmp.reduce((acc, curr) => acc + parseInt(curr.qtd || 0), 0);
        document.getElementById('totalPecas').innerText = novoTotal;
    } else {
        itensCargaTmp[index][campo] = valor;
    }
};

window.adicionarItemManual = () => {
    const cod = document.getElementById('itemCod').value;
    const desc = document.getElementById('itemDesc').value;
    const qtd = document.getElementById('itemQtd').value;
    if (!desc || !qtd) return alert("Preencha descrição e quantidade!");
    itensCargaTmp.push({ codigo: cod || "N/A", descricao: desc.toUpperCase(), qtd: parseInt(qtd) });
    document.getElementById('itemCod').value = ""; document.getElementById('itemDesc').value = ""; document.getElementById('itemQtd').value = "";
    renderizarItensModal();
};

window.removerItemLocal = (index) => {
    itensCargaTmp.splice(index, 1);
    renderizarItensModal();
};

document.getElementById('btnSalvarEdicaoItens').onclick = async () => {
    await updateDoc(doc(db, "agendamentos", senhaAbertaNoModal), { composicao: itensCargaTmp });
    alert("Itens da carga atualizados!");
    fecharModais();
};

// --- ORDENAÇÃO DE TABELA ---
window.ordenarTabela = (n) => {
    const table = document.getElementById("tabelaAgendas");
    let switching = true, shouldSwitch, dir = "asc", switchcount = 0;
    while (switching) {
        switching = false;
        let rows = table.rows;
        for (var i = 1; i < (rows.length - 1); i++) {
            shouldSwitch = false;
            let x = rows[i].getElementsByTagName("TD")[n];
            let y = rows[i + 1].getElementsByTagName("TD")[n];
            if (dir == "asc") {
                if (x.innerHTML.toLowerCase() > y.innerHTML.toLowerCase()) { shouldSwitch = true; break; }
            } else if (dir == "desc") {
                if (x.innerHTML.toLowerCase() < y.innerHTML.toLowerCase()) { shouldSwitch = true; break; }
            }
        }
        if (shouldSwitch) {
            rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
            switching = true; switchcount++;
        } else {
            if (switchcount == 0 && dir == "asc") { dir = "desc"; switching = true; }
        }
    }
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

// --- AUXILIARES ---
const getClasseTipo = (tipo) => {
    const t = (tipo || "").toUpperCase();
    if (['ARMARIO','COMODA','PAINEL','MULTIUSO','MODULO','COZINHA','ROUPEIRO'].some(x => t.includes(x))) return 'tipo-amarelo';
    if (t.includes('MESA')) return 'tipo-verde';
    if (['CELULAR','TABLET','RELOGIO','NOTEBOOK'].some(x => t.includes(x))) return 'tipo-azul';
    return '';
};

window.editarAg = async (senha) => {
    const snap = await getDocs(query(collection(db, "agendamentos")));
    const docFound = snap.docs.find(x => x.id === senha);
    if(!docFound) return;
    const d = docFound.data();
    
    document.getElementById('senhaAgendamento').value = d.senhaAgendamento;
    document.getElementById('dataAgendamento').value = d.data;
    document.getElementById('central').value = d.central;
    document.getElementById('selectFornecedor').value = d.fornecedor;
    document.getElementById('pedido').value = d.pedido || "";
    document.getElementById('cargas').value = d.cargas || "";
    document.getElementById('tipoProduto').value = d.tipoProduto;
    document.getElementById('linhaSeparacao').value = d.linhaSeparacao || "EMBALADO";
    itensCargaTmp = d.composicao || [];
    
    document.getElementById('btnSalvar').style.display = 'none';
    document.getElementById('btnRascunho').style.display = 'none';
    document.getElementById('btnAtualizar').style.display = 'block';
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

window.addEventListener('DOMContentLoaded', () => { 
    gerarSenha(); 
    carregarDados(); 
    carregarFornecedores(); 
});

document.getElementById('btnSalvar').onclick = () => salvarAgenda("Agendada");
document.getElementById('btnRascunho').onclick = () => salvarAgenda("Rascunho");
document.getElementById('btnAtualizar').onclick = () => salvarAgenda("Agendada");
document.getElementById('buscaGeral').oninput = carregarDados;
document.getElementById('buscaInicio').onchange = carregarDados;
document.getElementById('buscaFim').onchange = carregarDados;

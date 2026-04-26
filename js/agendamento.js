import { app } from './firebase-config.js';
import { 
    getFirestore, doc, setDoc, collection, addDoc, onSnapshot, query, orderBy, 
    updateDoc, getDocs, limit, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const db = getFirestore(app);
const usuarioNome = localStorage.getItem('usuarioNome') || "DBRITO";
let itensCargaTmp = []; 

const getDataBR = () => {
    const d = new Date();
    return new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
};

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

// --- LEITURA DO EXCEL ---
document.getElementById('inputExcel').addEventListener('change', (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (evt) => {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws);
        
        itensCargaTmp = data.map(row => ({
            codigo: row.Codigo || row.CODIGO || row.cod || "",
            descricao: row.Descricao || row.DESCRICAO || row.desc || "",
            qtd: row.Qtd || row.QTD || row.qtd || 0
        }));
        alert(`${itensCargaTmp.length} itens importados com sucesso!`);
    };
    reader.readAsBinaryString(file);
});

// --- SALVAR/ATUALIZAR ---
async function salvarAgenda(status, isUpdate = false) {
    const senha = document.getElementById('senhaAgendamento').value;
    const fornecedor = document.getElementById('selectFornecedor').value;

    if (!fornecedor) return alert("Selecione um fornecedor!");

    const dados = {
        senhaAgendamento: senha,
        data: document.getElementById('dataAgendamento').value,
        central: document.getElementById('central').value,
        fornecedor: fornecedor,
        cargas: document.getElementById('cargas').value,
        tipoProduto: document.getElementById('tipoProduto').value.toUpperCase(),
        linhaSeparacao: document.getElementById('linhaSeparacao').value, // SALVANDO LINHA DE SEPARAÇÃO
        status: status,
        composicao: itensCargaTmp, 
        timestamp: serverTimestamp(),
        usuario: usuarioNome
    };

    await setDoc(doc(db, "agendamentos", senha), dados, { merge: true });
    alert("Operação realizada com sucesso!");
    resetaForm();
}

// --- MONITORAMENTO ---
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

            if (ag.status === "Rascunho") {
                rascunhos.innerHTML += `
                    <tr>
                        <td><b>${ag.senhaAgendamento}</b></td>
                        <td>${ag.fornecedor}</td>
                        <td style="text-align:right">
                            <button onclick="verComp('${ag.senhaAgendamento}')" title="Ver Composição"><i class="fas fa-boxes"></i></button>
                            <button onclick="editarAg('${ag.senhaAgendamento}')" title="Editar"><i class="fas fa-edit"></i></button>
                        </td>
                    </tr>`;
            } else {
                if (ag.data >= dIni && ag.data <= dFim && (ag.fornecedor.toLowerCase().includes(termo) || ag.senhaAgendamento.toLowerCase().includes(termo))) {
                    corpo.innerHTML += `
                        <tr class="${classe}">
                            <td><b>${ag.senhaAgendamento}</b></td>
                            <td>${ag.data.split('-').reverse().join('/')}</td>
                            <td>${ag.central}</td>
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

window.verComp = async (senha) => {
    const snap = await getDocs(query(collection(db, "agendamentos")));
    const ag = snap.docs.find(x => x.id === senha).data();
    const corpo = document.getElementById('corpoItensComp');
    corpo.innerHTML = "";

    if (!ag.composicao || ag.composicao.length === 0) {
        corpo.innerHTML = "<tr><td colspan='3' style='padding:10px'>Sem itens importados.</td></tr>";
    } else {
        ag.composicao.forEach(item => {
            corpo.innerHTML += `<tr><td>${item.codigo}</td><td>${item.descricao}</td><td>${item.qtd}</td></tr>`;
        });
    }
    document.getElementById('tituloComp').innerText = "Carga: " + senha;
    document.getElementById('modalComp').style.display = 'flex';
};

// --- RESTANTE DAS FUNÇÕES (CORES, FORNECEDORES, RESET) ---
const getClasseTipo = (tipo) => {
    const t = (tipo || "").toUpperCase();
    if (['ARMARIO','COMODA','COZINHA','ROUPEIRO'].some(x => t.includes(x))) return 'tipo-amarelo';
    if (t.includes('MESA')) return 'tipo-verde';
    if (['CELULAR','NOTEBOOK'].some(x => t.includes(x))) return 'tipo-azul';
    return '';
};

window.editarAg = async (senha) => {
    const snap = await getDocs(query(collection(db, "agendamentos")));
    const d = snap.docs.find(x => x.id === senha).data();
    
    document.getElementById('senhaAgendamento').value = d.senhaAgendamento;
    document.getElementById('dataAgendamento').value = d.data;
    document.getElementById('central').value = d.central;
    document.getElementById('selectFornecedor').value = d.fornecedor;
    document.getElementById('tipoProduto').value = d.tipoProduto;
    document.getElementById('cargas').value = d.cargas;
    document.getElementById('linhaSeparacao').value = d.linhaSeparacao || "EMBALADO";
    itensCargaTmp = d.composicao || [];

    document.getElementById('btnSalvar').style.display = 'none';
    document.getElementById('btnRascunho').style.display = 'none';
    document.getElementById('btnAtualizar').style.display = 'block';
};

window.resetaForm = () => {
    itensCargaTmp = [];
    document.getElementById('inputExcel').value = "";
    document.getElementById('cargas').value = "";
    document.getElementById('tipoProduto').value = "";
    document.getElementById('btnSalvar').style.display = 'block';
    document.getElementById('btnRascunho').style.display = 'block';
    document.getElementById('btnAtualizar').style.display = 'none';
    gerarSenha();
};

// Eventos de Inicialização
window.addEventListener('DOMContentLoaded', () => { gerarSenha(); carregarDados(); carregarFornecedores(); });
document.getElementById('btnSalvar').onclick = () => salvarAgenda("Agendada");
document.getElementById('btnRascunho').onclick = () => salvarAgenda("Rascunho");
document.getElementById('btnAtualizar').onclick = () => salvarAgenda("Agendada", true);
document.getElementById('buscaGeral').oninput = carregarDados;
document.getElementById('buscaInicio').onchange = carregarDados;
document.getElementById('buscaFim').onchange = carregarDados;
window.fecharModais = () => document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');

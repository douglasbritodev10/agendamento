import { app } from './firebase-config.js';
import { 
    getFirestore, doc, setDoc, collection, addDoc, onSnapshot, query, orderBy, 
    updateDoc, deleteDoc, getDocs, limit 
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const db = getFirestore(app);
const usuarioNome = localStorage.getItem('usuarioNome') || "DBRITO";

// --- CONFIGURAÇÃO DE DATAS ---
const getDataBR = () => {
    const d = new Date();
    return new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
};

document.getElementById('dataAgendamento').value = getDataBR();
document.getElementById('buscaInicio').value = getDataBR();
document.getElementById('buscaFim').value = getDataBR();
document.getElementById('user-display').innerText = usuarioNome;

// --- REGISTRO DE HISTÓRICO (OBRIGATÓRIO) ---
async function registrarHistorico(acao, senha) {
    await addDoc(collection(db, "historico"), {
        usuario: usuarioNome,
        acao: acao,
        senhaAgendamento: senha,
        dataHora: new Date().toISOString()
    });
}

// --- SENHA SEQUENCIAL ---
async function gerarSenha() {
    const q = query(collection(db, "agendamentos"), orderBy("timestamp", "desc"), limit(1));
    const snap = await getDocs(q);
    let num = 1;
    if (!snap.empty) {
        const ultima = snap.docs[0].data().senhaAgendamento;
        num = parseInt(ultima.split('-')[0]) + 1;
    }
    document.getElementById('senhaAgendamento').value = String(num).padStart(2, '0') + "-SM";
}

// --- CORES DINÂMICAS ---
const getClasseTipo = (tipo) => {
    const t = (tipo || "").toUpperCase();
    if (['ARMARIO','COMODA','COZINHA','MODULO','PAINEL','ROUPEIRO','MULTIUSO'].some(x => t.includes(x))) return 'tipo-amarelo';
    if (t.includes('MESA')) return 'tipo-verde';
    if (['CELULAR','RELOGIO','NOTEBOOK','TABLET'].some(x => t.includes(x))) return 'tipo-azul';
    return '';
};

// --- SALVAR / RASCUNHO / ATUALIZAR ---
async function salvarAgenda(status, isUpdate = false) {
    const senha = document.getElementById('senhaAgendamento').value;
    const dados = {
        senhaAgendamento: senha,
        data: document.getElementById('dataAgendamento').value,
        central: document.getElementById('central').value,
        fornecedor: document.getElementById('selectFornecedor').value,
        cargas: document.getElementById('cargas').value,
        tipoProduto: document.getElementById('tipoProduto').value.toUpperCase(),
        linhaSeparacao: document.getElementById('linhaSeparacao').value,
        status: status,
        timestamp: isUpdate ? null : new Date().getTime()
    };

    if (!dados.fornecedor) return alert("Selecione um fornecedor!");

    const ref = doc(db, "agendamentos", senha);
    if (isUpdate) {
        delete dados.timestamp;
        await updateDoc(ref, dados);
        await registrarHistorico(`Editou agenda (${status})`, senha);
    } else {
        await setDoc(ref, dados);
        await registrarHistorico(`Criou ${status}`, senha);
    }

    alert("Sucesso!");
    resetaForm();
}

// --- MONITORAMENTO ---
function carregarDados() {
    onSnapshot(collection(db, "agendamentos"), (snap) => {
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
                            <button onclick="copiarEmail('${ag.senhaAgendamento}')" title="Copiar p/ Email"><i class="fas fa-envelope"></i></button>
                            <button onclick="prepararExcel('${ag.senhaAgendamento}')" title="Importar Excel"><i class="fas fa-file-excel"></i></button>
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
                            <td><button onclick="editarAg('${ag.senhaAgendamento}')"><i class="fas fa-edit"></i></button></td>
                        </tr>`;
                }
            }
        });
    });
}

// --- COPIAR PARA EMAIL ---
window.copiarEmail = async (senha) => {
    const snap = await getDocs(query(collection(db, "agendamentos")));
    const d = snap.docs.find(x => x.id === senha).data();
    const texto = `RESPOSTA DE AGENDAMENTO SIMONETTI\n\nSenha: ${d.senhaAgendamento}\nFornecedor: ${d.fornecedor}\nData: ${d.data}\nCentral: ${d.central}\nCarga: ${d.cargas}`;
    navigator.clipboard.writeText(texto);
    alert("Dados copiados! Agora é só colar no seu email.");
};

// --- FUNÇÕES DE INTERAÇÃO ---
window.editarAg = async (senha) => {
    const snap = await getDocs(query(collection(db, "agendamentos")));
    const d = snap.docs.find(x => x.id === senha).data();
    
    document.getElementById('senhaAgendamento').value = d.senhaAgendamento;
    document.getElementById('dataAgendamento').value = d.data;
    document.getElementById('selectFornecedor').value = d.fornecedor;
    document.getElementById('tipoProduto').value = d.tipoProduto;
    document.getElementById('cargas').value = d.cargas;
    
    document.getElementById('btnSalvar').style.display = 'none';
    document.getElementById('btnRascunho').style.display = 'none';
    document.getElementById('btnAtualizar').style.display = 'block';
    document.getElementById('form-title').innerText = "Editando " + senha;
};

window.resetaForm = () => {
    document.getElementById('btnSalvar').style.display = 'block';
    document.getElementById('btnRascunho').style.display = 'block';
    document.getElementById('btnAtualizar').style.display = 'none';
    document.getElementById('form-title').innerText = "Dados da Agenda";
    document.querySelectorAll('input').forEach(i => i.id !== 'buscaInicio' && i.id !== 'buscaFim' ? i.value = "" : null);
    gerarSenha();
};

// Inicialização e Eventos
window.addEventListener('DOMContentLoaded', () => { gerarSenha(); carregarDados(); carregarFornecedores(); });
document.getElementById('btnSalvar').onclick = () => salvarAgenda("Agendada");
document.getElementById('btnRascunho').onclick = () => salvarAgenda("Rascunho");
document.getElementById('btnAtualizar').onclick = () => salvarAgenda("Agendada", true);
document.getElementById('buscaGeral').oninput = carregarDados;
document.getElementById('buscaInicio').onchange = carregarDados;
document.getElementById('buscaFim').onchange = carregarDados;

// Modais (Gestão de Fornecedores e Excel permanecem com lógica similar à anterior)
window.abrirFornecedor = () => document.getElementById('modalFornecedor').style.display = 'flex';
window.fecharModais = () => document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');

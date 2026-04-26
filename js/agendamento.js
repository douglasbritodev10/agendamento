import { app } from './firebase-config.js';
import { 
    getFirestore, doc, setDoc, collection, addDoc, onSnapshot, query, orderBy, 
    updateDoc, deleteDoc, getDocs, limit 
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const db = getFirestore(app);

// --- CONFIGURAÇÃO DE DATA INICIAL (BRASIL) ---
const getDataBrasil = () => {
    const data = new Date();
    return new Date(data.getTime() - (data.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
};

document.getElementById('dataAgendamento').value = getDataBrasil();
document.getElementById('buscaInicio').value = getDataBrasil();
document.getElementById('buscaFim').value = getDataBrasil();

// --- GERADOR DE SENHA SEQUENCIAL ---
async function gerarSenhaSequencial() {
    const q = query(collection(db, "agendamentos"), orderBy("timestamp", "desc"), limit(1));
    const snap = await getDocs(q);
    let proxNumero = 1;

    if (!snap.empty) {
        const ultimaSenha = snap.docs[0].data().senhaAgendamento; // Ex: "05-SM"
        const numeroAtual = parseInt(ultimaSenha.split('-')[0]);
        proxNumero = numeroAtual + 1;
    }

    const senhaFormatada = String(proxNumero).padStart(2, '0') + "-SM";
    document.getElementById('senhaAgendamento').value = senhaFormatada;
}

// --- GESTÃO DE FORNECEDORES ---
async function carregarFornecedores() {
    onSnapshot(collection(db, "fornecedores"), (snap) => {
        const select = document.getElementById('selectFornecedor');
        const lista = document.getElementById('listaFornecedores');
        select.innerHTML = '<option value="">Selecione...</option>';
        lista.innerHTML = '';

        snap.forEach(d => {
            const f = d.data();
            select.innerHTML += `<option value="${f.nome}">${f.nome}</option>`;
            lista.innerHTML += `
                <li style="display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid #eee;">
                    ${f.nome}
                    <button onclick="excluirFornecedor('${d.id}')" style="color:red; border:none; background:none; cursor:pointer;"><i class="fas fa-trash"></i></button>
                </li>`;
        });
    });
}

window.salvarNovoFornecedor = async () => {
    const nome = document.getElementById('nomeNovoFornecedor').value.toUpperCase();
    if (!nome) return;
    await addDoc(collection(db, "fornecedores"), { nome });
    document.getElementById('nomeNovoFornecedor').value = '';
};

window.excluirFornecedor = async (id) => {
    if (confirm("Deseja excluir este fornecedor?")) await deleteDoc(doc(db, "fornecedores", id));
};

// --- SALVAR / ATUALIZAR AGENDA ---
async function processarAgenda(isUpdate = false) {
    const dados = {
        senhaAgendamento: document.getElementById('senhaAgendamento').value,
        data: document.getElementById('dataAgendamento').value,
        central: document.getElementById('central').value,
        fornecedor: document.getElementById('selectFornecedor').value,
        cargas: document.getElementById('cargas').value,
        pedidoCompra: document.getElementById('pedidoCompra').value,
        tipoProduto: document.getElementById('tipoProduto').value,
        linhaSeparacao: document.getElementById('linhaSeparacao').value,
        volumes: document.getElementById('volumes').value,
        status: "Agendada",
        timestamp: isUpdate ? null : new Date().getTime()
    };

    if (!dados.fornecedor || !dados.data) return alert("Preencha Data e Fornecedor!");

    try {
        const ref = doc(db, "agendamentos", dados.senhaAgendamento);
        if (isUpdate) {
            delete dados.timestamp; // Não muda o tempo na edição
            await updateDoc(ref, dados);
            alert("Agenda Atualizada!");
        } else {
            await setDoc(ref, dados);
            alert("Agendamento Concluído!");
        }
        resetaForm();
    } catch (e) { console.error(e); }
}

// --- BUSCA E MONITORAMENTO ---
function iniciarMonitoramento() {
    const q = query(collection(db, "agendamentos"), orderBy("timestamp", "desc"));
    onSnapshot(q, (snap) => {
        const corpo = document.getElementById('corpoTabela');
        const dInicio = document.getElementById('buscaInicio').value;
        const dFim = document.getElementById('buscaFim').value;
        const termo = document.getElementById('buscaGeral').value.toLowerCase();

        corpo.innerHTML = '';
        snap.forEach(docSnap => {
            const ag = docSnap.data();
            
            // Filtros de Data e Busca
            const dataOk = ag.data >= dInicio && ag.data <= dFim;
            const buscaOk = ag.fornecedor.toLowerCase().includes(termo) || ag.senhaAgendamento.toLowerCase().includes(termo);

            if (dataOk && buscaOk) {
                corpo.innerHTML += `
                    <tr>
                        <td><input type="checkbox" class="row-check" value="${ag.senhaAgendamento}"></td>
                        <td><b>${ag.senhaAgendamento}</b></td>
                        <td>${ag.data.split('-').reverse().join('/')}</td>
                        <td>${ag.central}</td>
                        <td>${ag.fornecedor}</td>
                        <td>${ag.volumes}</td>
                        <td>
                            <button onclick="editarAgenda('${ag.senhaAgendamento}')" title="Editar"><i class="fas fa-edit"></i></button>
                            <button onclick="verDetalhes('${ag.senhaAgendamento}')" title="Ver Detalhes"><i class="fas fa-box"></i></button>
                        </td>
                    </tr>`;
            }
        });
    });
}

// --- FUNÇÕES GLOBAIS DE INTERAÇÃO ---
window.editarAgenda = async (senha) => {
    const docRef = doc(db, "agendamentos", senha);
    const snap = await getDocs(query(collection(db, "agendamentos"))); // Simplificado para exemplo
    const dados = snap.docs.find(d => d.id === senha).data();

    document.getElementById('senhaAgendamento').value = dados.senhaAgendamento;
    document.getElementById('dataAgendamento').value = dados.data;
    document.getElementById('central').value = dados.central;
    document.getElementById('selectFornecedor').value = dados.fornecedor;
    document.getElementById('cargas').value = dados.cargas;
    document.getElementById('pedidoCompra').value = dados.pedidoCompra;
    document.getElementById('tipoProduto').value = dados.tipoProduto;
    document.getElementById('linhaSeparacao').value = dados.linhaSeparacao;
    document.getElementById('volumes').value = dados.volumes;

    document.getElementById('btnSalvar').style.display = 'none';
    document.getElementById('btnAtualizar').style.display = 'block';
    document.getElementById('form-title').innerText = "Editando Agenda";
};

window.verDetalhes = async (senha) => {
    // Aqui você pode buscar detalhes específicos se houver sub-coleções
    document.getElementById('modalComp').style.display = 'flex';
    document.getElementById('tituloComp').innerText = "Composição: " + senha;
    document.getElementById('conteudoComp').innerHTML = "Carregando informações da carga...";
};

window.resetaForm = () => {
    document.getElementById('btnSalvar').style.display = 'block';
    document.getElementById('btnAtualizar').style.display = 'none';
    document.getElementById('form-title').innerText = "Agendar Carga";
    document.querySelectorAll('input').forEach(i => i.value = '');
    document.getElementById('dataAgendamento').value = getDataBrasil();
    gerarSenhaSequencial();
};

// --- INICIALIZAÇÃO ---
window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('user-display').innerText = localStorage.getItem('usuarioNome') || "DBRITO";
    gerarSenhaSequencial();
    carregarFornecedores();
    iniciarMonitoramento();
});

// Eventos de Busca
document.getElementById('buscaInicio').addEventListener('change', iniciarMonitoramento);
document.getElementById('buscaFim').addEventListener('change', iniciarMonitoramento);
document.getElementById('buscaGeral').addEventListener('input', iniciarMonitoramento);

document.getElementById('btnSalvar').addEventListener('click', () => processarAgenda(false));
document.getElementById('btnAtualizar').addEventListener('click', () => processarAgenda(true));

// Modais
window.abrirFornecedor = () => document.getElementById('modalFornecedor').style.display = 'flex';
window.fecharModais = () => document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');

import { app } from './firebase-config.js';
import { 
    getFirestore, collection, onSnapshot, query, orderBy, doc, setDoc, addDoc, getDocs, deleteDoc, limit, where 
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const db = getFirestore(app);

// CONFIGURAÇÃO DE DATA INICIAL (HOJE - BRASIL)
const hoje = new Date().toISOString().split('T')[0];
document.getElementById('dataCarga').value = hoje;
document.getElementById('filtroDataInicio').value = hoje;
document.getElementById('filtroDataFim').value = hoje;

// --- GESTÃO DE SENHA ---
async function gerarSenha() {
    const q = query(collection(db, "agendamentos"), orderBy("criadoEm", "desc"), limit(1));
    const snap = await getDocs(q);
    let num = 1;
    if (!snap.empty) {
        const ultima = snap.docs[0].data().senhaAgendamento;
        num = parseInt(ultima.split('-')[0]) + 1;
    }
    document.getElementById('senhaAgendamento').value = `${String(num).padStart(2, '0')}-SM`;
}

// --- GESTÃO DE FORNECEDORES ---
window.abrirModalFornecedor = () => {
    document.getElementById('modalFornecedor').style.display = 'flex';
    listarFornecedores();
};

window.salvarFornecedor = async () => {
    const nome = document.getElementById('novoFornecedorNome').value.toUpperCase();
    if (!nome) return;
    await addDoc(collection(db, "fornecedores"), { nome });
    document.getElementById('novoFornecedorNome').value = "";
};

function listarFornecedores() {
    onSnapshot(collection(db, "fornecedores"), (snap) => {
        const list = document.getElementById('listaFornecedoresModal');
        const select = document.getElementById('fornecedorSelect');
        list.innerHTML = ""; select.innerHTML = "";
        snap.forEach(d => {
            const f = d.data();
            list.innerHTML += `<li>${f.nome} <button onclick="window.excluirFornecedor('${d.id}')" style="background:none; color:red; cursor:pointer;">[X]</button></li>`;
            select.innerHTML += `<option value="${f.nome}">${f.nome}</option>`;
        });
    });
}

window.excluirFornecedor = async (id) => { if(confirm("Excluir fornecedor?")) await deleteDoc(doc(db, "fornecedores", id)); };

// --- COMPOSIÇÃO E ITENS ---
window.addLinhaItem = (cod = '', desc = '', qtd = '') => {
    const div = document.createElement('div');
    div.className = 'item-row';
    div.innerHTML = `
        <input type="text" class="p-cod" placeholder="Cód" value="${cod}">
        <input type="text" class="p-desc" placeholder="Desc" value="${desc}">
        <input type="number" class="p-qtd" placeholder="Qtd" value="${qtd}">
        <button type="button" class="btn-del" onclick="this.parentElement.remove()">X</button>`;
    document.getElementById('listaItens').appendChild(div);
};

// --- SALVAR / ATUALIZAR ---
document.getElementById('btnFinalizar').addEventListener('click', async () => {
    const editId = document.getElementById('editandoId').value;
    const senha = document.getElementById('senhaAgendamento').value;
    const dados = {
        senhaAgendamento: senha,
        data: document.getElementById('dataCarga').value,
        central: document.getElementById('central').value,
        cargaTransporte: document.getElementById('cargaTransporte').value,
        fornecedor: document.getElementById('fornecedorSelect').value,
        pedidoCompra: document.getElementById('pedidoCompra').value,
        volumes: document.getElementById('volumes').value,
        linhaSeparacao: document.getElementById('linhaSeparacao').value,
        usuarioResponsavel: "DBRITO",
        criadoEm: editId ? parseInt(editId) : new Date().getTime()
    };

    await setDoc(doc(db, "agendamentos", senha), dados);
    
    // Limpar itens antigos se for edição e salvar novos
    const qItens = query(collection(db, "itens_agenda"), where("senhaAgendamento", "==", senha));
    const snapItens = await getDocs(qItens);
    snapItens.forEach(async d => await deleteDoc(doc(db, "itens_agenda", d.id)));

    const linhas = document.querySelectorAll('.item-row');
    for (let l of linhas) {
        await addDoc(collection(db, "itens_agenda"), {
            senhaAgendamento: senha,
            codigo: l.querySelector('.p-cod').value,
            desc: l.querySelector('.p-desc').value,
            qtd: l.querySelector('.p-qtd').value
        });
    }
    alert("Salvo com sucesso!");
    location.reload();
});

// --- VISUALIZAR COMPOSIÇÃO ---
window.verItens = async (senha) => {
    document.getElementById('tituloModalComp').innerText = "Composição: " + senha;
    const q = query(collection(db, "itens_agenda"), where("senhaAgendamento", "==", senha));
    const snap = await getDocs(q);
    const corpo = document.getElementById('corpoModalComp');
    corpo.innerHTML = "";
    snap.forEach(d => {
        const i = d.data();
        corpo.innerHTML += `<tr><td>${i.codigo}</td><td>${i.desc}</td><td>${i.qtd}</td></tr>`;
    });
    document.getElementById('modalComposicao').style.display = 'flex';
};

// --- EDITAR AGENDA ---
window.editarAgendamento = async (senha) => {
    const d = await getDocs(query(collection(db, "agendamentos"), where("senhaAgendamento", "==", senha)));
    const data = d.docs[0].data();
    
    document.getElementById('editandoId').value = data.criadoEm;
    document.getElementById('senhaAgendamento').value = data.senhaAgendamento;
    document.getElementById('dataCarga').value = data.data;
    document.getElementById('cargaTransporte').value = data.cargaTransporte;
    document.getElementById('pedidoCompra').value = data.pedidoCompra;
    document.getElementById('volumes').value = data.volumes;
    
    document.getElementById('listaItens').innerHTML = "";
    const it = await getDocs(query(collection(db, "itens_agenda"), where("senhaAgendamento", "==", senha)));
    it.forEach(i => window.addLinhaItem(i.data().codigo, i.data().desc, i.data().qtd));
    
    document.getElementById('tituloForm').innerText = "✏️ Editando Agendamento";
    document.getElementById('btnCancelarEdicao').style.display = "block";
    window.scrollTo(0,0);
};

// --- FILTRO E TABELA ---
function carregarTabela() {
    const inicio = document.getElementById('filtroDataInicio').value;
    const fim = document.getElementById('filtroDataFim').value;
    const busca = document.getElementById('buscaGeral').value.toUpperCase();

    onSnapshot(query(collection(db, "agendamentos"), orderBy("data", "desc")), (snap) => {
        const corpo = document.getElementById('corpoTabela');
        corpo.innerHTML = "";
        snap.forEach(doc => {
            const c = doc.data();
            const dataOk = c.data >= inicio && c.data <= fim;
            const buscaOk = !busca || c.senhaAgendamento.includes(busca) || c.fornecedor.toUpperCase().includes(busca);

            if (dataOk && buscaOk) {
                corpo.innerHTML += `
                <tr>
                    <td><input type="checkbox" class="sel-agenda" value="${c.senhaAgendamento}"></td>
                    <td><b>${c.senhaAgendamento}</b></td>
                    <td>${c.data.split('-').reverse().join('/')}</td>
                    <td>${c.central}</td>
                    <td>${c.fornecedor}</td>
                    <td>${c.cargaTransporte}</td>
                    <td>
                        <button onclick="window.verItens('${c.senhaAgendamento}')">📦</button>
                        <button onclick="window.editarAgendamento('${c.senhaAgendamento}')">✏️</button>
                    </td>
                </tr>`;
            }
        });
    });
}

// Eventos de Filtro
['filtroDataInicio', 'filtroDataFim', 'buscaGeral'].forEach(id => {
    document.getElementById(id).addEventListener('change', carregarTabela);
    document.getElementById(id).addEventListener('keyup', carregarTabela);
});

// --- EXPORTAÇÃO ---
window.exportarExcel = () => {
    const selecionados = Array.from(document.querySelectorAll('.sel-agenda:checked')).map(cb => cb.value);
    if(selecionados.length === 0) return alert("Selecione ao menos uma agenda!");
    // Lógica para gerar JSON e converter via XLSX library
    alert("Gerando Excel das " + selecionados.length + " agendas...");
};

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    gerarSenha();
    listarFornecedores();
    carregarTabela();
    window.addLinhaItem();
});

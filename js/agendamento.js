import { app } from './firebase-config.js';
import { 
    getFirestore, collection, onSnapshot, query, orderBy, doc, setDoc, addDoc, getDocs, limit 
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const db = getFirestore(app);

// --- 1. GERAÇÃO DE SENHA SEQUENCIAL (01-SM, 02-SM...) ---
async function configurarSenha() {
    const q = query(collection(db, "agendamentos"), orderBy("criadoEm", "desc"), limit(1));
    const querySnapshot = await getDocs(q);
    let proxNumero = 1;

    if (!querySnapshot.empty) {
        const ultimaSenha = querySnapshot.docs[0].data().senhaAgendamento;
        if (ultimaSenha && ultimaSenha.includes('-')) {
            const numeroAtual = parseInt(ultimaSenha.split('-')[0]);
            proxNumero = numeroAtual + 1;
        }
    }
    
    const senhaFinal = `${String(proxNumero).padStart(2, '0')}-SM`;
    document.getElementById('senhaAgendamento').value = senhaFinal;
}

// --- 2. FUNÇÕES GLOBAIS (CORREÇÃO PARA REFERENCE ERROR) ---
window.addLinhaItem = () => {
    const container = document.getElementById('listaItens');
    const div = document.createElement('div');
    div.className = 'item-row';
    div.innerHTML = `
        <input type="text" class="prod-id" placeholder="Cód">
        <input type="text" class="prod-desc" placeholder="Descrição">
        <input type="number" class="prod-qtd" placeholder="Qtd">
        <button type="button" class="btn-del" onclick="this.parentElement.remove()">X</button>
    `;
    container.appendChild(div);
};

window.verItens = (senha) => {
    alert("Visualizando composição da carga: " + senha);
    // Aqui você pode implementar a abertura de um Modal para listar os itens da coleção 'itens_agenda'
};

window.editarAgendamento = (id) => {
    alert("Função de edição para o ID: " + id);
};

// --- 3. SALVAR NO FIRESTORE ---
document.getElementById('btnFinalizar').addEventListener('click', async () => {
    const btn = document.getElementById('btnFinalizar');
    const senha = document.getElementById('senhaAgendamento').value;

    const dadosCarga = {
        senhaAgendamento: senha,
        data: document.getElementById('dataCarga').value,
        central: document.getElementById('central').value,
        cargaTransporte: document.getElementById('cargaTransporte').value,
        pedidoCompra: document.getElementById('pedidoCompra').value,
        fornecedor: document.getElementById('fornecedor').value,
        tipoProduto: document.getElementById('tipoProduto').value,
        linhaSeparacao: document.getElementById('linhaSeparacao').value,
        volumes: document.getElementById('volumes').value,
        status: "Agendada",
        criadoEm: new Date().getTime()
    };

    btn.disabled = true;
    btn.innerText = "SALVANDO...";

    try {
        // Salva a carga
        await setDoc(doc(db, "agendamentos", senha), dadosCarga);

        // Salva os itens da composição
        const linhas = document.querySelectorAll('.item-row');
        for (const linha of linhas) {
            const cod = linha.querySelector('.prod-id').value;
            const desc = linha.querySelector('.prod-desc').value;
            const qtd = linha.querySelector('.prod-qtd').value;

            if (cod && desc) {
                await addDoc(collection(db, "itens_agenda"), {
                    senhaAgendamento: senha,
                    codigo: cod,
                    descricao: desc,
                    quantidade: qtd
                });
            }
        }

        alert("Agendamento " + senha + " realizado!");
        window.location.reload();

    } catch (error) {
        console.error(error);
        alert("Erro ao salvar.");
        btn.disabled = false;
        btn.innerText = "FINALIZAR E SALVAR AGENDAMENTO";
    }
});

// --- 4. LISTAR AGENDAMENTOS NA TABELA ---
onSnapshot(query(collection(db, "agendamentos"), orderBy("criadoEm", "desc")), (snapshot) => {
    const corpo = document.getElementById('corpoTabelaAgendamentos');
    corpo.innerHTML = "";
    snapshot.forEach((doc) => {
        const c = doc.data();
        corpo.innerHTML += `
            <tr>
                <td><strong>${c.senhaAgendamento}</strong></td>
                <td>${c.data}</td>
                <td>${c.central}</td>
                <td>${c.cargaTransporte}</td>
                <td>${c.fornecedor}</td>
                <td>
                    <button onclick="window.verItens('${c.senhaAgendamento}')">📦</button>
                    <button onclick="window.editarAgendamento('${doc.id}')">✏️</button>
                </td>
            </tr>
        `;
    });
});

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    configurarSenha();
    window.addLinhaItem(); // Começa com uma linha vazia
});

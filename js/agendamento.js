import { app } from './firebase-config.js';
import { 
    getFirestore, collection, onSnapshot, query, orderBy, doc, setDoc, addDoc, getDocs, where 
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const db = getFirestore(app);
const nivel = localStorage.getItem('nivelAcesso'); // 'ADM' ou 'Leitor'
const usuarioNome = localStorage.getItem('usuarioNome');

document.addEventListener('DOMContentLoaded', () => {
    // 1. Identifica Usuário
    document.getElementById('labelUsuario').innerText = `Usuário: ${usuarioNome}`;

    // 2. Controle de Acesso (Trava ADM)
    if (nivel === 'ADM') {
        document.querySelectorAll('.ocultar-adm').forEach(el => el.style.display = 'block');
        gerarNovaSenha();
    }

    // 3. Carregar Tabela
    carregarTabela();
});

// FUNÇÃO BUSCA E FILTRO
document.getElementById('buscaCarga').addEventListener('input', (e) => {
    const termo = e.target.value.toLowerCase();
    const linhas = document.querySelectorAll('#corpoTabelaAgendamentos tr');
    
    linhas.forEach(linha => {
        const texto = linha.innerText.toLowerCase();
        linha.style.display = texto.includes(termo) ? '' : 'none';
    });
});

async function carregarTabela() {
    const q = query(collection(db, "agendamentos"), orderBy("data", "desc"));
    
    onSnapshot(q, (snapshot) => {
        const corpo = document.getElementById('corpoTabelaAgendamentos');
        corpo.innerHTML = "";

        snapshot.forEach(documento => {
            const c = documento.data();
            const tr = document.createElement('tr');
            
            tr.innerHTML = `
                <td><strong>${c.senhaAgendamento}</strong></td>
                <td>${c.data}</td>
                <td>${c.fornecedor}</td>
                <td>${c.cargaTransporte}</td>
                <td><button onclick="verItens('${c.senhaAgendamento}')">📦 Ver Itens</button></td>
                <td class="${nivel !== 'ADM' ? 'ocultar-adm' : ''}">
                    <button onclick="editarAgendamento('${documento.id}')">✏️</button>
                </td>
            `;
            corpo.appendChild(tr);
        });
    });
}

// Lógica de Salvar (Apenas para ADM)
document.getElementById('btnFinalizar')?.addEventListener('click', async () => {
    const senha = document.getElementById('senhaAgendamento').value;
    const dados = {
        senhaAgendamento: senha,
        data: document.getElementById('dataCarga').value,
        fornecedor: document.getElementById('fornecedor').value,
        cargaTransporte: document.getElementById('transporte').value,
        status: "Agendado"
    };

    try {
        await setDoc(doc(db, "agendamentos", senha), dados);
        
        // Salva itens da composição
        const linhas = document.querySelectorAll('.item-row');
        for (const linha of linhas) {
            const cod = linha.querySelector('.prod-id').value;
            if(cod) {
                await addDoc(collection(db, "itens_agenda"), {
                    senhaAgendamento: senha,
                    codigo: cod,
                    desc: linha.querySelector('.prod-desc').value,
                    qtd: linha.querySelector('.prod-qtd').value
                });
            }
        }
        alert("Agendamento salvo!");
        location.reload();
    } catch (e) { alert("Erro ao salvar"); }
});

function gerarNovaSenha() {
    const random = Math.floor(1000 + Math.random() * 9000);
    document.getElementById('senhaAgendamento').value = `SIM-${new Date().getFullYear()}-${random}`;
}

window.exportarPDF = () => { window.print(); };

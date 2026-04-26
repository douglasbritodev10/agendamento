import { app } from './firebase-config.js';
import { 
    getFirestore, doc, setDoc, collection, addDoc, onSnapshot, query, orderBy 
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";

const db = getFirestore(app);
const auth = getAuth(app);

// Configuração de Identidade
document.getElementById('user-display').innerText = localStorage.getItem('username') || "USUÁRIO";

// Gerador de Senha Profissional
const gerarSenha = () => {
    const data = new Date();
    const random = Math.floor(1000 + Math.random() * 9000);
    return `SIM-${data.getFullYear()}${String(data.getMonth()+1).padStart(2,'0')}-${random}`;
};

const inputSenha = document.getElementById('senhaAgendamento');
inputSenha.value = gerarSenha();

// Regras de Cores Inteligentes
function obterCorTipo(tipo) {
    const tp = tipo.toUpperCase();
    if (tp.includes("MÓVEIS") || tp.includes("ROUPEIRO")) return "#FFFF00";
    if (tp.includes("ELETRO") || tp.includes("CELULAR")) return "#00BFFF";
    if (tp.includes("MESA")) return "#4CAF50";
    return "#E0E0E0";
}

// Processar e Salvar
async function salvarCarga(status) {
    const senha = inputSenha.value;
    const data = document.getElementById('dataAgendamento').value;
    const fornecedor = document.getElementById('selectFornecedor').value;
    const tipo = document.getElementById('tipoProduto').value;
    const transporte = document.getElementById('cargaTransporte').value;

    if (!data || !fornecedor) {
        alert("Preencha a data e o fornecedor!");
        return;
    }

    try {
        await setDoc(doc(db, "agendamentos", senha), {
            senhaAgendamento: senha,
            data: data,
            fornecedor: fornecedor,
            tipoProduto: tipo,
            cargaTransporte: transporte,
            status: status,
            criadoPor: localStorage.getItem('username'),
            timestamp: new Date().getTime()
        });

        // Registrar Histórico
        await addDoc(collection(db, "historico"), {
            usuario: localStorage.getItem('username'),
            acao: `Criou agendamento (${status})`,
            senhaAgendamento: senha,
            dataHora: new Date().toISOString()
        });

        alert("Carga registrada com sucesso!");
        location.reload(); // Reseta para nova senha e limpa campos

    } catch (e) {
        console.error(e);
        alert("Erro ao salvar.");
    }
}

// Escuta em tempo real para a tabela lateral
const q = query(collection(db, "agendamentos"), orderBy("timestamp", "desc"));
onSnapshot(q, (snap) => {
    const corpo = document.getElementById('corpoTabela');
    corpo.innerHTML = "";
    
    snap.forEach(d => {
        const ag = d.data();
        const cor = obterCorTipo(ag.tipoProduto);
        
        corpo.innerHTML += `
            <tr style="${ag.status === 'Rascunho' ? 'opacity: 0.6' : ''}">
                <td><b>${ag.senhaAgendamento}</b></td>
                <td>${ag.data.split('-').reverse().join('/')}</td>
                <td>${ag.fornecedor}</td>
                <td><span class="badge-tipo" style="background:${cor}">${ag.tipoProduto}</span></td>
                <td>${ag.status}</td>
                <td><button onclick="verDetalhes('${ag.senhaAgendamento}')"><i class="fas fa-eye"></i></button></td>
            </tr>
        `;
    });
});

document.getElementById('btnSalvar').addEventListener('click', () => salvarCarga("Agendada"));
document.getElementById('btnRascunho').addEventListener('click', () => salvarCarga("Rascunho"));

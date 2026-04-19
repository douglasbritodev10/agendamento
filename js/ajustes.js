import { app } from './firebase-config.js';
import { 
    getFirestore, 
    collection, 
    onSnapshot, 
    doc, 
    getDoc, 
    setDoc, 
    addDoc 
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const db = getFirestore(app);
let senhaSelecionada = "";

// 1. CARREGA LISTA DE CARGAS
onSnapshot(collection(db, "agendamentos"), (snapshot) => {
    const corpo = document.getElementById('corpoAjustes');
    corpo.innerHTML = "";
    
    snapshot.forEach(async (documento) => {
        const carga = documento.data();
        const id = documento.id;

        // Buscamos se já existe um ajuste para essa carga
        const ajusteDoc = await getDoc(doc(db, "ajustes", id));
        const ajusteData = ajusteDoc.exists() ? ajusteDoc.data() : { statusAjuste: 'Sem ajuste', notaFiscal: '-' };

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${id}</strong></td>
            <td>${carga.fornecedor}</td>
            <td><span class="badge-ajuste ajuste-${ajusteData.statusAjuste.toLowerCase().replace(" ","")}">${ajusteData.statusAjuste}</span></td>
            <td>${ajusteData.notaFiscal}</td>
            <td><button class="btn-primary" onclick="abrirEdicao('${id}')" style="padding:5px 10px; font-size:0.7rem;">EDITAR</button></td>
        `;
        corpo.appendChild(tr);
    });
});

// 2. ABRE PAINEL LATERAL PARA EDITAR
window.abrirEdicao = async (senha) => {
    senhaSelecionada = senha;
    document.getElementById('painelEdicao').style.display = 'flex';
    document.getElementById('labelSenha').innerText = "Senha: " + senha;

    // Busca dados atuais do ajuste
    const ajusteDoc = await getDoc(doc(db, "ajustes", senha));
    if (ajusteDoc.exists()) {
        const d = ajusteDoc.data();
        document.getElementById('statusAjuste').value = d.statusAjuste;
        document.getElementById('notaFiscal').value = d.notaFiscal;
        document.getElementById('obsAjuste').value = d.observacao;
    } else {
        document.getElementById('statusAjuste').value = "Sem ajuste";
        document.getElementById('notaFiscal').value = "";
        document.getElementById('obsAjuste').value = "";
    }
};

// 3. SALVA O AJUSTE NO FIRESTORE
document.getElementById('btnSalvarAjuste').addEventListener('click', async () => {
    const status = document.getElementById('statusAjuste').value;
    const nf = document.getElementById('notaFiscal').value;
    const obs = document.getElementById('obsAjuste').value;

    try {
        await setDoc(doc(db, "ajustes", senhaSelecionada), {
            senhaAgendamento: senhaSelecionada,
            statusAjuste: status,
            notaFiscal: nf,
            observacao: obs,
            dataAtualizacao: new Date().toISOString()
        });

        // Registrar no histórico de auditoria
        await addDoc(collection(db, "historico"), {
            usuario: localStorage.getItem('user_email') || "Sistema",
            acao: `Atualizou ajuste: ${status}`,
            senhaAgendamento: senhaSelecionada,
            dataHora: new Date().toISOString()
        });

        alert("Ajuste atualizado com sucesso!");
        document.getElementById('painelEdicao').style.display = 'none';

    } catch (e) {
        console.error(e);
        alert("Erro ao salvar ajuste.");
    }
});

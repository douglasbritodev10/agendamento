import { app } from './firebase-config.js';
import { 
    getFirestore, 
    collection, 
    onSnapshot, 
    doc, 
    updateDoc, 
    addDoc 
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const db = getFirestore(app);
const corpoTabela = document.getElementById('corpoTabela');

// 1. ESCUTA O BANCO EM TEMPO REAL
const carregarCargas = () => {
    const dataHoje = new Date().toISOString().split('T')[0];

    onSnapshot(collection(db, "agendamentos"), (snapshot) => {
        corpoTabela.innerHTML = "";
        
        snapshot.forEach((documento) => {
            const carga = documento.data();
            const id = documento.id;

            // Regra: Mostrar se for hoje OU se estiver atrasada OU se estiver fixada
            if (carga.data === dataHoje || carga.status === 'Atrasada' || carga.fixado === true) {
                renderizarLinha(id, carga);
            }
        });
    });
};

// 2. RENDERIZA CADA LINHA NA TABELA
function renderizarLinha(id, carga) {
    const tr = document.createElement('tr');
    
    let classeStatus = `status-${carga.status.toLowerCase().replace(" ", "")}`;
    if (carga.status === 'Em recebimento') classeStatus = 'status-progresso';

    tr.innerHTML = `
        <td><strong>${carga.senhaAgendamento}</strong></td>
        <td>${carga.fornecedor}</td>
        <td>${carga.cargaTransporte}</td>
        <td><span class="status-badge ${classeStatus}">${carga.status}</span></td>
        <td>${carga.volumes}</td>
        <td>
            <select class="btn-status" onchange="atualizarStatus('${id}', this.value)">
                <option value="">Alterar Status</option>
                <option value="Em recebimento">🚚 Em Recebimento</option>
                <option value="Recebida">✅ Recebida</option>
                <option value="Atrasada">⚠️ Atrasada</option>
                <option value="Sobre ajuste">🛠️ Sobre Ajuste</option>
            </select>
        </td>
    `;
    corpoTabela.appendChild(tr);
}

// 3. ATUALIZA STATUS NO FIRESTORE
window.atualizarStatus = async (id, novoStatus) => {
    if (!novoStatus) return;

    try {
        const cargaRef = doc(db, "agendamentos", id);
        await updateDoc(cargaRef, { status: novoStatus });

        // Registrar no histórico
        await addDoc(collection(db, "historico"), {
            usuario: localStorage.getItem('user_email') || "Sistema",
            acao: `Alterou status para: ${novoStatus}`,
            senhaAgendamento: id,
            dataHora: new Date().toISOString()
        });

        alert("Status atualizado!");
    } catch (e) {
        console.error("Erro ao atualizar status:", e);
    }
};

// Inicia a escuta
carregarCargas();

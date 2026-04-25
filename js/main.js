import { app } from './firebase-config.js';
import { getFirestore, collection, query, getDocs } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', async () => {
    const nivel = localStorage.getItem('nivelAcesso');
    const email = localStorage.getItem('usuarioEmail');
    const nome = localStorage.getItem('usuarioNome');

    if (!nivel) {
        window.location.href = "index.html";
        return;
    }

    // Exibe o nome ou email no topo
    document.getElementById('userName').innerText = nome || email;

    // Controle de privilégios para o card de Gestão
    if (nivel === 'ADM') {
        const cardAdmin = document.getElementById('cardAdmin');
        if (cardAdmin) cardAdmin.style.display = 'flex';
    }

    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('dataAtual').innerText = new Date().toLocaleDateString('pt-BR', options);

    await carregarIndicadores();
});

async function carregarIndicadores() {
    try {
        const q = query(collection(db, "agendamentos"));
        const snap = await getDocs(q);
        
        let total = 0, atrasadas = 0, progresso = 0;

        snap.forEach((doc) => {
            const status = doc.data().status;
            total++;
            if (status === 'Atrasada') atrasadas++;
            if (status === 'Em recebimento') progresso++;
        });

        document.getElementById('resumoTotal').innerText = total;
        document.getElementById('resumoAtrasadas').innerText = atrasadas;
        document.getElementById('resumoProgresso').innerText = progresso;
    } catch (e) {
        console.error("Erro indicadores:", e);
    }
}

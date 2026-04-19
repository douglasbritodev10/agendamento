import { app } from './firebase-config.js';
import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Verifica Nível de Acesso no LocalStorage
    const nivel = localStorage.getItem('nivelAcesso');
    const email = localStorage.getItem('usuarioEmail');

    if (!nivel) {
        window.location.href = "index.html";
        return;
    }

    // Exibe o email do usuário e libera card de ADM
    document.getElementById('userName').innerText = email;
    if (nivel === 'ADM') {
        document.getElementById('cardAdmin').style.display = 'flex';
    }

    // 2. Atualiza Data Atual
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('dataAtual').innerText = new Date().toLocaleDateString('pt-BR', options);

    // 3. Busca Indicadores Rápidos no Firestore
    await carregarIndicadores();
});

async function carregarIndicadores() {
    try {
        const q = query(collection(db, "agendamentos")); // Adicionar filtros de data aqui depois
        const querySnapshot = await getDocs(q);
        
        let total = 0;
        let atrasadas = 0;
        let progresso = 0;

        querySnapshot.forEach((doc) => {
            const status = doc.data().status;
            total++;
            if (status === 'Atrasada') atrasadas++;
            if (status === 'Em recebimento') progresso++;
        });

        document.getElementById('resumoTotal').innerText = total;
        document.getElementById('resumoAtrasadas').innerText = atrasadas;
        document.getElementById('resumoProgresso').innerText = progresso;

    } catch (e) {
        console.error("Erro ao carregar indicadores:", e);
    }
}

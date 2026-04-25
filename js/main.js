import { app } from './firebase-config.js';
import { getFirestore, collection, query, getDocs } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Recupera dados do LocalStorage
    const nivel = localStorage.getItem('nivelAcesso');
    const email = localStorage.getItem('usuarioEmail');

    // 2. Proteção de Rota: Se não houver nível, volta para o login
    if (!nivel) {
        window.location.href = "index.html";
        return;
    }

    // 3. Atualiza a Interface com os dados do usuário
    document.getElementById('userName').innerText = email;

    // Se for ADM, mostra o card de gestão de usuários
    if (nivel === 'ADM') {
        const cardAdmin = document.getElementById('cardAdmin');
        if (cardAdmin) cardAdmin.style.display = 'flex';
    }

    // 4. Atualiza Data Atual
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('dataAtual').innerText = new Date().toLocaleDateString('pt-BR', options);

    // 5. Carrega os dados do Dashboard
    await carregarIndicadores();
});

async function carregarIndicadores() {
    try {
        const q = query(collection(db, "agendamentos"));
        const querySnapshot = await getDocs(q);
        
        let total = 0;
        let atrasadas = 0;
        let progresso = 0;

        querySnapshot.forEach((doc) => {
            const status = doc.data().status;
            total++;
            // Note: Verifique se os textos batem exatamente com o que está no seu Firestore
            if (status === 'Atrasada') atrasadas++;
            if (status === 'Em recebimento' || status === 'Em progresso') progresso++;
        });

        document.getElementById('resumoTotal').innerText = total;
        document.getElementById('resumoAtrasadas').innerText = atrasadas;
        document.getElementById('resumoProgresso').innerText = progresso;

    } catch (e) {
        console.error("Erro ao carregar indicadores:", e);
    }
}

import { app } from './firebase-config.js';
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { getFirestore, collection, query, getDocs, where } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const auth = getAuth(app);
const db = getFirestore(app);

// Verificação de Autenticação e Nível de Acesso
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = "index.html";
        return;
    }

    // Carrega dados da sessão (localStorage salvos no login)
    const nome = localStorage.getItem('usuarioNome');
    const username = localStorage.getItem('username');
    const nivel = localStorage.getItem('nivelAcesso');

    document.getElementById('user-display').innerText = username || nome;

    // Controle de Visibilidade do Card Admin
    if (nivel === 'ADM') {
        const cardAdmin = document.getElementById('cardAdmin');
        if (cardAdmin) cardAdmin.style.display = 'flex';
    }

    carregarIndicadores();
});

// Data Atual Formatada
const opcoes = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
document.getElementById('data-atual').innerText = new Date().toLocaleDateString('pt-BR', opcoes);

// Logout
document.getElementById('btnSair').addEventListener('click', () => {
    signOut(auth).then(() => {
        localStorage.clear();
        window.location.href = "index.html";
    });
});

async function carregarIndicadores() {
    try {
        const dataHoje = new Date().toISOString().split('T')[0];
        const q = query(collection(db, "agendamentos"));
        const snap = await getDocs(q);
        
        let total = 0, atrasadas = 0, progresso = 0;

        snap.forEach((doc) => {
            const d = doc.data();
            // Conta cargas de hoje ou que ainda estão pendentes
            if (d.data === dataHoje || d.status !== 'Recebida') {
                total++;
                if (d.status === 'Atrasada') atrasadas++;
                if (d.status === 'Em recebimento') progresso++;
            }
        });

        document.getElementById('resumoTotal').innerText = total;
        document.getElementById('resumoAtrasadas').innerText = atrasadas;
        document.getElementById('resumoProgresso').innerText = progresso;
    } catch (e) {
        console.error("Erro indicadores:", e);
    }
}

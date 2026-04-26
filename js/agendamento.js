import { app } from './firebase-config.js';
import { 
    getFirestore, collection, addDoc, getDocs, query, where, orderBy, doc, updateDoc, setDoc 
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const db = getFirestore(app);
const nivel = localStorage.getItem('nivelAcesso');

document.addEventListener('DOMContentLoaded', () => {
    // 1. Controle de Acesso
    if (nivel === 'ADM' || nivel === 'AGENDAMENTO') {
        document.getElementById('areaCadastro').style.display = 'block';
    }

    // 2. Datas Padrão (Hoje)
    const hoje = new Date().toISOString().split('T')[0];
    document.getElementById('filtroDataInicio').value = hoje;
    document.getElementById('filtroDataFim').value = hoje;
    document.getElementById('dataCarga').value = hoje;

    // 3. Gerar Senha Inicial
    document.getElementById('senhaAgendamento').value = `SIM-${Date.now().toString().slice(-6)}`;

    carregarAgendamentos(hoje, hoje);
});

// FUNÇÃO CARREGAR DADOS
async function carregarAgendamentos(inicio, fim) {
    const corpo = document.getElementById('corpoAgendamentos');
    corpo.innerHTML = "<tr><td colspan='8'>Buscando...</td></tr>";

    try {
        const q = query(
            collection(db, "agendamentos"),
            where("data", ">=", inicio),
            where("data", "<=", fim),
            orderBy("data", "desc")
        );

        const snap = await getDocs(q);
        corpo.innerHTML = "";

        snap.forEach(docSnap => {
            const d = docSnap.data();
            const isFracionada = d.linkSenha ? `<br><small style="color:blue">🔗 Link: ${d.linkSenha}</small>` : "";
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><input type="checkbox" class="row-select" data-id="${docSnap.id}"></td>
                <td><strong>${d.senhaAgendamento}</strong>${isFracionada}</td>
                <td>${d.data}</td>
                <td>${d.central}</td>
                <td>${d.fornecedor}</td>
                <td>${d.cargaTransporte}</td>
                <td>${d.volumes || 0}</td>
                <td>
                    ${(nivel === 'ADM') ? `<button onclick="editarCarga('${docSnap.id}')" class="btn-edit">✏️</button>` : '---'}
                </td>
            `;
            corpo.appendChild(tr);
        });
    } catch (e) {
        console.error(e);
        corpo.innerHTML = "<tr><td colspan='8'>Erro ao carregar ou sem dados no período.</td></tr>";
    }
}

// LÓGICA DE SALVAR (Com contador de veículo inteligente)
document.getElementById('btnFinalizar').addEventListener('click', async () => {
    const senha = document.getElementById('senhaAgendamento').value;
    const link = document.getElementById('linkSenha').value.trim();
    
    const dados = {
        senhaAgendamento: senha,
        data: document.getElementById('dataCarga').value,
        central: document.getElementById('central').value,
        fornecedor: document.getElementById('fornecedor').value,
        cargaTransporte: document.getElementById('transporte').value,
        linkSenha: link,
        // Se houver link, contaVeiculo é 0, se não, é 1 (para o seu contador de dashboard)
        contaVeiculo: link ? 0 : 1, 
        status: "Agendada",
        criadoEm: new Date().toISOString()
    };

    try {
        await setDoc(doc(db, "agendamentos", senha), dados);
        alert("Agendamento Salvo!");
        location.reload();
    } catch (e) {
        alert("Erro ao salvar.");
    }
});

// EXPORTAÇÃO EXCEL (Exemplo simples usando SheetJS)
window.exportarExcel = () => {
    const table = document.getElementById("tabelaAgendamentos");
    const wb = XLSX.utils.table_to_book(table);
    XLSX.writeFile(wb, `Agendamentos_Simonetti_${Date.now()}.xlsx`);
};

// FILTRO
document.getElementById('btnFiltrar').addEventListener('click', () => {
    const i = document.getElementById('filtroDataInicio').value;
    const f = document.getElementById('filtroDataFim').value;
    carregarAgendamentos(i, f);
});

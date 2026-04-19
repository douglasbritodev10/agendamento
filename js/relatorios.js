import { app } from './firebase-config.js';
import { 
    getFirestore, 
    collection, 
    query, 
    where, 
    getDocs, 
    orderBy 
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', () => {
    // 1. Define a data de hoje no padrão do Brasil (fuso local)
    const agora = new Date();
    const offset = agora.getTimezoneOffset();
    const dataBrasil = new Date(agora.getTime() - (offset * 60 * 1000)).toISOString().split('T')[0];

    // Preenche os inputs de data com o dia de hoje
    document.getElementById('dataInicio').value = dataBrasil;
    document.getElementById('dataFim').value = dataBrasil;

    // Carrega o histórico de hoje inicialmente
    carregarHistorico(dataBrasil, dataBrasil);
});

// 2. Lógica do botão de filtro
document.getElementById('btnFiltrar').addEventListener('click', () => {
    const inicio = document.getElementById('dataInicio').value;
    const fim = document.getElementById('dataFim').value;
    carregarHistorico(inicio, fim);
});

async function carregarHistorico(inicio, fim) {
    const corpo = document.getElementById('corpoHistorico');
    corpo.innerHTML = `<tr><td colspan="4" style="text-align:center;">Buscando dados...</td></tr>`;

    try {
        // Criamos a consulta ordenada por data (mais recente primeiro)
        const q = query(
            collection(db, "historico"),
            orderBy("dataHora", "desc")
        );

        const querySnapshot = await getDocs(q);
        corpo.innerHTML = "";

        // Definimos o limite das datas para o filtro (ISO strings comparáveis)
        const dataInicioFull = inicio + "T00:00:00.000Z";
        const dataFimFull = fim + "T23:59:59.999Z";

        let encontrouRegistros = false;

        querySnapshot.forEach((doc) => {
            const h = doc.data();
            
            // Filtro manual para garantir precisão no período
            if (h.dataHora >= dataInicioFull && h.dataHora <= dataFimFull) {
                encontrouRegistros = true;
                const dataFormatada = new Date(h.dataHora).toLocaleString('pt-BR');
                
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="font-size: 0.8rem; color: #666;">${dataFormatada}</td>
                    <td><strong>${h.usuario || 'Usuário Desconhecido'}</strong></td>
                    <td><span class="badge-acao">${h.acao}</span></td>
                    <td>${h.senhaAgendamento || '-'}</td>
                `;
                corpo.appendChild(tr);
            }
        });

        if (!encontrouRegistros) {
            corpo.innerHTML = `<tr><td colspan="4" style="text-align:center;">Nenhuma atividade encontrada neste período.</td></tr>`;
        }

    } catch (e) {
        console.error("Erro ao carregar histórico:", e);
        corpo.innerHTML = `<tr><td colspan="4" style="text-align:center; color:red;">Erro ao carregar dados. Verifique os índices do Firestore.</td></tr>`;
    }
}

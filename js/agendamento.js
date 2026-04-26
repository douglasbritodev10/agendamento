import { app } from './firebase-config.js';
import { 
    getFirestore, doc, setDoc, collection, addDoc 
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', () => {
    const nivel = localStorage.getItem('nivelAcesso');
    const nome = localStorage.getItem('usuarioNome');

    // 1. Mostra o nome do usuário na Navbar
    const navNome = document.getElementById('navUserName');
    if(navNome) navNome.innerText = nome || "Usuário";

    // 2. Verifica se o nível é ADM ou AGENDAMENTO
    if (nivel === 'ADM' || nivel === 'AGENDAMENTO') {
        document.getElementById('areaAgendamento').style.display = 'block';
    } else {
        document.getElementById('erroAcesso').style.display = 'block';
    }

    // 3. Setup inicial
    gerarSenhaAgendamento();
    if(document.getElementById('listaItens').innerHTML === "") {
        window.addLinhaItem(); // Adiciona a primeira linha de produto automaticamente
    }
    document.getElementById('dataCarga').value = new Date().toISOString().split('T')[0];
});

function gerarSenhaAgendamento() {
    const random = Math.floor(1000 + Math.random() * 9000);
    const data = new Date();
    const ref = `SIM-${data.getFullYear()}${String(data.getMonth() + 1).padStart(2, '0')}-${random}`;
    document.getElementById('senhaAgendamento').value = ref;
}

document.getElementById('btnFinalizar').addEventListener('click', async () => {
    const btn = document.getElementById('btnFinalizar');
    const senha = document.getElementById('senhaAgendamento').value;
    const link = document.getElementById('linkSenha').value.trim();

    const dadosCarga = {
        senhaAgendamento: senha,
        linkSenha: link,
        contaVeiculo: link === "" ? 1 : 0, 
        data: document.getElementById('dataCarga').value,
        central: document.getElementById('central').value,
        fornecedor: document.getElementById('fornecedor').value,
        cargaTransporte: document.getElementById('transporte').value,
        ordemCompra: document.getElementById('ordemCompra').value,
        volumes: document.getElementById('volumes').value,
        status: "Agendada",
        criadoPor: localStorage.getItem('usuarioEmail'),
        dataRegistro: new Date().toISOString()
    };

    if (!dadosCarga.fornecedor || !dadosCarga.cargaTransporte) {
        alert("Preencha Fornecedor e Placa!");
        return;
    }

    btn.disabled = true;
    btn.innerText = "SALVANDO...";

    try {
        await setDoc(doc(db, "agendamentos", senha), dadosCarga);

        const linhas = document.querySelectorAll('.item-row');
        for (const linha of linhas) {
            const cod = linha.querySelector('.prod-id').value;
            const desc = linha.querySelector('.prod-desc').value;
            const qtd = linha.querySelector('.prod-qtd').value;

            if (cod && desc) {
                await addDoc(collection(db, "itens_agenda"), {
                    senhaAgendamento: senha,
                    codigo: cod,
                    descricao: desc,
                    quantidade: qtd
                });
            }
        }

        await addDoc(collection(db, "historico"), {
            usuario: localStorage.getItem('usuarioEmail'),
            acao: link !== "" ? `Carga vinculada à senha ${link}` : "Novo agendamento criado",
            senhaAgendamento: senha,
            dataHora: new Date().toISOString()
        });

        alert("Sucesso! Carga " + senha + " registrada.");

        // AGENDAMENTO MÚLTIPLO: Limpa apenas o necessário
        document.getElementById('ordemCompra').value = "";
        document.getElementById('volumes').value = "";
        document.getElementById('listaItens').innerHTML = "";
        window.addLinhaItem();
        gerarSenhaAgendamento(); 
        
        btn.disabled = false;
        btn.innerText = "FINALIZAR E SALVAR AGENDAMENTO";

    } catch (e) {
        console.error(e);
        alert("Erro ao salvar.");
        btn.disabled = false;
    }
});

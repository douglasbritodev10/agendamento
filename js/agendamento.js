import { app } from './firebase-config.js';
import { 
    getFirestore, 
    doc, 
    setDoc, 
    collection, 
    addDoc 
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const db = getFirestore(app);

// 1. GERAÇÃO DE SENHA ÚNICA (Executa ao carregar)
const gerarSenha = () => {
    const random = Math.floor(1000 + Math.random() * 9000);
    const data = new Date();
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    return `SIM-${ano}${mes}-${random}`;
};

const inputSenha = document.getElementById('senhaAgendamento');
if (inputSenha) inputSenha.value = gerarSenha();

// 2. FUNÇÃO SALVAR TUDO
document.getElementById('btnFinalizar').addEventListener('click', async () => {
    const btn = document.getElementById('btnFinalizar');
    const senha = inputSenha.value;

    // Coleta dados da Carga
    const dadosCarga = {
        senhaAgendamento: senha,
        data: document.getElementById('dataCarga').value,
        central: document.getElementById('central').value,
        fornecedor: document.getElementById('fornecedor').value,
        cargaTransporte: document.getElementById('transporte').value,
        ordemCompra: document.getElementById('ordemCompra').value,
        volumes: document.getElementById('volumes').value,
        tipoProduto: document.getElementById('tipoProduto').value,
        status: "Agendada",
        fixado: false,
        dataCriacao: new Date().toISOString(),
        criadoPor: localStorage.getItem('user_email') || "Sistema"
    };

    // Validação Simples
    if (!dadosCarga.data || !dadosCarga.fornecedor) {
        alert("Por favor, preencha a Data e o Fornecedor.");
        return;
    }

    btn.disabled = true;
    btn.innerText = "PROCESSANDO...";

    try {
        // A. Salva a Carga Principal (Usa a Senha como ID do documento)
        await setDoc(doc(db, "agendamentos", senha), dadosCarga);

        // B. Coleta e Salva os Itens
        const linhas = document.querySelectorAll('.item-row');
        for (const linha of linhas) {
            const cod = linha.querySelector('.prod-id').value;
            const desc = linha.querySelector('.prod-desc').value;
            const qtd = linha.querySelector('.prod-qtd').value;

            if (cod && desc) {
                await addDoc(collection(db, "itens_agenda"), {
                    senhaAgendamento: senha,
                    codigoProduto: cod,
                    descricao: desc,
                    quantidade: qtd
                });
            }
        }

        // C. Registra no Histórico
        await addDoc(collection(db, "historico"), {
            usuario: localStorage.getItem('user_email'),
            acao: "Criou novo agendamento",
            senhaAgendamento: senha,
            dataHora: new Date().toISOString()
        });

        alert("SUCESSO! Agendamento " + senha + " registrado.");
        window.location.href = "inicial.html";

    } catch (error) {
        console.error("Erro ao salvar:", error);
        alert("Erro ao salvar no banco de dados.");
        btn.disabled = false;
        btn.innerText = "FINALIZAR E SALVAR AGENDAMENTO";
    }
});

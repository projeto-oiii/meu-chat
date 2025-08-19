// Importando Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";
import { getFirestore, collection, addDoc, query, where, getDocs, onSnapshot, orderBy } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";

// 🔹 Configuração do seu Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDFvYgca0_HRX0m_RSER0RgQ3LZDa6kaJ8",
  authDomain: "meu-chat-71046.firebaseapp.com",
  projectId: "meu-chat-71046",
  storageBucket: "meu-chat-71046.firebasestorage.app",
  messagingSenderId: "268291748548",
  appId: "1:268291748548:web:4001f2e4002d7f0eeb8f91"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 🔹 Cadastro
window.cadastrar = async function () {
  const nome = document.getElementById("nome").value;
  const usuario = document.getElementById("usuario").value;
  const telefone = document.getElementById("telefone").value;
  const senha = document.getElementById("senha").value;

  if (!nome || !usuario || !telefone || !senha) {
    alert("Preencha todos os campos!");
    return;
  }

  try {
    await addDoc(collection(db, "users"), {
      nome,
      usuario,
      telefone,
      senha
    });
    alert("Cadastro realizado com sucesso!");
    window.location.href = "index.html";
  } catch (e) {
    alert("Erro ao cadastrar: " + e.message);
  }
};

// 🔹 Login (usuário OU telefone + senha)
window.login = async function () {
  const loginField = document.getElementById("loginField").value;
  const senha = document.getElementById("loginPassword").value;

  if (!loginField || !senha) {
    alert("Preencha todos os campos!");
    return;
  }

  try {
    // Buscar pelo usuário OU telefone
    const qUsuario = query(collection(db, "users"), where("usuario", "==", loginField), where("senha", "==", senha));
    const qTelefone = query(collection(db, "users"), where("telefone", "==", loginField), where("senha", "==", senha));

    const usuarioSnap = await getDocs(qUsuario);
    const telefoneSnap = await getDocs(qTelefone);

    if (!usuarioSnap.empty || !telefoneSnap.empty) {
      localStorage.setItem("usuarioLogado", loginField);
      window.location.href = "chat.html";
    } else {
      alert("Usuário não encontrado.");
    }
  } catch (e) {
    alert("Erro ao logar: " + e.message);
  }
};

// 🔹 Enviar mensagem
window.enviarMensagem = async function () {
  const msgInput = document.getElementById("mensagemInput");
  const usuario = localStorage.getItem("usuarioLogado");

  if (!msgInput.value) return;

  try {
    await addDoc(collection(db, "mensagens"), {
      usuario,
      texto: msgInput.value,
      timestamp: new Date()
    });
    msgInput.value = "";
  } catch (e) {
    alert("Erro ao enviar: " + e.message);
  }
};

// 🔹 Listar mensagens em tempo real com estilo WhatsApp
if (window.location.pathname.endsWith("chat.html")) {
  const mensagensDiv = document.getElementById("mensagens");
  const q = query(collection(db, "mensagens"), orderBy("timestamp"));

  onSnapshot(q, (snapshot) => {
    mensagensDiv.innerHTML = "";
    const usuarioLogado = localStorage.getItem("usuarioLogado");

    snapshot.forEach((doc) => {
      const msg = doc.data();
      const classe = msg.usuario === usuarioLogado ? "mensagem eu" : "mensagem outro";
      mensagensDiv.innerHTML += `<div class="${classe}"><b>${msg.usuario}:</b> ${msg.texto}</div>`;
    });

    mensagensDiv.scrollTop = mensagensDiv.scrollHeight;
  });
}

// 🔹 Logout
window.logout = function () {
  localStorage.removeItem("usuarioLogado");
  window.location.href = "index.html";
};

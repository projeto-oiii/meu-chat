// ===== Importações Firebase =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore, collection, addDoc, query, where,
  getDocs, onSnapshot, doc, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// ===== Configuração Firebase =====
const firebaseConfig = {
  apiKey: "AIzaSyDFvYgca0_HRX0m_RSER0RgQ3LZDa6kaJ8",
  authDomain: "meu-chat-71046.firebaseapp.com",
  projectId: "meu-chat-71046",
  storageBucket: "meu-chat-71046.firebasestorage.app",
  messagingSenderId: "268291748548",
  appId: "1:268291748548:web:4001f2e4002d7f0eeb8f91"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ===== Variáveis Globais =====
let usuario = JSON.parse(localStorage.getItem("usuario")) || null;
let chatAtivo = null;

// ===== Cadastro =====
const cadastroForm = document.getElementById("cadastroForm");
if (cadastroForm) {
  cadastroForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nome = document.getElementById("nomeCadastro").value;
    const usuarioCadastro = document.getElementById("usuarioCadastro").value;
    const telefone = document.getElementById("telefoneCadastro").value;
    const senha = document.getElementById("senhaCadastro").value;

    try {
      await setDoc(doc(db, "users", usuarioCadastro), {
        nome,
        usuario: usuarioCadastro,
        telefone,
        senha
      });
      alert("Cadastro realizado! Faça login.");
      window.location.href = "index.html";
    } catch (err) {
      alert("Erro ao cadastrar: " + err.message);
    }
  });
}

// ===== Login =====
const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const loginInput = document.getElementById("loginInput").value;
    const senhaLogin = document.getElementById("senhaLogin").value;

    const q = query(collection(db, "users"),
      where("usuario", "==", loginInput));
    const q2 = query(collection(db, "users"),
      where("telefone", "==", loginInput));

    let resultado = await getDocs(q);
    if (resultado.empty) {
      resultado = await getDocs(q2);
    }

    if (!resultado.empty) {
      const userData = resultado.docs[0].data();
      if (userData.senha === senhaLogin) {
        usuario = userData;
        localStorage.setItem("usuario", JSON.stringify(userData));
        window.location.href = "chat.html";
      } else {
        alert("Senha incorreta.");
      }
    } else {
      alert("Usuário não encontrado.");
    }
  });
}

// ===== Chat =====
const userNome = document.getElementById("userNome");
if (userNome && usuario) {
  userNome.innerText = usuario.usuario;
}

// Botão sair
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("usuario");
    window.location.href = "index.html";
  });
}

// Adicionar amigo/chat
const addChatBtn = document.getElementById("addChatBtn");
if (addChatBtn) {
  addChatBtn.addEventListener("click", async () => {
    const amigo = document.getElementById("novoChatInput").value.trim();
    if (!amigo) return;

    const chatId = [usuario.usuario, amigo].sort().join("_");
    await setDoc(doc(db, "chats", chatId), {
      membros: [usuario.usuario, amigo]
    });

    document.getElementById("novoChatInput").value = "";
  });
}

// Listar chats
const chatList = document.getElementById("chatList");
if (chatList && usuario) {
  const q = query(collection(db, "chats"));
  onSnapshot(q, (snapshot) => {
    chatList.innerHTML = "";
    snapshot.docs.forEach((docSnap) => {
      const dados = docSnap.data();
      if (dados.membros.includes(usuario.usuario)) {
        const li = document.createElement("li");
        li.innerText = dados.membros.filter(m => m !== usuario.usuario)[0] || "Chat Geral";
        li.addEventListener("click", () => {
          chatAtivo = docSnap.id;
          document.getElementById("chatAtivoNome").innerText = li.innerText;
          carregarMensagens();
        });
        chatList.appendChild(li);
      }
    });
  });
}

// Carregar mensagens
function carregarMensagens() {
  if (!chatAtivo) return;
  const messagesContainer = document.getElementById("messagesContainer");
  const q = query(collection(db, "chats", chatAtivo, "mensagens"));
  onSnapshot(q, (snapshot) => {
    messagesContainer.innerHTML = "";
    snapshot.docs.forEach((docSnap) => {
      const msg = docSnap.data();
      const div = document.createElement("div");
      if (msg.usuario === usuario.usuario) {
        div.classList.add("bg-me");
      } else {
        div.classList.add("bg-other");
      }
      div.innerText = `${msg.usuario}: ${msg.texto}`;
      messagesContainer.appendChild(div);
    });
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  });
}

// Enviar mensagem
const chatForm = document.getElementById("chatForm");
if (chatForm) {
  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!chatAtivo) {
      alert("Selecione um chat primeiro!");
      return;
    }
    const texto = document.getElementById("mensagemInput").value.trim();
    if (!texto) return;

    await addDoc(collection(db, "chats", chatAtivo, "mensagens"), {
      usuario: usuario.usuario,
      texto,
      timestamp: new Date()
    });
    chatForm.reset();
  });
}

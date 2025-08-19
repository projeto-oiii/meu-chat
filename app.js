// Importando Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, addDoc, collection, query, where, getDocs, onSnapshot, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Config Firebase
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

// Sessão
function salvarSessao(user) { localStorage.setItem("usuarioAtivo", JSON.stringify(user)); }
function pegarSessao() { return JSON.parse(localStorage.getItem("usuarioAtivo")); }
function limparSessao() { localStorage.removeItem("usuarioAtivo"); }

// ===== Cadastro =====
const cadastroForm = document.getElementById("cadastroForm");
if (cadastroForm) {
  cadastroForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nome = document.getElementById("nome").value;
    const usuario = document.getElementById("usuario").value;
    const telefone = document.getElementById("telefone").value;
    const senha = document.getElementById("senha").value;

    await setDoc(doc(db, "users", usuario), { nome, usuario, telefone, senha });
    alert("Cadastro realizado!");
    window.location.href = "index.html";
  });
}

// ===== Login =====
const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const loginUser = document.getElementById("loginUser").value;
    const senha = document.getElementById("loginSenha").value;

    let q = query(collection(db, "users"), where("usuario", "==", loginUser));
    let snap = await getDocs(q);

    if (snap.empty) {
      q = query(collection(db, "users"), where("telefone", "==", loginUser));
      snap = await getDocs(q);
    }

    if (snap.empty) { alert("Usuário não encontrado"); return; }

    const user = snap.docs[0].data();
    if (user.senha !== senha) { alert("Senha incorreta"); return; }

    salvarSessao(user);
    window.location.href = "chat.html";
  });
}

// ===== Chat =====
const chatList = document.getElementById("chatList");
const chatForm = document.getElementById("chatForm");
const messagesContainer = document.getElementById("messagesContainer");
const searchBtn = document.getElementById("searchBtn");
const logoutBtn = document.getElementById("logoutBtn");

let chatAtivo = null;
let usuario = pegarSessao();

if (chatList && usuario) {
  document.getElementById("meUser").innerText = usuario.usuario;

  // Mostrar lista de chats
  const q = query(collection(db, "chats"));
  onSnapshot(q, (snapshot) => {
    chatList.innerHTML = "";
    snapshot.forEach(docSnap => {
      const chat = docSnap.data();
      if (chat.participantes.includes(usuario.usuario)) {
        const div = document.createElement("div");
        div.classList.add("p-3", "border-b", "cursor-pointer", "hover:bg-gray-100");
        div.innerText = chat.participantes.filter(u => u !== usuario.usuario).join(", ") || "Chat Geral";
        div.onclick = () => abrirChat(docSnap.id, chat);
        chatList.appendChild(div);
      }
    });
  });

  // Buscar e criar chat
  searchBtn.addEventListener("click", async () => {
    const search = document.getElementById("searchInput").value;
    if (!search) return;

    const q1 = query(collection(db, "users"), where("usuario", "==", search));
    const q2 = query(collection(db, "users"), where("telefone", "==", search));

    let snap = await getDocs(q1);
    if (snap.empty) snap = await getDocs(q2);

    if (snap.empty) { alert("Usuário não encontrado"); return; }

    const amigo = snap.docs[0].data();

    // Verificar se já existe chat
    const qChat = query(collection(db, "chats"));
    const snapChats = await getDocs(qChat);
    let chatExistente = null;

    snapChats.forEach(docSnap => {
      const chat = docSnap.data();
      if (chat.participantes.includes(usuario.usuario) && chat.participantes.includes(amigo.usuario)) {
        chatExistente = docSnap;
      }
    });

    if (chatExistente) {
      abrirChat(chatExistente.id, chatExistente.data());
    } else {
      const novoChat = await addDoc(collection(db, "chats"), {
        participantes: [usuario.usuario, amigo.usuario]
      });
      abrirChat(novoChat.id, { participantes: [usuario.usuario, amigo.usuario] });
    }
  });

  // Enviar mensagem
  if (chatForm) {
    chatForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!chatAtivo) return;
      const texto = document.getElementById("mensagemInput").value;
      await addDoc(collection(db, "chats", chatAtivo, "mensagens"), {
        usuario: usuario.usuario,
        texto,
        timestamp: new Date()
      });
      chatForm.reset();
    });
  }

  // Logout
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      limparSessao();
      window.location.href = "index.html";
    });
  }
}

// ===== Abrir Chat =====
function abrirChat(chatId, chat) {
  chatAtivo = chatId;
  document.getElementById("chatTitle").innerText =
    chat.participantes.filter(u => u !== usuario.usuario).join(", ") || "Chat Geral";

  const q = query(collection(db, "chats", chatId, "mensagens"), orderBy("timestamp", "asc"));
  onSnapshot(q, (snapshot) => {
    messagesContainer.innerHTML = "";
    snapshot.forEach(msgSnap => {
      const msg = msgSnap.data();
      const div = document.createElement("div");
      div.classList.add("p-2", "my-1", "rounded", "max-w-xs");
      div.classList.add(msg.usuario === usuario.usuario ? "bg-green-200 ml-auto" : "bg-white");
      div.innerText = `${msg.usuario}: ${msg.texto}`;
      messagesContainer.appendChild(div);
    });
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  });
}

// ===== Firebase Config =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";
import {
  getFirestore, doc, setDoc, getDoc, addDoc,
  collection, query, where, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";

// === SUA CONFIG REAL DO FIREBASE ===
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

// ===== Variáveis globais =====
let usuarioLogado = localStorage.getItem("usuario");
let chatAtivo = null;
let unsubscribeMensagens = null;

// ===== Cadastro =====
const cadastroForm = document.getElementById("cadastroForm");
if (cadastroForm) {
  cadastroForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const usuario = document.getElementById("cadastroUsuario").value.trim();
    const senha = document.getElementById("cadastroSenha").value;

    const userRef = doc(db, "users", usuario);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      alert("Usuário já existe!");
      return;
    }
    await setDoc(userRef, { senha, criadoEm: serverTimestamp() });
    alert("Cadastro realizado!");
    window.location.href = "index.html";
  });
}

// ===== Login =====
const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const usuario = document.getElementById("loginUsuario").value.trim();
    const senha = document.getElementById("loginSenha").value;

    const userRef = doc(db, "users", usuario);
    const snap = await getDoc(userRef);

    if (!snap.exists() || snap.data().senha !== senha) {
      alert("Usuário ou senha incorretos!");
      return;
    }
    localStorage.setItem("usuario", usuario);
    window.location.href = "chat.html";
  });
}

// ===== Chat =====
const usuarioLogadoDiv = document.getElementById("usuarioLogado");
if (usuarioLogadoDiv && usuarioLogado) {
  usuarioLogadoDiv.textContent = `${usuarioLogado} (logado)`;
}

const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("usuario");
    window.location.href = "index.html";
  });
}

// ===== Adicionar contato =====
const addContatoBtn = document.getElementById("addContatoBtn");
if (addContatoBtn) {
  addContatoBtn.addEventListener("click", async () => {
    const contato = document.getElementById("novoContato").value.trim();
    if (!contato) return;

    const contatoRef = doc(db, "users", contato);
    const snap = await getDoc(contatoRef);
    if (!snap.exists()) {
      alert("Usuário não encontrado!");
      return;
    }

    const chatId = [usuarioLogado, contato].sort().join("_");
    const chatRef = doc(db, "chats", chatId);
    const chatSnap = await getDoc(chatRef);

    if (!chatSnap.exists()) {
      await setDoc(chatRef, {
        membros: [usuarioLogado, contato],
        criadoEm: serverTimestamp()
      });
    }

    document.getElementById("novoContato").value = "";
  });
}

// ===== Listar contatos =====
const listaContatos = document.getElementById("listaContatos");
if (listaContatos && usuarioLogado) {
  const q = query(collection(db, "chats"), where("membros", "array-contains", usuarioLogado));
  onSnapshot(q, (snap) => {
    listaContatos.innerHTML = "";
    snap.forEach((docSnap) => {
      const chat = docSnap.data();
      const outro = chat.membros.find((m) => m !== usuarioLogado);

      const li = document.createElement("li");
      li.textContent = outro;
      li.onclick = () => abrirChat(docSnap.id, outro);
      listaContatos.appendChild(li);
    });
  });
}

// ===== Abrir chat =====
async function abrirChat(chatId, contato) {
  chatAtivo = chatId;
  document.getElementById("chatCom").textContent = contato;
  const mensagensDiv = document.getElementById("mensagens");
  mensagensDiv.innerHTML = "";

  if (unsubscribeMensagens) unsubscribeMensagens();

  const msgsRef = collection(db, "chats", chatId, "mensagens");
  unsubscribeMensagens = onSnapshot(msgsRef, (snap) => {
    mensagensDiv.innerHTML = "";
    snap.forEach((msgDoc) => {
      const msg = msgDoc.data();
      const div = document.createElement("div");
      div.classList.add("message");
      div.classList.add(msg.de === usuarioLogado ? "me" : "other");

      div.innerHTML = `
        <div>${msg.texto}</div>
        <div class="timestamp">
          ${msg.enviadoEm?.toDate().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}
        </div>
      `;
      mensagensDiv.appendChild(div);
    });
    mensagensDiv.scrollTop = mensagensDiv.scrollHeight;
  });
}

// ===== Enviar mensagem =====
const formMensagem = document.getElementById("formMensagem");
if (formMensagem) {
  formMensagem.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!chatAtivo) return;

    const texto = document.getElementById("mensagemInput").value.trim();
    if (!texto) return;

    await addDoc(collection(db, "chats", chatAtivo, "mensagens"), {
      de: usuarioLogado,
      texto,
      enviadoEm: serverTimestamp()
    });

    document.getElementById("mensagemInput").value = "";
  });
}

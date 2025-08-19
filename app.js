// === Firebase Modular ===
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import {
  getFirestore, collection, doc, setDoc, getDoc, getDocs, addDoc,
  query, where, orderBy, onSnapshot, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_PROJECT.firebaseapp.com",
  projectId: "SEU_PROJECT_ID",
  storageBucket: "SEU_PROJECT.appspot.com",
  messagingSenderId: "SENDER_ID",
  appId: "APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let usuarioLogado = localStorage.getItem("usuarioLogado");
let chatAtual = null;

// === Login ===
const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const usuario = document.getElementById("loginUsuario").value.trim();
    const senha = document.getElementById("loginSenha").value;

    const userRef = doc(db, "users", usuario);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists() && userSnap.data().senha === senha) {
      localStorage.setItem("usuarioLogado", usuario);
      window.location.href = "chat.html";
    } else {
      alert("Usuário ou senha inválidos!");
    }
  });
}

// === Cadastro ===
const cadastroForm = document.getElementById("cadastroForm");
if (cadastroForm) {
  cadastroForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const usuario = document.getElementById("cadastroUsuario").value.trim();
    const senha = document.getElementById("cadastroSenha").value;

    const userRef = doc(db, "users", usuario);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      alert("Usuário já existe!");
    } else {
      await setDoc(userRef, {
        usuario,
        senha,
        criadoEm: serverTimestamp()
      });
      alert("Cadastro realizado!");
      window.location.href = "index.html";
    }
  });
}

// === Chat ===
const sairBtn = document.getElementById("sairBtn");
if (sairBtn) {
  document.getElementById("usuarioLogado").innerText = usuarioLogado;
  sairBtn.addEventListener("click", () => {
    localStorage.removeItem("usuarioLogado");
    window.location.href = "index.html";
  });
}

const listaContatos = document.getElementById("listaContatos");
const nomeContato = document.getElementById("nomeContato");
const messagesBox = document.getElementById("messages");
const notifySound = document.getElementById("notifySound");

// === Som de notificação ===
function playSound() {
  if (notifySound) notifySound.play().catch(() => {});
}

// === Renderizar mensagens ===
function renderMessage(msg) {
  const div = document.createElement("div");
  div.classList.add("message");
  div.classList.add(msg.de === usuarioLogado ? "bg-me" : "bg-other");

  const body = document.createElement("div");
  body.classList.add("body");
  body.innerText = msg.texto;

  const meta = document.createElement("div");
  meta.classList.add("meta");

  let timeStr = "";
  if (msg.timestamp?.toDate) {
    const time = msg.timestamp.toDate();
    timeStr = time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  let status = "";
  if (msg.de === usuarioLogado) {
    if (msg.status === "enviado") status = "✔";
    if (msg.status === "recebido") status = "✔✔";
    if (msg.status === "lido") status = `<span style="color:#4fc3f7">✔✔</span>`;
  }

  meta.innerHTML = `${timeStr} ${status}`;
  div.appendChild(body);
  div.appendChild(meta);

  messagesBox.appendChild(div);
  messagesBox.scrollTop = messagesBox.scrollHeight;
}

// === Abrir Chat ===
async function abrirChat(idChat, contato) {
  chatAtual = idChat;
  nomeContato.innerText = contato;
  messagesBox.innerHTML = "";

  const msgsRef = collection(db, "chats", idChat, "mensagens");
  const q = query(msgsRef, orderBy("timestamp"));

  onSnapshot(q, async (snapshot) => {
    messagesBox.innerHTML = "";
    snapshot.forEach(async (docSnap) => {
      const msg = docSnap.data();
      renderMessage(msg);

      // marcar como recebido
      if (msg.de !== usuarioLogado && msg.status === "enviado") {
        await updateDoc(docSnap.ref, { status: "recebido" });
        playSound();
      }
    });

    // marcar como lido todas
    snapshot.forEach(async (docSnap) => {
      const msg = docSnap.data();
      if (msg.de !== usuarioLogado && msg.status !== "lido") {
        await updateDoc(docSnap.ref, { status: "lido" });
      }
    });
  });
}

// === Listar Contatos ===
if (listaContatos) {
  const q = query(collection(db, "chats"), where("membros", "array-contains", usuarioLogado));
  onSnapshot(q, (snapshot) => {
    listaContatos.innerHTML = "";
    snapshot.forEach(docSnap => {
      const dados = docSnap.data();
      const contato = dados.membros.find(m => m !== usuarioLogado);
      const li = document.createElement("li");
      li.innerText = contato;
      li.addEventListener("click", () => abrirChat(docSnap.id, contato));
      listaContatos.appendChild(li);
    });
  });
}

// === Enviar Mensagem ===
const enviarBtn = document.getElementById("enviarBtn");
if (enviarBtn) {
  enviarBtn.addEventListener("click", async () => {
    const input = document.getElementById("mensagemInput");
    const texto = input.value.trim();
    if (!texto || !chatAtual) return;

    await addDoc(collection(db, "chats", chatAtual, "mensagens"), {
      de: usuarioLogado,
      texto,
      timestamp: serverTimestamp(),
      status: "enviado"
    });

    input.value = "";
  });
}

// ===== Firebase Config =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";
import {
  getFirestore, doc, setDoc, getDoc, addDoc,
  collection, query, where, onSnapshot, serverTimestamp, updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_DOMINIO.firebaseapp.com",
  projectId: "SEU_PROJETO",
  storageBucket: "SEU_BUCKET.appspot.com",
  messagingSenderId: "XXXXXXXX",
  appId: "XXXXXXXX"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ===== Variáveis globais =====
let usuarioLogado = localStorage.getItem("usuario");
let chatAtivo = null;
let unsubscribeMensagens = null;

// ===== Util =====
function redirecionar(pagina) {
  window.location.href = pagina;
}

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
    redirecionar("index.html");
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
    redirecionar("chat.html");
  });
}

// ===== Chat =====
const usuarioLogadoDiv = document.getElementById("usuarioLogado");
if (usuarioLogadoDiv && usuarioLogado) {
  usuarioLogadoDiv.textContent = `${usuarioLogado} (logado)`;
}

// Sair
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("usuario");
    redirecionar("index.html");
  });
}

// Adicionar contato
const addContatoBtn = document.getElementById("addContatoBtn");
if (addContatoBtn) {
  addContatoBtn.addEventListener("click", async () => {
    const contato = document.getElementById("novoContato").value.trim();
    if (!contato) return;

    // Verifica se usuário existe
    const contatoRef = doc(db, "users", contato);
    const snap = await getDoc(contatoRef);
    if (!snap.exists()) {
      alert("Usuário não encontrado!");
      return;
    }

    // Cria chat único
    const chatId = [usuarioLogado, contato].sort().join("_");
    const chatRef = doc(db, "chats", chatId);
    const chatSnap = await getDoc(chatRef);

    if (!chatSnap.exists()) {
      await setDoc(chatRef, {
        membros: [usuarioLogado, contato],
        criadoEm: serverTimestamp(),
        lastRead: { [usuarioLogado]: null, [contato]: null }
      });
    }
    document.getElementById("novoContato").value = "";
  });
}

// Lista de contatos
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

// Abrir chat
async function abrirChat(chatId, contato) {
  chatAtivo = chatId;
  document.getElementById("chatCom").textContent = contato;
  const mensagensDiv = document.getElementById("mensagens");
  mensagensDiv.innerHTML = "";

  // Se já tinha listener, remove
  if (unsubscribeMensagens) unsubscribeMensagens();

  const msgsRef = collection(db, "chats", chatId, "mensagens");
  const q = query(msgsRef);

  unsubscribeMensagens = onSnapshot(q, (snap) => {
    mensagensDiv.innerHTML = "";
    snap.forEach((msgDoc) => {
      const msg = msgDoc.data();
      exibirMensagem(msgDoc.id, msg);
    });
    mensagensDiv.scrollTop = mensagensDiv.scrollHeight;
  });
}

// Exibir mensagem
function exibirMensagem(id, msg) {
  const mensagensDiv = document.getElementById("mensagens");
  const div = document.createElement("div");
  div.classList.add("message");
  div.classList.add(msg.de === usuarioLogado ? "me" : "other");

  div.innerHTML = `
    <div>${msg.texto}</div>
    <div class="timestamp">
      ${msg.enviadoEm?.toDate().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}
      ${msg.de === usuarioLogado ? renderStatus(msg) : ""}
    </div>
  `;
  mensagensDiv.appendChild(div);

  // Tocar som se for recebida
  if (msg.de !== usuarioLogado) {
    document.getElementById("notifySound").play();
  }
}

// Renderiza status
function renderStatus(msg) {
  if (msg.lidoPor?.length > 1) return "✓✓ azul";
  if (msg.recebidoPor?.length > 1) return "✓✓";
  return "✓";
}

// Enviar mensagem
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
      enviadoEm: serverTimestamp(),
      recebidoPor: [usuarioLogado],
      lidoPor: []
    });

    document.getElementById("mensagemInput").value = "";
  });
}

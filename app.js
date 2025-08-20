// ================= Firebase (v10) =================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";
import {
  getFirestore, doc, setDoc, getDoc, addDoc, updateDoc,
  collection, query, where, onSnapshot, serverTimestamp, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";

// <<< CONFIG REAL QUE VOCÊ ME PASSOU >>>
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

// ================= Variáveis globais =================
let usuarioLogado = localStorage.getItem("usuario") || null;
let chatAtivo = null;
let unsubscribeMensagens = null;   // para remover listener quando troca de chat
let unsubscribeChats = null;       // listener da lista de chats (sidebar)

// ================= Helpers =================
function go(pagina) { window.location.href = pagina; }
function agoraHHMM(date) {
  try {
    return date?.toDate
      ? date.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch(_) {
    return "";
  }
}

// ================= Cadastro =================
const cadastroForm = document.getElementById("cadastroForm");
if (cadastroForm) {
  cadastroForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const usuario = document.getElementById("cadastroUsuario").value.trim();
    const senha = document.getElementById("cadastroSenha").value;

    if (!usuario || !senha) { alert("Preencha usuário e senha."); return; }

    try {
      const userRef = doc(db, "users", usuario);
      const exists = await getDoc(userRef);
      if (exists.exists()) {
        alert("Usuário já existe.");
        return;
      }
      await setDoc(userRef, { senha, criadoEm: serverTimestamp() });
      alert("Cadastro realizado!");
      go("index.html");
    } catch (err) {
      console.error("Cadastro erro:", err);
      alert("Erro ao cadastrar.");
    }
  });
}

// ================= Login =================
const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const usuario = document.getElementById("loginUsuario").value.trim();
    const senha = document.getElementById("loginSenha").value;

    if (!usuario || !senha) { alert("Preencha usuário e senha."); return; }

    try {
      const userRef = doc(db, "users", usuario);
      const snap = await getDoc(userRef);
      if (!snap.exists()) { alert("Usuário não encontrado."); return; }
      if (snap.data().senha !== senha) { alert("Senha incorreta."); return; }

      localStorage.setItem("usuario", usuario);
      usuarioLogado = usuario;
      go("chat.html");
    } catch (err) {
      console.error("Login erro:", err);
      alert("Erro ao entrar.");
    }
  });
}

// ================= Chat (somente quando estiver em chat.html) =================
const usuarioLogadoSpan = document.getElementById("usuarioLogado");
const logoutBtn = document.getElementById("logoutBtn");
const listaContatos = document.getElementById("listaContatos");
const novoContatoInput = document.getElementById("novoContato");
const addContatoBtn = document.getElementById("addContatoBtn");
const mensagensDiv = document.getElementById("mensagens");
const chatCom = document.getElementById("chatCom");
const formMensagem = document.getElementById("formMensagem");
const mensagemInput = document.getElementById("mensagemInput");

// Se a página é chat.html, exija login
if (usuarioLogadoSpan || listaContatos || formMensagem) {
  if (!usuarioLogado) {
    go("index.html");
  } else {
    usuarioLogadoSpan.textContent = usuarioLogado;
    iniciarListaDeChats();
  }
}

// Sair
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("usuario");
    usuarioLogado = null;
    go("index.html");
  });
}

// Adicionar contato (cria/assegura chat entre usuário e contato)
if (addContatoBtn) {
  addContatoBtn.addEventListener("click", async () => {
    const contato = (novoContatoInput.value || "").trim();
    if (!contato) return;
    if (contato === usuarioLogado) { alert("Não é possível criar chat com você mesmo."); return; }

    try {
      // Verifica se contato existe
      const contatoRef = doc(db, "users", contato);
      const contatoSnap = await getDoc(contatoRef);
      if (!contatoSnap.exists()) {
        alert("Contato não encontrado.");
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

      novoContatoInput.value = "";
      // não abre automaticamente; só abrirá quando o usuário clicar na lista (como você pediu)
    } catch (err) {
      console.error("Erro ao adicionar contato:", err);
      alert("Erro ao adicionar contato.");
    }
  });
}

// Listagem de chats (sidebar) sem duplicações
function iniciarListaDeChats() {
  if (!listaContatos) return;

  // Garante um único listener da sidebar
  if (unsubscribeChats) unsubscribeChats();

  const q = query(collection(db, "chats"), where("membros", "array-contains", usuarioLogado));
  unsubscribeChats = onSnapshot(q, (snap) => {
    // Zera a lista a cada atualização para não duplicar
    listaContatos.innerHTML = "";

    snap.forEach((docSnap) => {
      const chatData = docSnap.data();
      const outro = (chatData.membros || []).find(m => m !== usuarioLogado);
      if (!outro) return;

      const li = document.createElement("li");
      li.textContent = outro;

      // Ao clicar: evita reabrir o mesmo chat (o que poderia reconfigurar listeners à toa)
      li.addEventListener("click", () => {
        if (chatAtivo === docSnap.id) return;          // 🍀 evita reiniciar o mesmo chat ao clicar de novo
        abrirChat(docSnap.id, outro);
      });

      listaContatos.appendChild(li);
    });
  });
}

// Abrir um chat específico
async function abrirChat(chatId, contatoNome) {
  chatAtivo = chatId;
  if (chatCom) chatCom.textContent = contatoNome;
  if (!mensagensDiv) return;

  // Limpa mensagens da tela
  mensagensDiv.innerHTML = "";

  // Remove listener antigo, se existir (evita mensagens duplicadas)
  if (unsubscribeMensagens) unsubscribeMensagens();

  const msgsRef = collection(db, "chats", chatId, "mensagens");
  const q = query(msgsRef, orderBy("enviadoEm", "asc"));

  unsubscribeMensagens = onSnapshot(q, (snap) => {
    // reconstrói a lista do zero pra evitar duplicação visual
    mensagensDiv.innerHTML = "";
    snap.forEach((msgDoc) => {
      const msg = msgDoc.data();
      renderMensagem(msg);
    });
    mensagensDiv.scrollTop = mensagensDiv.scrollHeight;
  });
}

// Enviar mensagem
if (formMensagem) {
  formMensagem.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!chatAtivo) return;

    const texto = (mensagemInput.value || "").trim();
    if (!texto) return;

    try {
      await addDoc(collection(db, "chats", chatAtivo, "mensagens"), {
        de: usuarioLogado,
        texto,
        enviadoEm: serverTimestamp()
      });
      mensagemInput.value = "";
    } catch (err) {
      console.error("Erro ao enviar mensagem:", err);
      alert("Erro ao enviar.");
    }
  });
}

// Renderiza uma mensagem na tela (bolha)
function renderMensagem(msg) {
  const wrap = document.createElement("div");
  wrap.className = "message " + (msg.de === usuarioLogado ? "me" : "other");

  const textoDiv = document.createElement("div");
  textoDiv.textContent = msg.texto || "";

  const timeDiv = document.createElement("div");
  timeDiv.className = "timestamp";
  timeDiv.textContent = agoraHHMM(msg.enviadoEm);

  wrap.appendChild(textoDiv);
  wrap.appendChild(timeDiv);

  mensagensDiv.appendChild(wrap);
}

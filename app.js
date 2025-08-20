// ================= Firebase (v10) =================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";
import {
  getFirestore, doc, setDoc, getDoc, getDocs, addDoc, updateDoc,
  collection, query, where, onSnapshot, serverTimestamp, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";

// <<< CONFIG DO PROJETO >>>
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

let unsubscribeMensagens = null;
let unsubscribeChats = null;
// listeners de contagem de não lidas por chat (para evitar duplicações)
const unreadUnsubs = new Map();

// ================= Helpers =================
function go(pagina) { window.location.href = pagina; }
function agoraHHMM(date) {
  try {
    return date?.toDate
      ? date.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch(_) { return ""; }
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
      if (exists.exists()) { alert("Usuário já existe."); return; }

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

// ================= Chat =================
const usuarioLogadoSpan = document.getElementById("usuarioLogado");
const logoutBtn = document.getElementById("logoutBtn");
const listaContatos = document.getElementById("listaContatos");
const novoContatoInput = document.getElementById("novoContato");
const addContatoBtn = document.getElementById("addContatoBtn");
const mensagensDiv = document.getElementById("mensagens");
const chatCom = document.getElementById("chatCom");
const formMensagem = document.getElementById("formMensagem");
const mensagemInput = document.getElementById("mensagemInput");

if (usuarioLogadoSpan || listaContatos || formMensagem) {
  if (!usuarioLogado) {
    go("index.html");
  } else {
    usuarioLogadoSpan.textContent = usuarioLogado;
    iniciarListaDeChats();
  }
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("usuario");
    usuarioLogado = null;
    go("index.html");
  });
}

if (addContatoBtn) {
  addContatoBtn.addEventListener("click", async () => {
    const contato = (novoContatoInput.value || "").trim();
    if (!contato) return;
    if (contato === usuarioLogado) { alert("Não é possível criar chat com você mesmo."); return; }

    try {
      const contatoRef = doc(db, "users", contato);
      const contatoSnap = await getDoc(contatoRef);
      if (!contatoSnap.exists()) { alert("Contato não encontrado."); return; }

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
    } catch (err) {
      console.error("Erro ao adicionar contato:", err);
      alert("Erro ao adicionar contato.");
    }
  });
}

/** Lista os chats do usuário e cria um listener POR CHAT
 *  para contar não lidas (apenas mensagens do OUTRO que você não leu).
 *  Quando você entrar no chat, as mensagens são marcadas como lidas e o
 *  badge zera automaticamente (porque o listener recebe a atualização).
 */
function iniciarListaDeChats() {
  if (!listaContatos) return;

  // Encerra listeners antigos da lista e das contagens
  if (unsubscribeChats) unsubscribeChats();
  for (const u of unreadUnsubs.values()) { try { u(); } catch {} }
  unreadUnsubs.clear();

  const qChats = query(collection(db, "chats"), where("membros", "array-contains", usuarioLogado));
  unsubscribeChats = onSnapshot(qChats, (snap) => {
    listaContatos.innerHTML = "";

    snap.docs.forEach((docSnap) => {
      const chatData = docSnap.data();
      const chatId = docSnap.id;
      const outro = (chatData.membros || []).find(m => m !== usuarioLogado);
      if (!outro) return;

      // Linha visual
      const li = document.createElement("li");
      const name = document.createElement("span");
      name.className = "contact-name";
      name.textContent = outro;
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.hidden = true;

      li.appendChild(name);
      li.appendChild(badge);
      listaContatos.appendChild(li);

      // Ao clicar, abre o chat
      li.addEventListener("click", () => {
        if (chatAtivo === chatId) return;
        abrirChat(chatId, outro);
      });

      // Listener de mensagens DO CHAT para contar NÃO LIDAS (reativo)
      // Estratégia: ouvir todas as mensagens do chat e contar localmente
      // apenas as que foram enviadas pelo OUTRO e que não te incluem em lidoPor.
      const msgsRef = collection(db, "chats", chatId, "mensagens");
      const unsub = onSnapshot(msgsRef, (msnap) => {
        let count = 0;
        msnap.forEach(d => {
          const m = d.data();
          if (m.de !== usuarioLogado) { // só conta o que veio do outro
            if (!m.lidoPor || !m.lidoPor.includes(usuarioLogado)) count++;
          }
        });
        if (count > 0) {
          badge.textContent = String(count);
          badge.hidden = false;
        } else {
          badge.hidden = true;
        }
      });

      unreadUnsubs.set(chatId, unsub);
    });
  });
}

async function abrirChat(chatId, contatoNome) {
  chatAtivo = chatId;
  if (chatCom) chatCom.textContent = contatoNome;
  if (!mensagensDiv) return;

  mensagensDiv.innerHTML = "";
  if (unsubscribeMensagens) unsubscribeMensagens();

  const msgsRef = collection(db, "chats", chatId, "mensagens");
  const qMsgs = query(msgsRef, orderBy("enviadoEm", "asc"));

  unsubscribeMensagens = onSnapshot(qMsgs, async (snap) => {
    mensagensDiv.innerHTML = "";

    // Marca como lidas todas as mensagens do outro que ainda não foram lidas
    const updates = [];
    snap.forEach((msgDoc) => {
      const msg = msgDoc.data();

      // Se foi enviada PELO OUTRO e você ainda não está em lidoPor -> marcar leitura
      if (msg.de !== usuarioLogado) {
        if (!msg.lidoPor || !msg.lidoPor.includes(usuarioLogado)) {
          updates.push(updateDoc(msgDoc.ref, {
            lidoPor: [...(msg.lidoPor || []), usuarioLogado]
          }));
        }
      }

      renderMensagem(msg);
    });

    if (updates.length) {
      try { await Promise.all(updates); } catch (e) { console.warn("Erro ao marcar lidas:", e); }
    }

    mensagensDiv.scrollTop = mensagensDiv.scrollHeight;
  });
}

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
        enviadoEm: serverTimestamp(),
        lidoPor: [usuarioLogado] // quem envia já "leu"
      });
      mensagemInput.value = "";
    } catch (err) {
      console.error("Erro ao enviar mensagem:", err);
      alert("Erro ao enviar.");
    }
  });
}

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

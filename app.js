// ===== Firebase (ES Modules 10.x) =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore, collection, addDoc, query, where, getDocs, onSnapshot,
  doc, setDoc, orderBy, serverTimestamp, updateDoc, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// ===== Configuração do seu projeto Firebase =====
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

// ===== Helpers =====
const $ = (id) => document.getElementById(id);

async function sha256(text) {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}
function chatIdFor(a, b) { return [a, b].sort().join("_"); }

function renderStatus(status) {
  if (!status) return "";
  if (status === "enviado")  return "✔";
  if (status === "recebido") return "✔✔";
  if (status === "lido")     return `<span style="color:#4fc3f7">✔✔</span>`;
  return "";
}

// Som
const notifyEl = typeof window !== "undefined" ? $("notifySound") : null;
function playNotify() {
  if (!notifyEl) return;
  try {
    notifyEl.currentTime = 0;
    const p = notifyEl.play();
    if (p && p.catch) p.catch(()=>{});
  } catch {}
}

// ===== Estado =====
let usuario = JSON.parse(localStorage.getItem("usuario")) || null; // {usuario, telefone, nome, senhaHash?}
let chatAtual = null;
let contatoAtual = null;
let unsubMensagens = null;
let unsubChats = null;

// ===== LOGIN =====
if ($("loginForm")) {
  $("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const entrada = $("loginInput").value.trim(); // usuário OU telefone
    const senha = $("loginSenha").value;

    try {
      // Tenta por usuário
      let snap = await getDocs(query(collection(db, "users"), where("usuario", "==", entrada)));
      let userDoc = !snap.empty ? snap.docs[0] : null;

      // Se não achou, tenta por telefone
      if (!userDoc) {
        snap = await getDocs(query(collection(db, "users"), where("telefone", "==", entrada)));
        userDoc = !snap.empty ? snap.docs[0] : null;
      }

      if (!userDoc) return alert("Usuário não encontrado.");

      const dados = userDoc.data();
      const senhaHash = await sha256(senha);

      const ok =
        (dados.senhaHash && dados.senhaHash === senhaHash) ||
        (dados.senha && dados.senha === senha); // compatibilidade

      if (!ok) return alert("Senha incorreta.");

      usuario = dados;
      localStorage.setItem("usuario", JSON.stringify(usuario));
      window.location.href = "chat.html";
    } catch (err) {
      console.error(err);
      alert("Erro ao fazer login. Veja o console.");
    }
  });
}

// ===== CADASTRO =====
if ($("cadastroForm")) {
  $("cadastroForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const nome = ($("cadastroNome")?.value || "").trim();
    const usuarioCadastro = $("cadastroUsuario").value.trim();
    const telefone = ($("cadastroTelefone")?.value || "").trim();
    const senha = $("cadastroSenha").value;

    if (!usuarioCadastro || !senha) return alert("Preencha usuário e senha.");

    try {
      const ja = await getDocs(query(collection(db, "users"), where("usuario", "==", usuarioCadastro)));
      if (!ja.empty) return alert("Usuário já existe.");

      const senhaHash = await sha256(senha);
      await setDoc(doc(db, "users", usuarioCadastro), {
        usuario: usuarioCadastro,
        nome: nome || usuarioCadastro,
        telefone: telefone || "",
        senhaHash,
        senha, // compatibilidade (pode remover depois)
        criadoEm: serverTimestamp()
      });

      alert("Cadastro realizado! Faça login.");
      window.location.href = "index.html";
    } catch (err) {
      console.error(err);
      alert("Erro ao cadastrar. Veja o console.");
    }
  });
}

// ===== Proteção de rota do chat =====
if (location.pathname.endsWith("chat.html")) {
  if (!usuario) {
    window.location.href = "index.html";
  }
}

// ===== Chat (UI básica) =====
if ($("sairBtn")) {
  $("usuarioLogado").innerText = usuario?.usuario || "";
  $("sairBtn").addEventListener("click", () => {
    localStorage.removeItem("usuario");
    window.location.href = "index.html";
  });
}

// Criar/abrir chat
if ($("addContato")) {
  $("addContato").addEventListener("click", async () => {
    const entrada = ($("novoContato").value || "").trim();
    if (!entrada) return;

    try {
      // encontra o alvo por usuario ou telefone
      let snap = await getDocs(query(collection(db, "users"), where("usuario", "==", entrada)));
      let alvo = !snap.empty ? snap.docs[0].data().usuario : null;
      if (!alvo) {
        snap = await getDocs(query(collection(db, "users"), where("telefone", "==", entrada)));
        alvo = !snap.empty ? snap.docs[0].data().usuario : null;
      }
      if (!alvo) return alert("Contato não encontrado.");
      if (alvo === usuario.usuario) return alert("Não é possível iniciar chat consigo mesmo.");

      const id = chatIdFor(usuario.usuario, alvo);
      await setDoc(doc(db, "chats", id), {
        membros: [usuario.usuario, alvo],
        criadoEm: serverTimestamp()
      }, { merge: true });

      // não abre automaticamente — você clica na lista
      $("novoContato").value = "";
    } catch (err) {
      console.error(err);
      alert("Erro ao criar chat.");
    }
  });
}

// Lista de chats (sem duplicação)
const listaContatos = $("listaContatos");
function desenharItem(chatId, amigo) {
  const li = document.createElement("li");
  li.dataset.chatId = chatId;
  li.dataset.amigo = amigo;
  li.innerHTML = `
    <div class="chat-item">
      <span class="chat-nome">${amigo}</span>
      <span class="chat-preview" id="preview-${chatId}"></span>
    </div>
  `;
  return li;
}

function startChatsWatch() {
  if (!listaContatos || !usuario) return;
  if (unsubChats) { unsubChats(); unsubChats = null; }

  const qChats = query(collection(db, "chats"), where("membros", "array-contains", usuario.usuario));
  unsubChats = onSnapshot(qChats, async (snap) => {
    const frag = document.createDocumentFragment();

    for (const chatDoc of snap.docs) {
      const dados = chatDoc.data();
      const chatId = chatDoc.id;
      const amigo = (dados.membros || []).find(m => m !== usuario.usuario) || "Chat";

      const li = desenharItem(chatId, amigo);
      frag.appendChild(li);

      // preview da última mensagem
      onSnapshot(
        query(collection(db, "chats", chatId, "mensagens"), orderBy("timestamp", "desc")),
        (s2) => {
          const prev = $("preview-" + chatId);
          if (prev) {
            if (!s2.empty) {
              const m = s2.docs[0].data();
              prev.textContent = (m.texto || "");
            } else prev.textContent = "";
          }
        }
      );
    }

    listaContatos.replaceChildren(frag);
  });
}

if (location.pathname.endsWith("chat.html")) startChatsWatch();

// Clique único para abrir chat
if (listaContatos) {
  listaContatos.addEventListener("click", (e) => {
    const li = e.target.closest("li[data-chat-id]");
    if (!li) return;
    const { chatId, amigo } = li.dataset;
    abrirChat(chatId, amigo);
  });
}

// ===== Abrir e renderizar mensagens =====
const messagesBox = $("messages");
const nomeContato = $("nomeContato");

function renderMsgBubble(msg) {
  const div = document.createElement("div");
  div.classList.add("message");
  div.classList.add(msg.usuario === usuario.usuario ? "bg-me" : "bg-other");

  const body = document.createElement("div");
  body.classList.add("body");
  body.textContent = msg.texto || "";

  const meta = document.createElement("div");
  meta.classList.add("meta");

  let timeStr = "";
  if (msg.timestamp?.toDate) {
    const t = msg.timestamp.toDate();
    timeStr = t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  const ticks = msg.usuario === usuario.usuario ? renderStatus(msg.status) : "";
  meta.innerHTML = `<span>${timeStr}</span> ${ticks}`;

  div.appendChild(body);
  div.appendChild(meta);
  return div;
}

function abrirChat(idChat, amigo) {
  chatAtual = idChat;
  contatoAtual = amigo;
  if (nomeContato) nomeContato.textContent = amigo;
  if (!messagesBox) return;

  messagesBox.innerHTML = "";
  if (unsubMensagens) { unsubMensagens(); unsubMensagens = null; }

  const q = query(collection(db, "chats", chatAtual, "mensagens"), orderBy("timestamp", "asc"));
  unsubMensagens = onSnapshot(q, async (snapshot) => {
    const frag = document.createDocumentFragment();

    for (const d of snapshot.docs) {
      const msg = d.data();
      frag.appendChild(renderMsgBubble(msg));

      // Se é mensagem do outro e ainda está "enviado", marca "recebido" e toca som
      if (msg.usuario !== usuario.usuario && msg.status === "enviado") {
        updateDoc(d.ref, { status: "recebido" }).catch(()=>{});
        playNotify();
      }
    }

    messagesBox.replaceChildren(frag);
    messagesBox.scrollTop = messagesBox.scrollHeight;

    // Marca como lido mensagens do outro que não estão lidas
    for (const d of snapshot.docs) {
      const msg = d.data();
      if (msg.usuario !== usuario.usuario && msg.status !== "lido") {
        updateDoc(d.ref, { status: "lido" }).catch(()=>{});
      }
    }
  });
}

// ===== Enviar mensagem =====
const chatForm = $("chatForm");
if (chatForm) {
  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!chatAtual) return alert("Selecione um chat primeiro.");
    const input = $("mensagemInput");
    const texto = (input.value || "").trim();
    if (!texto) return;
    input.value = "";

    await addDoc(collection(db, "chats", chatAtual, "mensagens"), {
      usuario: usuario.usuario,
      texto,
      timestamp: serverTimestamp(),
      status: "enviado"
    });
  });
}

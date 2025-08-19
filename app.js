// ===== Firebase (ES Modules) =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore, collection, addDoc, query, where, getDocs, onSnapshot,
  doc, setDoc, orderBy, serverTimestamp, updateDoc, limit, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// ===== Configuração do seu projeto Firebase (a mesma que já estava funcionando) =====
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

// ===== Estado global =====
let usuario = JSON.parse(localStorage.getItem("usuario")) || null;
let chatAtivo = null;
let contatoAtivo = null;

let unsubscribeMsgs = null;
let unsubscribeChats = null;     // <== watcher único para a lista
let typingUnsub = null;
let presenceUnsub = null;

let otherLastRead = null;
let apelidos = {};               // (opcional) apelidos salvos em "contacts"
let presencePingTimer = null;

// ===== Helpers =====
function $(id) { return document.getElementById(id); }

async function sha256(text) {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}
function chatIdFor(a, b) { return [a, b].sort().join("_"); }

// ====== LOGIN ======
if ($("loginForm")) {
  $("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const loginInput = $("loginInput").value.trim();
    const senha = $("senhaLogin").value;

    // busca por usuario OU telefone
    let userDoc = null;
    let r1 = await getDocs(query(collection(db, "users"), where("usuario", "==", loginInput)));
    if (!r1.empty) userDoc = r1.docs[0];
    if (!userDoc) {
      const r2 = await getDocs(query(collection(db, "users"), where("telefone", "==", loginInput)));
      if (!r2.empty) userDoc = r2.docs[0];
    }
    if (!userDoc) return alert("Usuário não encontrado.");

    const dados = userDoc.data();
    const senhaHash = await sha256(senha);
    if (dados.senhaHash !== senhaHash) return alert("Senha incorreta.");

    usuario = dados; // contém {usuario, nome, telefone, senhaHash...}
    localStorage.setItem("usuario", JSON.stringify(usuario));

    // atualiza presença
    updateDoc(doc(db, "users", usuario.usuario), { ultimoAcesso: serverTimestamp() }).catch(()=>{});

    window.location.href = "chat.html";
  });
}

// ====== CADASTRO ======
if ($("cadastroForm")) {
  $("cadastroForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const nome = $("nomeCadastro").value.trim();
    const usuarioCadastro = $("usuarioCadastro").value.trim();
    const telefone = $("telefoneCadastro").value.trim();
    const senha = $("senhaCadastro").value;

    if (!nome || !usuarioCadastro || !telefone || !senha) {
      return alert("Preencha todos os campos.");
    }

    const jaExiste = await getDoc(doc(db, "users", usuarioCadastro));
    if (jaExiste.exists()) return alert("Usuário já existe.");

    const senhaHash = await sha256(senha);
    await setDoc(doc(db, "users", usuarioCadastro), {
      nome,
      usuario: usuarioCadastro,
      telefone,
      senhaHash,
      criadoEm: serverTimestamp(),
      ultimoAcesso: serverTimestamp()
    });

    alert("Cadastro realizado! Faça login.");
    window.location.href = "index.html";
  });
}

// ====== Proteção simples (chat.html precisa de login) ======
if (location.pathname.endsWith("chat.html") && !usuario) {
  window.location.href = "index.html";
}

// ====== UI - Chat ======
if ($("logoutBtn")) {
  $("logoutBtn").addEventListener("click", () => {
    localStorage.removeItem("usuario");
    window.location.href = "index.html";
  });
}

if ($("userNome") && usuario) {
  $("userNome").innerText = usuario.usuario;
}

// criar novo chat
if ($("addChatBtn")) {
  $("addChatBtn").addEventListener("click", async () => {
    const entrada = ($("novoChatInput").value || "").trim();
    if (!entrada) return;
    if (!usuario) return alert("Faça login novamente.");

    // resolve amigo por usuario ou telefone
    let amigo = null;
    let r = await getDocs(query(collection(db, "users"), where("usuario", "==", entrada)));
    if (!r.empty) amigo = r.docs[0].data().usuario;
    if (!amigo) {
      r = await getDocs(query(collection(db, "users"), where("telefone", "==", entrada)));
      if (!r.empty) amigo = r.docs[0].data().usuario;
    }
    if (!amigo) return alert("Usuário não encontrado.");
    if (amigo === usuario.usuario) return alert("Você não pode iniciar chat consigo mesmo.");

    const id = chatIdFor(usuario.usuario, amigo);
    await setDoc(doc(db, "chats", id), {
      membros: [usuario.usuario, amigo],
      criadoEm: serverTimestamp(),
      lastRead: {}
    }, { merge: true });

    $("novoChatInput").value = "";
  });
}

// ====== Lista de conversas (SEM duplicação) ======
const chatList = $("chatList");

function startChatsWatch() {
  if (!chatList || !usuario) return;

  // garante watcher único
  if (unsubscribeChats) { unsubscribeChats(); unsubscribeChats = null; }

  const q = query(collection(db, "chats"), where("membros", "array-contains", usuario.usuario));
  unsubscribeChats = onSnapshot(q, async (snap) => {
    // monta fragment e substitui de uma vez (replaceChildren) — sem duplicações
    const frag = document.createDocumentFragment();

    // opcional: ordenar por último timestamp de mensagem (padrão WhatsApp)
    // aqui só percorremos na ordem que veio
    for (const chatDoc of snap.docs) {
      const dados = chatDoc.data();
      const chatId = chatDoc.id;
      const amigo = (dados.membros || []).find(m => m !== usuario.usuario) || "Chat";
      const nomeExibicao = apelidos[amigo] || amigo;

      const li = document.createElement("li");
      li.id = `chat-${chatId}`;
      li.dataset.chatId = chatId;
      li.dataset.amigo = amigo;

      const title = document.createElement("div");
      title.innerHTML = `<strong>${nomeExibicao}</strong>`;

      const sub = document.createElement("div");
      sub.className = "muted tiny";
      sub.style.whiteSpace = "nowrap";
      sub.style.overflow = "hidden";
      sub.style.textOverflow = "ellipsis";
      sub.textContent = ""; // snippet será preenchido abaixo

      li.appendChild(title);
      li.appendChild(sub);
      frag.appendChild(li);

      // carrega último texto de forma assíncrona e atualiza o sub
      try {
        const lastQ = query(
          collection(db, "chats", chatId, "mensagens"),
          orderBy("timestamp", "desc"),
          limit(1)
        );
        const lastSnap = await getDocs(lastQ);
        sub.textContent = lastSnap.empty ? "" : (lastSnap.docs[0].data().texto || "");
      } catch { /* ignora */ }
    }

    // troca todo o conteúdo da UL de uma vez
    chatList.replaceChildren(frag);
  });
}

// clique em um item (event delegation único)
if (chatList) {
  chatList.addEventListener("click", (e) => {
    const li = e.target.closest("li[data-chat-id]");
    if (!li) return;
    abrirChat(li.dataset.chatId, li.dataset.amigo);
  });
}

// inicia watcher de conversas somente na chat.html
if (location.pathname.endsWith("chat.html")) {
  startChatsWatch();
}

// ====== Abrir chat ======
function abrirChat(id, amigo) {
  // encerra listeners anteriores
  if (unsubscribeMsgs) { unsubscribeMsgs(); unsubscribeMsgs = null; }
  if (typingUnsub)   { typingUnsub();   typingUnsub = null; }
  if (presenceUnsub) { presenceUnsub(); presenceUnsub = null; }

  chatAtivo = id;
  contatoAtivo = amigo;

  if ($("chatAtivoNome")) $("chatAtivoNome").innerText = apelidos[amigo] || amigo;
  if ($("saveContactBtn")) $("saveContactBtn").disabled = false;

  // marca como lido para mim
  updateDoc(doc(db, "chats", chatAtivo), { [`lastRead.${usuario.usuario}`]: serverTimestamp() }).catch(()=>{});

  carregarMensagens();
  watchTypingDoOutro();
  watchPresenceDoOutro();
}

// ====== Mensagens ======
function carregarMensagens() {
  if (!chatAtivo) return;
  const messagesContainer = $("messagesContainer");
  if (!messagesContainer) return;

  messagesContainer.innerHTML = "";

  if (unsubscribeMsgs) { unsubscribeMsgs(); unsubscribeMsgs = null; }
  otherLastRead = null;

  const q = query(collection(db, "chats", chatAtivo, "mensagens"), orderBy("timestamp", "asc"));
  unsubscribeMsgs = onSnapshot(q, (snapshot) => {
    // redesenha as mensagens do zero (mais simples e confiável)
    const frag = document.createDocumentFragment();

    snapshot.docs.forEach((docSnap) => {
      const msg = docSnap.data();
      const div = document.createElement("div");
      div.classList.add("message");
      const isMe = msg.usuario === usuario.usuario;
      div.classList.add(isMe ? "bg-me" : "bg-other");

      const t = msg.timestamp?.toDate ? msg.timestamp.toDate() : new Date();
      const hh = String(t.getHours()).padStart(2, "0");
      const mm = String(t.getMinutes()).padStart(2, "0");

      let ticks = "";
      if (isMe) {
        const read = otherLastRead &&
          msg.timestamp &&
          (msg.timestamp.toMillis?.() || 0) <= (otherLastRead.toMillis?.() || 0);
        ticks = read ? "✓✓" : "✓";
      }

      div.innerHTML = `
        <div>${(msg.texto || "").replace(/</g, "&lt;")}</div>
        <div class="meta"><span>${hh}:${mm}</span> <span class="ticks">${ticks}</span></div>
      `;
      frag.appendChild(div);
    });

    messagesContainer.replaceChildren(frag);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  });
}

// enviar mensagem
if ($("chatForm")) {
  $("chatForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!chatAtivo) return alert("Selecione um chat primeiro!");
    const input = $("mensagemInput");
    const texto = (input.value || "").trim();
    if (!texto) return;

    await addDoc(collection(db, "chats", chatAtivo, "mensagens"), {
      usuario: usuario.usuario,
      texto,
      timestamp: serverTimestamp()
    });

    // atualiza meu lastRead
    updateDoc(doc(db, "chats", chatAtivo), { [`lastRead.${usuario.usuario}`]: serverTimestamp() }).catch(()=>{});

    input.value = "";
    setTyping(false);
  });
}

// ====== Typing ======
const msgInput = $("mensagemInput");
let typingTimer = null;

function setTyping(isTyping) {
  if (!chatAtivo || !usuario) return;
  const ref = doc(db, "chats", chatAtivo, "typing", usuario.usuario);
  setDoc(ref, { typing: !!isTyping, ts: serverTimestamp() }, { merge: true }).catch(()=>{});
}

if (msgInput) {
  msgInput.addEventListener("input", () => {
    setTyping(true);
    if (typingTimer) clearTimeout(typingTimer);
    typingTimer = setTimeout(() => setTyping(false), 1500);
  });
}

function watchTypingDoOutro() {
  const typingDiv = $("typingIndicator");
  if (typingUnsub) typingUnsub();
  if (!chatAtivo || !usuario || !typingDiv) return;

  const outro = contatoAtivo;
  const ref = doc(db, "chats", chatAtivo, "typing", outro);
  typingUnsub = onSnapshot(ref, (snap) => {
    const d = snap.data();
    typingDiv.textContent = d?.typing ? `${outro} está digitando…` : "";
  });
}

// ====== Presença ======
function watchPresenceDoOutro() {
  const badge = $("presenceBadge");
  if (presenceUnsub) presenceUnsub();
  if (!badge || !contatoAtivo) return;

  const ref = doc(db, "users", contatoAtivo);
  presenceUnsub = onSnapshot(ref, (snap) => {
    const d = snap.data() || {};
    const last = d.ultimoAcesso?.toMillis?.() || 0;
    const online = Date.now() - last < 60_000;
    badge.textContent = online ? "ON" : "OFF";
    badge.classList.toggle("online", online);
    badge.classList.toggle("offline", !online);
  });

  // ping de presença do usuário logado (a cada 30s)
  if (presencePingTimer) clearInterval(presencePingTimer);
  presencePingTimer = setInterval(() => {
    if (usuario?.usuario) {
      updateDoc(doc(db, "users", usuario.usuario), { ultimoAcesso: serverTimestamp() }).catch(()=>{});
    }
  }, 30_000);
}

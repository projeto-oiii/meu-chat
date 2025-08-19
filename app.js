// ===== Firebase (ES Modules) =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore, collection, addDoc, query, where, getDocs, onSnapshot,
  doc, setDoc, orderBy, getDoc, serverTimestamp, updateDoc, limit
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

// ===== Estado simples no client =====
let usuario = JSON.parse(localStorage.getItem("usuario")) || null;
let chatAtivo = null;       // id do chat "a_b"
let contatoAtivo = null;    // nickname do outro
let apelidos = {};          // cache { contato: "apelido salvo" }
let otherLastRead = null;   // timestamp de leitura do outro
let presenceUnsub = null;
let typingUnsub = null;
let typingTimer = null;

// ===== Utils =====
async function sha256(text) {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}
function chatIdFor(a, b) { return [a, b].sort().join("_"); }

// ===== Contatos (apelidos) =====
async function salvarContatoAs(ownerUser, contatoNickname, apelido) {
  await setDoc(doc(db, "contacts", ownerUser, "lista", contatoNickname), {
    contato: contatoNickname,
    apelido
  });
}
async function getApelidoOnce(ownerUser, contatoNickname) {
  const ref = doc(db, "contacts", ownerUser, "lista", contatoNickname);
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data().apelido || contatoNickname) : contatoNickname;
}
function watchApelidos(ownerUser) {
  const colRef = collection(db, "contacts", ownerUser, "lista");
  onSnapshot(colRef, (snap) => {
    snap.docChanges().forEach(change => {
      const data = change.doc.data();
      apelidos[data.contato] = data.apelido || data.contato;
    });
    if (contatoAtivo) {
      const header = document.getElementById("chatAtivoNome");
      if (header) header.innerText = apelidos[contatoAtivo] || contatoAtivo;
    }
    renderListaChats();
  });
}

// ===== Cadastro =====
const cadastroForm = document.getElementById("cadastroForm");
if (cadastroForm) {
  cadastroForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nome = document.getElementById("nomeCadastro").value.trim();
    const usuarioCadastro = document.getElementById("usuarioCadastro").value.trim();
    const telefone = document.getElementById("telefoneCadastro").value.trim();
    const senha = document.getElementById("senhaCadastro").value;

    try {
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
    const loginInput = document.getElementById("loginInput").value.trim();
    const senhaLogin = document.getElementById("senhaLogin").value;

    let userDoc = null;

    // 1) procurar por usuário
    let r1 = await getDocs(query(collection(db, "users"), where("usuario", "==", loginInput)));
    if (!r1.empty) userDoc = r1.docs[0];

    // 2) se não achar, procurar por telefone
    if (!userDoc) {
      let r2 = await getDocs(query(collection(db, "users"), where("telefone", "==", loginInput)));
      if (!r2.empty) userDoc = r2.docs[0];
    }

    if (!userDoc) return alert("Usuário não encontrado.");

    const dados = userDoc.data();
    const hash = await sha256(senhaLogin);
    if (dados.senhaHash !== hash) return alert("Senha incorreta.");

    usuario = dados;
    localStorage.setItem("usuario", JSON.stringify(dados));

    updateDoc(doc(db, "users", dados.usuario), { ultimoAcesso: serverTimestamp() }).catch(()=>{});

    window.location.href = "chat.html";
  });
}

// ===== Proteção simples: se entrar em chat.html sem login, redireciona =====
if (document.body && location.pathname.endsWith("chat.html")) {
  if (!usuario) {
    location.href = "index.html";
  }
}

// ===== Inicialização de UI (chat) =====
const userNome = document.getElementById("userNome");
if (userNome && usuario) {
  userNome.innerText = usuario.usuario;
  watchApelidos(usuario.usuario);
}

// Sair
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("usuario");
    window.location.href = "index.html";
  });
}

// ===== Adicionar conversa =====
const addChatBtn = document.getElementById("addChatBtn");
if (addChatBtn) {
  addChatBtn.addEventListener("click", async () => {
    const entrada = (document.getElementById("novoChatInput").value || "").trim();
    if (!entrada) return;
    if (!usuario) return alert("Faça login novamente.");

    // resolve nickname real do amigo
    let amigoNickname = null;
    let r = await getDocs(query(collection(db, "users"), where("usuario", "==", entrada)));
    if (!r.empty) amigoNickname = r.docs[0].data().usuario;
    if (!amigoNickname) {
      r = await getDocs(query(collection(db, "users"), where("telefone", "==", entrada)));
      if (!r.empty) amigoNickname = r.docs[0].data().usuario;
    }

    if (!amigoNickname) return alert("Usuário não encontrado pelo apelido/telefone.");
    if (amigoNickname === usuario.usuario) return alert("Você não pode iniciar chat consigo mesmo.");

    const id = chatIdFor(usuario.usuario, amigoNickname);
    await setDoc(doc(db, "chats", id), {
      membros: [usuario.usuario, amigoNickname],
      criadoEm: serverTimestamp(),
      lastRead: {}, // { usuario: Timestamp }
    }, { merge: true });

    document.getElementById("novoChatInput").value = "";
  });
}

// ===== Lista de conversas =====
const chatList = document.getElementById("chatList");
let unsubscribeChats = null;

function startChatsWatch() {
  if (!chatList || !usuario) return;
  const q = query(collection(db, "chats"), where("membros", "array-contains", usuario.usuario));
  if (unsubscribeChats) unsubscribeChats();
  unsubscribeChats = onSnapshot(q, renderListaChats);
}

async function renderListaChats() {
  if (!chatList || !usuario) return;
  const q = query(collection(db, "chats"), where("membros", "array-contains", usuario.usuario));
  const snap = await getDocs(q);

  chatList.innerHTML = "";

  for (const docSnap of snap.docs) {
    const dados = docSnap.data();
    const amigo = (dados.membros || []).find(m => m !== usuario.usuario) || "Chat";
    const nomeExibicao = apelidos[amigo] || amigo;

    // última mensagem
    const lastQ = query(collection(db, "chats", docSnap.id, "mensagens"), orderBy("timestamp", "desc"), limit(1));
    const lastSnap = await getDocs(lastQ);
    const last = lastSnap.empty ? null : lastSnap.docs[0].data();
    const snippet = last ? (last.texto || "") : "";

    const li = document.createElement("li");
    li.innerHTML = `
      <div><strong>${nomeExibicao}</strong></div>
      <div class="muted tiny" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:95%">${snippet}</div>
    `;

    li.addEventListener("click", () => {
      abrirChat(docSnap.id, amigo);
    });

    // salvar contato por clique direito
    li.addEventListener("contextmenu", async (e) => {
      e.preventDefault();
      const atual = apelidos[amigo] || amigo;
      const novo = prompt("Salvar contato como:", atual);
      if (novo && novo.trim()) await salvarContatoAs(usuario.usuario, amigo, novo.trim());
    });

    chatList.appendChild(li);
  }
}
startChatsWatch();

// ===== “Salvar contato” no header =====
const saveContactBtn = document.getElementById("saveContactBtn");
if (saveContactBtn) {
  saveContactBtn.addEventListener("click", async () => {
    if (!contatoAtivo || !usuario) return;
    const atual = apelidos[contatoAtivo] || contatoAtivo;
    const novo = prompt("Salvar contato como:", atual);
    if (novo && novo.trim()) await salvarContatoAs(usuario.usuario, contatoAtivo, novo.trim());
  });
}

// ===== Abrir chat =====
function abrirChat(id, amigo) {
  chatAtivo = id;
  contatoAtivo = amigo;
  document.getElementById("chatAtivoNome").innerText = apelidos[amigo] || amigo;
  const saveBtn = document.getElementById("saveContactBtn");
  if (saveBtn) saveBtn.disabled = false;

  // atualiza minha leitura
  updateDoc(doc(db, "chats", chatAtivo), { [`lastRead.${usuario.usuario}`]: serverTimestamp() }).catch(()=>{});

  // listeners
  carregarMensagens();
  watchTypingDoOutro();
  watchPresenceDoOutro();
}

// ===== Mensagens =====
let unsubscribeMsgs = null;

function carregarMensagens() {
  if (!chatAtivo) return;

  const messagesContainer = document.getElementById("messagesContainer");
  messagesContainer.innerHTML = "";

  // observar doc do chat para saber lastRead do outro
  const chatDocRef = doc(db, "chats", chatAtivo);
  onSnapshot(chatDocRef, (d) => {
    const data = d.data() || {};
    const outro = (data.membros || []).find(m => m !== usuario.usuario);
    otherLastRead = (data.lastRead || {})[outro] || null;
  });

  const q = query(collection(db, "chats", chatAtivo, "mensagens"), orderBy("timestamp", "asc"));

  if (unsubscribeMsgs) unsubscribeMsgs();
  unsubscribeMsgs = onSnapshot(q, (snapshot) => {
    messagesContainer.innerHTML = "";
    snapshot.docs.forEach((docSnap) => {
      const msg = docSnap.data();
      const div = document.createElement("div");
      div.classList.add("message");
      const isMe = msg.usuario === usuario.usuario;
      div.classList.add(isMe ? "bg-me" : "bg-other");
      div.classList.add(isMe ? "me" : "other");

      const time = msg.timestamp?.toDate ? msg.timestamp.toDate() : new Date();
      const hh = String(time.getHours()).padStart(2, '0');
      const mm = String(time.getMinutes()).padStart(2, '0');

      let ticks = "";
      if (isMe) {
        // ✓ sempre; ✓✓ quando lido (<= otherLastRead)
        const read = otherLastRead && msg.timestamp && (msg.timestamp.toMillis?.() || 0) <= (otherLastRead.toMillis?.() || 0);
        ticks = read ? "✓✓" : "✓";
      }

      div.innerHTML = `
        <div>${(msg.texto || "").replace(/</g, '&lt;')}</div>
        <div class="meta"><span>${hh}:${mm}</span> <span class="ticks">${ticks}</span></div>
      `;

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
    if (!chatAtivo) return alert("Selecione um chat primeiro!");
    const input = document.getElementById("mensagemInput");
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

// ===== Typing indicator =====
const msgInput = document.getElementById("mensagemInput");
if (msgInput) {
  msgInput.addEventListener("input", () => {
    setTyping(true);
    if (typingTimer) clearTimeout(typingTimer);
    typingTimer = setTimeout(() => setTyping(false), 1500);
  });
}
function setTyping(isTyping) {
  if (!chatAtivo || !usuario) return;
  const ref = doc(db, "chats", chatAtivo, "typing", usuario.usuario);
  setDoc(ref, { typing: !!isTyping, ts: serverTimestamp() }, { merge: true });
}
function watchTypingDoOutro() {
  if (typingUnsub) typingUnsub();
  if (!chatAtivo || !usuario) return;

  const typingDiv = document.getElementById("typingIndicator");
  const outro = contatoAtivo;
  const ref = doc(db, "chats", chatAtivo, "typing", outro);
  typingUnsub = onSnapshot(ref, (snap) => {
    const d = snap.data();
    const isTyping = !!d?.typing;
    typingDiv.textContent = isTyping ? `${apelidos[outro] || outro} está digitando…` : "";
  });
}

// ===== Presence (heurística por último acesso) =====
function watchPresenceDoOutro() {
  const badge = document.getElementById("presenceBadge");
  if (presenceUnsub) presenceUnsub();
  const ref = doc(db, "users", contatoAtivo);
  presenceUnsub = onSnapshot(ref, (snap) => {
    const d = snap.data() || {};
    const last = d.ultimoAcesso?.toMillis?.() || 0;
    const online = Date.now() - last < 60_000; // 60s
    badge.textContent = online ? 'on' : 'off';
    badge.classList.toggle('online', online);
    badge.classList.toggle('offline', !online);
  });

  // atualiza meu último acesso periodicamente
  setInterval(() => {
    if (usuario?.usuario) updateDoc(doc(db, "users", usuario.usuario), { ultimoAcesso: serverTimestamp() }).catch(()=>{});
  }, 30_000);
}

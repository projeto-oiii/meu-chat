// ================================
// Firebase Config & Inicialização
// ================================
import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore, collection, addDoc, query, where, orderBy, limit,
  setDoc, doc, getDoc, getDocs, updateDoc, serverTimestamp, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "SUA_KEY",
  authDomain: "SUA_APP.firebaseapp.com",
  projectId: "SUA_APP",
  storageBucket: "SUA_APP.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:00000000000000"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ================================
// Variáveis Globais
// ================================
let usuario = JSON.parse(localStorage.getItem("usuario")) || null;
let chatAtivo = null;
let contatoAtivo = null;
let unsubscribeMsgs = null;
let typingUnsub = null;
let presenceUnsub = null;
let otherLastRead = null;
let apelidos = {};
let renderedChats = new Set(); // 🔥 usado para evitar duplicação

// ================================
// Helpers
// ================================
function $(id) {
  return document.getElementById(id);
}

// ================================
// Login & Cadastro
// ================================
if ($("loginForm")) {
  $("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const usuarioLogin = $("loginInput").value.trim();
    const senha = $("senhaLogin").value;

    const userRef = doc(db, "users", usuarioLogin);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      alert("Usuário não encontrado!");
      return;
    }
    const dados = snap.data();
    if (dados.senha !== senha) {
      alert("Senha incorreta!");
      return;
    }

    usuario = { usuario: usuarioLogin, nome: dados.nome };
    localStorage.setItem("usuario", JSON.stringify(usuario));
    window.location.href = "chat.html";
  });
}

if ($("cadastroForm")) {
  $("cadastroForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const nome = $("nomeCadastro").value.trim();
    const usuarioCadastro = $("usuarioCadastro").value.trim();
    const telefone = $("telefoneCadastro").value.trim();
    const senha = $("senhaCadastro").value;

    const userRef = doc(db, "users", usuarioCadastro);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      alert("Usuário já existe!");
      return;
    }

    await setDoc(userRef, {
      nome, telefone, senha, criadoEm: serverTimestamp()
    });

    alert("Cadastro realizado com sucesso!");
    window.location.href = "index.html";
  });
}

// ================================
// Chat Principal
// ================================
if ($("logoutBtn")) {
  $("logoutBtn").addEventListener("click", () => {
    localStorage.removeItem("usuario");
    window.location.href = "index.html";
  });
}

const chatList = $("chatList");
if (chatList) {
  chatList.onclick = (e) => {
    const li = e.target.closest("li");
    if (!li) return;
    const chatId = li.dataset.chatId;
    const amigo = li.dataset.amigo;
    abrirChat(chatId, amigo);
  };
}

async function abrirChat(id, amigo) {
  if (unsubscribeMsgs) { unsubscribeMsgs(); unsubscribeMsgs = null; }
  if (typingUnsub) { typingUnsub(); typingUnsub = null; }
  if (presenceUnsub) { presenceUnsub(); presenceUnsub = null; }

  chatAtivo = id;
  contatoAtivo = amigo;
  $("chatAtivoNome").innerText = apelidos[amigo] || amigo;
  $("saveContactBtn").disabled = false;

  updateDoc(doc(db, "chats", chatAtivo), {
    [`lastRead.${usuario.usuario}`]: serverTimestamp()
  }).catch(() => {});

  carregarMensagens();
  watchTypingDoOutro();
  watchPresenceDoOutro();
}

// ================================
// Renderizar Lista de Chats
// ================================
async function renderListaChatsFromSnap(snap) {
  chatList.innerHTML = "";
  renderedChats.clear();

  for (const docSnap of snap.docs) {
    const dados = docSnap.data();
    const chatId = docSnap.id;

    if (renderedChats.has(chatId)) continue;
    renderedChats.add(chatId);

    const amigo = (dados.membros || []).find(m => m !== usuario.usuario) || "Chat";
    const nomeExibicao = apelidos[amigo] || amigo;

    let snippet = "";
    try {
      const lastQ = query(
        collection(db, "chats", chatId, "mensagens"),
        orderBy("timestamp", "desc"),
        limit(1)
      );
      const lastSnap = await getDocs(lastQ);
      snippet = lastSnap.empty ? "" : (lastSnap.docs[0].data().texto || "");
    } catch (_) {}

    const li = document.createElement("li");
    li.dataset.chatId = chatId;
    li.dataset.amigo = amigo;
    li.innerHTML = `
      <div><strong>${nomeExibicao}</strong></div>
      <div class="muted tiny" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:95%">
        ${snippet}
      </div>
    `;
    chatList.appendChild(li);
  }
}

// ================================
// Carregar Mensagens
// ================================
function carregarMensagens() {
  if (!chatAtivo) return;
  const messagesContainer = $("messagesContainer");
  messagesContainer.innerHTML = "";

  if (unsubscribeMsgs) { unsubscribeMsgs(); unsubscribeMsgs = null; }
  otherLastRead = null;

  const q = query(collection(db, "chats", chatAtivo, "mensagens"), orderBy("timestamp", "asc"));
  unsubscribeMsgs = onSnapshot(q, (snapshot) => {
    messagesContainer.innerHTML = "";
    snapshot.docs.forEach((docSnap) => {
      const msg = docSnap.data();
      const div = document.createElement("div");
      div.classList.add("message");
      const isMe = msg.usuario === usuario.usuario;
      div.classList.add(isMe ? "bg-me" : "bg-other");

      const time = msg.timestamp?.toDate ? msg.timestamp.toDate() : new Date();
      const hh = String(time.getHours()).padStart(2, "0");
      const mm = String(time.getMinutes()).padStart(2, "0");

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
      messagesContainer.appendChild(div);
    });
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  });
}

// ================================
// Digitação & Presença
// ================================
function watchTypingDoOutro() {
  if (!chatAtivo) return;
  const typingDoc = doc(db, "chats", chatAtivo, "typing", contatoAtivo);
  typingUnsub = onSnapshot(typingDoc, (snap) => {
    $("typingIndicator").innerText = snap.exists() && snap.data().digitando ? `${contatoAtivo} está digitando...` : "";
  });
}

function watchPresenceDoOutro() {
  if (!contatoAtivo) return;
  const presDoc = doc(db, "users", contatoAtivo);
  presenceUnsub = onSnapshot(presDoc, (snap) => {
    if (snap.exists()) {
      const online = snap.data().online;
      $("presenceBadge").className = `presence ${online ? "online" : "offline"}`;
      $("presenceBadge").innerText = online ? "ON" : "OFF";
    }
  });
}

// ================================
// Inicialização do Chat (somente na chat.html)
// ================================
if (window.location.pathname.includes("chat.html")) {
  if ($("userNome")) {
    $("userNome").innerText = usuario?.usuario || "Sem usuário";

    const q = query(
      collection(db, "chats"),
      where("membros", "array-contains", usuario.usuario)
    );
    onSnapshot(q, renderListaChatsFromSnap);
  }
}

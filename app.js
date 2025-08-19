// ===== Importações Firebase =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore, collection, addDoc, query, where, getDocs, onSnapshot,
  doc, setDoc, orderBy, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// ===== Configuração Firebase =====
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

// ===== Variáveis Globais =====
let usuario = JSON.parse(localStorage.getItem("usuario")) || null;
let chatAtivo = null;              // id do chat (ex: "ana_joao")
let contatoAtivo = null;           // nickname real do outro participante
let apelidos = {};                 // cache: { contatoNickname: "apelido salvo" }

// ===== Helpers de contatos (apelidos) =====
async function salvarContatoAs(ownerUser, contatoNickname, apelido) {
  await setDoc(doc(db, "contacts", ownerUser, "lista", contatoNickname), {
    contato: contatoNickname,
    apelido: apelido
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
    // Atualiza cabeçalho se for o contato ativo
    if (contatoAtivo) {
      const header = document.getElementById("chatAtivoNome");
      if (header) header.innerText = apelidos[contatoAtivo] || contatoAtivo;
    }
    // Atualiza lista visual (re-render simples)
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
      await setDoc(doc(db, "users", usuarioCadastro), {
        nome,
        usuario: usuarioCadastro,
        telefone,
        senha
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

    let userData = null;

    // 1) tenta buscar por usuário
    let q = query(collection(db, "users"), where("usuario", "==", loginInput));
    let resultado = await getDocs(q);

    // 2) se não encontrar, busca por telefone
    if (resultado.empty) {
      q = query(collection(db, "users"), where("telefone", "==", loginInput));
      resultado = await getDocs(q);
    }

    if (!resultado.empty) {
      userData = resultado.docs[0].data();
    }

    if (userData) {
      if (userData.senha === senhaLogin) {
        usuario = userData;
        localStorage.setItem("usuario", JSON.stringify(userData));
        window.location.href = "chat.html";
      } else {
        alert("Senha incorreta.");
      }
    } else {
      alert("Usuário não encontrado.");
    }
  });
}

// ===== Chat (somente nas páginas de chat) =====
const userNome = document.getElementById("userNome");
if (userNome && usuario) {
  userNome.innerText = usuario.usuario;
  // começa a observar os apelidos do usuário logado
  watchApelidos(usuario.usuario);
}

// Botão sair
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("usuario");
    window.location.href = "index.html";
  });
}

// ===== Adicionar amigo/chat =====
const addChatBtn = document.getElementById("addChatBtn");
if (addChatBtn) {
  addChatBtn.addEventListener("click", async () => {
    const entrada = (document.getElementById("novoChatInput").value || "").trim();
    if (!entrada) return;

    if (!usuario) {
      alert("Faça login novamente.");
      return;
    }

    // Descobrir o nickname real do amigo: pode ter digitado nickname OU telefone
    let amigoNickname = null;

    // tenta como usuário
    let r = await getDocs(query(collection(db, "users"), where("usuario", "==", entrada)));
    if (!r.empty) amigoNickname = r.docs[0].data().usuario;

    // se não achou, tenta como telefone
    if (!amigoNickname) {
      r = await getDocs(query(collection(db, "users"), where("telefone", "==", entrada)));
      if (!r.empty) amigoNickname = r.docs[0].data().usuario;
    }

    if (!amigoNickname) {
      alert("Usuário não encontrado pelo apelido/telefone.");
      return;
    }

    if (amigoNickname === usuario.usuario) {
      alert("Você não pode iniciar chat consigo mesmo.");
      return;
    }

    const chatId = [usuario.usuario, amigoNickname].sort().join("_");
    await setDoc(doc(db, "chats", chatId), {
      membros: [usuario.usuario, amigoNickname]
    });

    document.getElementById("novoChatInput").value = "";
  });
}

// ===== Lista de chats (observa com array-contains) =====
const chatList = document.getElementById("chatList");
let unsubscribeChats = null; // para re-render simples
function startChatsWatch() {
  if (!chatList || !usuario) return;

  const q = query(collection(db, "chats"), where("membros", "array-contains", usuario.usuario));
  if (unsubscribeChats) unsubscribeChats(); // limpa ouvinte anterior
  unsubscribeChats = onSnapshot(q, () => {
    renderListaChats();
  });
}

async function renderListaChats() {
  if (!chatList || !usuario) return;

  // Busca novamente para ter os dados
  const q = query(collection(db, "chats"), where("membros", "array-contains", usuario.usuario));
  const snap = await getDocs(q);

  chatList.innerHTML = "";
  snap.docs.forEach((docSnap) => {
    const dados = docSnap.data();
    const amigo = (dados.membros || []).filter(m => m !== usuario.usuario)[0] || "Chat";

    const nomeExibicao = apelidos[amigo] || amigo;

    const li = document.createElement("li");
    li.textContent = nomeExibicao;

    // Abrir chat ao clicar
    li.addEventListener("click", () => {
      chatAtivo = docSnap.id;
      contatoAtivo = amigo; // nickname real do outro
      document.getElementById("chatAtivoNome").innerText = apelidos[amigo] || amigo;
      const saveBtn = document.getElementById("saveContactBtn");
      if (saveBtn) saveBtn.disabled = false;
      carregarMensagens();
    });

    // Renomear contato com botão direito (desktop)
    li.addEventListener("contextmenu", async (e) => {
      e.preventDefault();
      const atual = apelidos[amigo] || amigo;
      const novo = prompt("Salvar contato como:", atual);
      if (novo && novo.trim()) {
        await salvarContatoAs(usuario.usuario, amigo, novo.trim());
      }
    });

    chatList.appendChild(li);
  });
}

// Inicia observação de chats
startChatsWatch();

// ===== “Salvar contato” pelo botão no cabeçalho =====
const saveContactBtn = document.getElementById("saveContactBtn");
if (saveContactBtn) {
  saveContactBtn.addEventListener("click", async () => {
    if (!contatoAtivo || !usuario) return;
    const atual = apelidos[contatoAtivo] || contatoAtivo;
    const novo = prompt("Salvar contato como:", atual);
    if (novo && novo.trim()) {
      await salvarContatoAs(usuario.usuario, contatoAtivo, novo.trim());
    }
  });
}

// ===== Carregar mensagens de um chat =====
let unsubscribeMsgs = null;
function carregarMensagens() {
  if (!chatAtivo) return;

  const messagesContainer = document.getElementById("messagesContainer");
  messagesContainer.innerHTML = "";

  const q = query(collection(db, "chats", chatAtivo, "mensagens"), orderBy("timestamp", "asc"));

  if (unsubscribeMsgs) unsubscribeMsgs();
  unsubscribeMsgs = onSnapshot(q, (snapshot) => {
    messagesContainer.innerHTML = "";
    snapshot.docs.forEach((docSnap) => {
      const msg = docSnap.data();
      const div = document.createElement("div");
      div.classList.add("message");
      if (msg.usuario === usuario.usuario) {
        div.classList.add("bg-me");
      } else {
        div.classList.add("bg-other");
      }
      div.innerText = msg.texto;
      messagesContainer.appendChild(div);
    });
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  });
}

// ===== Enviar mensagem =====
const chatForm = document.getElementById("chatForm");
if (chatForm) {
  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!chatAtivo) {
      alert("Selecione um chat primeiro!");
      return;
    }
    const input = document.getElementById("mensagemInput");
    const texto = (input.value || "").trim();
    if (!texto) return;

    await addDoc(collection(db, "chats", chatAtivo, "mensagens"), {
      usuario: usuario.usuario,
      texto,
      timestamp: new Date()
    });

    input.value = "";
  });
}

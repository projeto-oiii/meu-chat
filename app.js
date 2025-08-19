// Import Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore, collection, addDoc, doc, setDoc, getDoc,
  query, where, getDocs, onSnapshot, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// Configuração Firebase
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

// Armazena o usuário logado
let usuario = JSON.parse(localStorage.getItem("usuario")) || null;
let chatAtivo = null;
let chatAtivoData = null;

// ----------------- LOGIN -----------------
const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const loginInput = document.getElementById("loginInput").value.trim();
    const senha = document.getElementById("senhaLogin").value;

    const q = query(collection(db, "usuarios"), where("senha", "==", senha));
    const snap = await getDocs(q);

    let encontrado = null;
    snap.forEach((doc) => {
      const data = doc.data();
      if (data.usuario === loginInput || data.telefone === loginInput) {
        encontrado = { id: doc.id, ...data };
      }
    });

    if (encontrado) {
      localStorage.setItem("usuario", JSON.stringify(encontrado));
      window.location.href = "chat.html";
    } else {
      alert("Usuário ou senha incorretos!");
    }
  });
}

// ----------------- CADASTRO -----------------
const cadastroForm = document.getElementById("cadastroForm");
if (cadastroForm) {
  cadastroForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nome = document.getElementById("nomeCadastro").value.trim();
    const usuarioCad = document.getElementById("usuarioCadastro").value.trim();
    const telefone = document.getElementById("telefoneCadastro").value.trim();
    const senha = document.getElementById("senhaCadastro").value;

    await addDoc(collection(db, "usuarios"), {
      nome, usuario: usuarioCad, telefone, senha
    });

    alert("Cadastro realizado com sucesso! Faça login.");
    window.location.href = "index.html";
  });
}

// ----------------- CHAT -----------------
const chatList = document.getElementById("chatList");
const userNome = document.getElementById("userNome");
const logoutBtn = document.getElementById("logoutBtn");
const chatForm = document.getElementById("chatForm");
const mensagemInput = document.getElementById("mensagemInput");
const messagesContainer = document.getElementById("messagesContainer");
const chatAtivoNome = document.getElementById("chatAtivoNome");
const saveContactBtn = document.getElementById("saveContactBtn");
const groupInfoBtn = document.getElementById("groupInfoBtn");
const backToChatBtn = document.getElementById("backToChatBtn");

// Exibir nome do usuário logado
if (userNome && usuario) {
  userNome.innerText = usuario.nome || usuario.usuario;
}

// Logout
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("usuario");
    window.location.href = "index.html";
  });
}

// ----------------- LISTAR CHATS -----------------
async function listarChats() {
  if (!chatList || !usuario) return;

  const q = query(collection(db, "chats"));
  onSnapshot(q, async (snapshot) => {
    chatList.innerHTML = "";
    for (const docSnap of snapshot.docs) {
      const dados = docSnap.data();
      if (!dados.membros.includes(usuario.usuario)) continue;

      let nomeExibicao = "";
      if (dados.isGroup) {
        nomeExibicao = dados.nome;
      } else {
        const amigo = dados.membros.find((m) => m !== usuario.usuario);
        nomeExibicao = await getApelido(usuario.usuario, amigo);
      }

      const li = document.createElement("li");
      li.innerText = nomeExibicao;

      li.addEventListener("click", () => {
        chatAtivo = docSnap.id;
        chatAtivoData = dados;
        chatAtivoNome.innerText = nomeExibicao;
        carregarMensagens();

        if (dados.isGroup) {
          saveContactBtn.style.display = "none";
          groupInfoBtn.style.display = "inline-block";
        } else {
          saveContactBtn.style.display = "inline-block";
          groupInfoBtn.style.display = "none";
        }
      });

      chatList.appendChild(li);
    }
  });
}

// ----------------- MENSAGENS -----------------
async function carregarMensagens() {
  if (!chatAtivo) return;
  const q = query(
    collection(db, "chats", chatAtivo, "mensagens"),
    orderBy("timestamp", "asc")
  );

  onSnapshot(q, (snapshot) => {
    messagesContainer.innerHTML = "";
    snapshot.forEach((doc) => {
      const msg = doc.data();
      const div = document.createElement("div");
      div.classList.add("message");
      div.classList.add(msg.de === usuario.usuario ? "bg-me" : "bg-other");
      div.innerText = msg.texto;
      messagesContainer.appendChild(div);
    });
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  });
}

// Enviar mensagem
if (chatForm) {
  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!chatAtivo) return;
    const texto = mensagemInput.value.trim();
    if (!texto) return;

    await addDoc(collection(db, "chats", chatAtivo, "mensagens"), {
      de: usuario.usuario,
      texto,
      timestamp: new Date()
    });
    mensagemInput.value = "";
  });
}

// ----------------- CONTATOS -----------------
async function salvarContato(usuarioAtual, contato, apelido) {
  await setDoc(doc(db, "contacts", usuarioAtual, "lista", contato), {
    contato, apelido
  });
}
async function getApelido(usuarioAtual, contato) {
  const docRef = doc(db, "contacts", usuarioAtual, "lista", contato);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) return docSnap.data().apelido;
  return contato;
}

// Salvar contato com botão
if (saveContactBtn) {
  saveContactBtn.addEventListener("click", async () => {
    if (!chatAtivoData || chatAtivoData.isGroup) return;
    const amigo = chatAtivoData.membros.find((m) => m !== usuario.usuario);
    const apelido = prompt("Salvar contato como:");
    if (apelido) await salvarContato(usuario.usuario, amigo, apelido);
  });
}

// ----------------- ADICIONAR CHAT -----------------
const addChatBtn = document.getElementById("addChatBtn");
if (addChatBtn) {
  addChatBtn.addEventListener("click", async () => {
    const input = document.getElementById("novoChatInput").value.trim();
    if (!input) return;

    const q = query(collection(db, "usuarios"));
    const snap = await getDocs(q);

    let amigo = null;
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.usuario === input || data.telefone === input) {
        amigo = data.usuario;
      }
    });

    if (!amigo) {
      alert("Usuário não encontrado!");
      return;
    }

    await addDoc(collection(db, "chats"), {
      membros: [usuario.usuario, amigo],
      isGroup: false
    });
    document.getElementById("novoChatInput").value = "";
  });
}

// ----------------- GRUPOS -----------------
const openGroupModalBtn = document.getElementById("openGroupModalBtn");
const groupModal = document.getElementById("groupModal");
const closeGroupModalBtn = document.getElementById("closeGroupModalBtn");
const contactsList = document.getElementById("contactsList");
const createGroupBtn = document.getElementById("createGroupBtn");

if (openGroupModalBtn) {
  openGroupModalBtn.addEventListener("click", async () => {
    groupModal.classList.remove("hidden");
    contactsList.innerHTML = "";

    const q = query(collection(db, "contacts", usuario.usuario, "lista"));
    const snap = await getDocs(q);

    snap.forEach((docSnap) => {
      const data = docSnap.data();
      const div = document.createElement("div");
      div.classList.add("contact-item");

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = data.contato;

      const label = document.createElement("label");
      label.innerText = data.apelido || data.contato;

      div.appendChild(checkbox);
      div.appendChild(label);
      contactsList.appendChild(div);
    });
  });
}

if (closeGroupModalBtn) {
  closeGroupModalBtn.addEventListener("click", () => {
    groupModal.classList.add("hidden");
  });
}

if (createGroupBtn) {
  createGroupBtn.addEventListener("click", async () => {
    const nome = document.getElementById("groupNameInput").value.trim();
    const descricao = document.getElementById("groupDescInput").value.trim();
    const selecionados = [
      ...contactsList.querySelectorAll("input:checked")
    ].map((c) => c.value);

    if (!nome || selecionados.length === 0) {
      alert("Preencha os dados e selecione membros!");
      return;
    }

    selecionados.push(usuario.usuario);

    await addDoc(collection(db, "chats"), {
      isGroup: true,
      nome,
      descricao,
      admin: usuario.usuario,
      membros: selecionados,
      criadoEm: new Date()
    });

    groupModal.classList.add("hidden");
    document.getElementById("groupNameInput").value = "";
    document.getElementById("groupDescInput").value = "";
  });
}

// ----------------- INFO DO GRUPO -----------------
if (groupInfoBtn) {
  groupInfoBtn.addEventListener("click", async () => {
    if (!chatAtivoData || !chatAtivoData.isGroup) return;
    document.getElementById("messagesPage").style.display = "none";
    document.getElementById("groupInfoPage").style.display = "block";

    document.getElementById("giNome").innerText = chatAtivoData.nome;
    document.getElementById("giDescricao").innerText = chatAtivoData.descricao;
    document.getElementById("giCriadoEm").innerText =
      "Criado em: " + new Date(chatAtivoData.criadoEm.seconds * 1000).toLocaleString();
    document.getElementById("giAdmin").innerText = "Admin: " + chatAtivoData.admin;

    const giMembros = document.getElementById("giMembros");
    giMembros.innerHTML = "";
    for (let m of chatAtivoData.membros) {
      const li = document.createElement("li");
      li.innerText = m;
      if (m === chatAtivoData.admin) {
        const span = document.createElement("span");
        span.classList.add("admin-badge");
        span.innerText = "ADM";
        li.appendChild(span);
      }
      giMembros.appendChild(li);
    }

    backToChatBtn.style.display = "inline-block";
    groupInfoBtn.style.display = "none";
  });
}

if (backToChatBtn) {
  backToChatBtn.addEventListener("click", () => {
    document.getElementById("messagesPage").style.display = "block";
    document.getElementById("groupInfoPage").style.display = "none";
    backToChatBtn.style.display = "none";
    if (chatAtivoData && chatAtivoData.isGroup) {
      groupInfoBtn.style.display = "inline-block";
    }
  });
}

// ----------------- AUTO -----------------
if (chatList) listarChats();

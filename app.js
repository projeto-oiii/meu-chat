// === Firebase Config ===
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_PROJECT.firebaseapp.com",
  projectId: "SEU_PROJECT_ID",
  storageBucket: "SEU_PROJECT.appspot.com",
  messagingSenderId: "SENDER_ID",
  appId: "APP_ID"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let usuarioLogado = localStorage.getItem("usuarioLogado");
let chatAtual = null;

// === Login ===
const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const usuario = document.getElementById("loginUsuario").value.trim();
    const senha = document.getElementById("loginSenha").value;

    const userDoc = await db.collection("users").doc(usuario).get();
    if (userDoc.exists && userDoc.data().senha === senha) {
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

    const userDoc = await db.collection("users").doc(usuario).get();
    if (userDoc.exists) {
      alert("Usuário já existe!");
    } else {
      await db.collection("users").doc(usuario).set({
        usuario,
        senha,
        criadoEm: new Date()
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
const statusContato = document.getElementById("statusContato");
const typingBox = document.getElementById("typing");

const notifySound = document.getElementById("notifySound");

function playSound() {
  if (notifySound) notifySound.play().catch(() => {});
}

// === Renderizar mensagens ===
function renderMessage(msg, usuario) {
  const div = document.createElement("div");
  div.classList.add("message");
  div.classList.add(msg.de === usuarioLogado ? "bg-me" : "bg-other");

  const body = document.createElement("div");
  body.classList.add("body");
  body.innerText = msg.texto;

  const meta = document.createElement("div");
  meta.classList.add("meta");

  const time = new Date(msg.timestamp?.toDate());
  let timeStr = time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  let status = "";
  if (msg.de === usuarioLogado) {
    if (msg.status === "enviado") status = "✔";
    if (msg.status === "recebido") status = "✔✔";
    if (msg.status === "lido") status = "✔✔";
  }

  meta.innerHTML = `${timeStr} <span style="color:${msg.status==="lido"?"#4fc3f7":"inherit"}">${status}</span>`;

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

  // marcar mensagens como lidas
  const snap = await db.collection("chats").doc(idChat).collection("mensagens").get();
  snap.forEach(doc => {
    const data = doc.data();
    if (data.de !== usuarioLogado && data.status !== "lido") {
      doc.ref.update({ status: "lido" });
    }
  });

  db.collection("chats").doc(idChat).collection("mensagens")
    .orderBy("timestamp")
    .onSnapshot(snapshot => {
      messagesBox.innerHTML = "";
      snapshot.forEach(doc => {
        const msg = doc.data();
        renderMessage(msg, contato);
        if (msg.de !== usuarioLogado && msg.status === "enviado") {
          doc.ref.update({ status: "recebido" });
          playSound();
        }
      });
    });
}

// === Listar Contatos ===
if (listaContatos) {
  db.collection("chats")
    .where("membros", "array-contains", usuarioLogado)
    .onSnapshot(snapshot => {
      listaContatos.innerHTML = "";
      snapshot.forEach(doc => {
        const dados = doc.data();
        const contato = dados.membros.find(m => m !== usuarioLogado);
        const li = document.createElement("li");
        li.innerText = contato;
        li.addEventListener("click", () => abrirChat(doc.id, contato));
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

    await db.collection("chats").doc(chatAtual).collection("mensagens").add({
      de: usuarioLogado,
      texto,
      timestamp: new Date(),
      status: "enviado"
    });

    input.value = "";
  });
}

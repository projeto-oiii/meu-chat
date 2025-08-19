// === Importações Firebase ===
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// === Configuração Firebase ===
const firebaseConfig = {
  apiKey: "SUA_KEY",
  authDomain: "SUA_APP.firebaseapp.com",
  projectId: "SUA_APP",
  storageBucket: "SUA_APP.appspot.com",
  messagingSenderId: "ID",
  appId: "APP_ID"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// === Variáveis globais ===
let usuarioLogado = null;
let chatAtivoId = null;
let unsubscribeMessages = null;

// === Som de notificação ===
const notifySound = document.getElementById("notifySound");

// === Login ===
document.getElementById("loginForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const usuario = document.getElementById("loginInput").value;
  const senha = document.getElementById("senhaLogin").value;

  const userDoc = await getDoc(doc(db, "users", usuario));
  if (userDoc.exists() && userDoc.data().senha === senha) {
    localStorage.setItem("usuario", usuario);
    window.location.href = "chat.html";
  } else {
    alert("Usuário ou senha incorretos");
  }
});

// === Cadastro ===
document.getElementById("cadastroForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const nome = document.getElementById("nomeCadastro").value;
  const usuario = document.getElementById("usuarioCadastro").value;
  const telefone = document.getElementById("telefoneCadastro").value;
  const senha = document.getElementById("senhaCadastro").value;

  await setDoc(doc(db, "users", usuario), { nome, usuario, telefone, senha });
  alert("Cadastro realizado!");
  window.location.href = "index.html";
});

// === Chat ===
if (window.location.pathname.includes("chat.html")) {
  usuarioLogado = localStorage.getItem("usuario");
  if (!usuarioLogado) window.location.href = "index.html";

  document.getElementById("userNome").innerText = usuarioLogado;

  document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.removeItem("usuario");
    window.location.href = "index.html";
  });

  // Adicionar contato
  document.getElementById("addChatBtn").addEventListener("click", async () => {
    const contato = document.getElementById("novoChatInput").value.trim();
    if (!contato) return;

    const chatId = [usuarioLogado, contato].sort().join("_");
    await setDoc(doc(db, "chats", chatId), {
      membros: [usuarioLogado, contato],
      criadoEm: serverTimestamp()
    }, { merge: true });

    carregarChats();
    document.getElementById("novoChatInput").value = "";
  });

  // Carregar chats
  async function carregarChats() {
    const chatList = document.getElementById("chatList");
    chatList.innerHTML = "";

    const q = query(collection(db, "chats"), orderBy("criadoEm", "desc"));
    onSnapshot(q, (snapshot) => {
      chatList.innerHTML = "";
      snapshot.forEach((docSnap) => {
        const chat = docSnap.data();
        if (chat.membros.includes(usuarioLogado)) {
          const li = document.createElement("li");
          li.textContent = chat.membros.find(u => u !== usuarioLogado);
          li.addEventListener("click", () => abrirChat(docSnap.id, li.textContent));
          chatList.appendChild(li);
        }
      });
    });
  }

  carregarChats();

  // Abrir chat
  function abrirChat(chatId, contato) {
    chatAtivoId = chatId;
    document.getElementById("chatAtivoNome").innerText = contato;

    if (unsubscribeMessages) unsubscribeMessages();

    const q = query(collection(db, "chats", chatId, "mensagens"), orderBy("criadoEm", "asc"));
    unsubscribeMessages = onSnapshot(q, (snapshot) => {
      const container = document.getElementById("messagesContainer");
      container.innerHTML = "";
      snapshot.forEach((msgSnap) => {
        const msg = msgSnap.data();
        const div = document.createElement("div");
        div.classList.add("message");
        div.classList.add(msg.remetente === usuarioLogado ? "bg-me" : "bg-other");
        div.innerHTML = `
          ${msg.texto}
          <div class="meta">${msg.criadoEm?.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
        `;
        container.appendChild(div);

        // 🔊 Toca som se for mensagem recebida
        if (msg.remetente !== usuarioLogado) {
          notifySound.currentTime = 0;
          notifySound.play();
        }
      });
      container.scrollTop = container.scrollHeight;
    });
  }

  // Enviar mensagem
  document.getElementById("chatForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const texto = document.getElementById("mensagemInput").value.trim();
    if (!texto || !chatAtivoId) return;

    await addDoc(collection(db, "chats", chatAtivoId, "mensagens"), {
      texto,
      remetente: usuarioLogado,
      criadoEm: serverTimestamp()
    });

    document.getElementById("mensagemInput").value = "";
  });
}

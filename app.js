// Import Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, query, where, getDocs, onSnapshot, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Configuração Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDFvYgca0_HRX0m_RSER0RgQ3LZDa6kaJ8",
  authDomain: "meu-chat-71046.firebaseapp.com",
  projectId: "meu-chat-71046",
  storageBucket: "meu-chat-71046.firebasestorage.app",
  messagingSenderId: "268291748548",
  appId: "1:268291748548:web:4001f2e4002d7f0eeb8f91"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let currentChatId = null;

// ---------------- CADASTRO ----------------
async function cadastrar() {
  const nome = document.getElementById("cadastroNome").value;
  const usuario = document.getElementById("cadastroUsuario").value;
  const telefone = document.getElementById("cadastroTelefone").value;
  const email = document.getElementById("cadastroEmail").value;
  const senha = document.getElementById("cadastroSenha").value;

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
    await updateProfile(userCredential.user, { displayName: usuario });

    await setDoc(doc(db, "users", userCredential.user.uid), {
      nome,
      usuario,
      telefone,
      email
    });

    alert("Cadastro realizado com sucesso!");
    window.location.href = "index.html";
  } catch (error) {
    alert("Erro ao cadastrar: " + error.message);
  }
}
window.cadastrar = cadastrar;

// ---------------- LOGIN ----------------
async function login() {
  const loginInput = document.getElementById("loginInput").value;
  const senha = document.getElementById("loginSenha").value;

  try {
    // verificar se login é email ou nickname/telefone
    if (loginInput.includes("@")) {
      await signInWithEmailAndPassword(auth, loginInput, senha);
    } else {
      const q = query(collection(db, "users"),
        where("usuario", "==", loginInput) || where("telefone", "==", loginInput));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const userData = querySnapshot.docs[0].data();
        await signInWithEmailAndPassword(auth, userData.email, senha);
      } else {
        alert("Usuário não encontrado.");
      }
    }
    window.location.href = "chat.html";
  } catch (error) {
    alert("Erro no login: " + error.message);
  }
}
window.login = login;

// ---------------- LOGOUT ----------------
function logout() {
  signOut(auth).then(() => {
    window.location.href = "index.html";
  });
}
window.logout = logout;

// ---------------- LISTENER LOGIN ----------------
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    const userName = user.displayName || user.email || "Usuário";
    const currentUserNameEl = document.getElementById("currentUserName");
    if (currentUserNameEl) currentUserNameEl.innerText = userName;

    try {
      carregarChats();
    } catch (err) {
      console.error("Erro ao carregar chats:", err);
      const chatList = document.getElementById("chatList");
      if (chatList) chatList.innerHTML = "<p style='padding:10px'>Nenhum chat encontrado.</p>";
    }
  } else {
    if (!window.location.href.includes("index.html") && !window.location.href.includes("cadastro.html")) {
      window.location.href = "index.html";
    }
  }
});

// ---------------- ADICIONAR AMIGO ----------------
async function adicionarAmigo() {
  const amigoInput = document.getElementById("amigoInput").value.trim();
  if (!amigoInput) return;

  const q1 = query(collection(db, "users"), where("usuario", "==", amigoInput));
  const q2 = query(collection(db, "users"), where("telefone", "==", amigoInput));
  let querySnapshot = await getDocs(q1);

  if (querySnapshot.empty) {
    querySnapshot = await getDocs(q2);
  }

  if (!querySnapshot.empty) {
    const amigoData = querySnapshot.docs[0].data();
    const amigoId = querySnapshot.docs[0].id;

    // Criar chat entre os dois
    await addDoc(collection(db, "chats"), {
      membros: [currentUser.uid, amigoId],
      criadoEm: serverTimestamp()
    });
    alert("Contato adicionado!");
  } else {
    alert("Usuário não encontrado.");
  }
}
window.adicionarAmigo = adicionarAmigo;

// ---------------- CARREGAR CHATS ----------------
function carregarChats() {
  const chatList = document.getElementById("chatList");
  if (!chatList) return;

  const q = query(collection(db, "chats"));
  onSnapshot(q, (snapshot) => {
    chatList.innerHTML = "";
    snapshot.forEach((docSnap) => {
      const chat = docSnap.data();
      if (chat.membros.includes(currentUser.uid)) {
        const div = document.createElement("div");
        div.innerText = "Chat";
        div.onclick = () => abrirChat(docSnap.id);
        chatList.appendChild(div);
      }
    });
  });
}

// ---------------- ABRIR CHAT ----------------
function abrirChat(chatId) {
  currentChatId = chatId;
  const chatHeader = document.getElementById("chatHeader");
  const messagesDiv = document.getElementById("messages");
  chatHeader.innerText = "Chat Ativo";
  messagesDiv.innerHTML = "";

  const q = query(collection(db, "chats", chatId, "mensagens"), orderBy("timestamp", "asc"));
  onSnapshot(q, (snapshot) => {
    messagesDiv.innerHTML = "";
    snapshot.forEach((docSnap) => {
      const msg = docSnap.data();
      const div = document.createElement("div");
      div.classList.add("message");
      div.classList.add(msg.remetente === currentUser.uid ? "sent" : "received");
      div.innerText = msg.texto;
      messagesDiv.appendChild(div);
    });
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  });
}
window.abrirChat = abrirChat;

// ---------------- ENVIAR MENSAGEM ----------------
async function enviarMensagem() {
  if (!currentChatId) return;
  const input = document.getElementById("messageInput");
  const texto = input.value.trim();
  if (!texto) return;

  await addDoc(collection(db, "chats", currentChatId, "mensagens"), {
    remetente: currentUser.uid,
    texto,
    timestamp: serverTimestamp()
  });
  input.value = "";
}
window.enviarMensagem = enviarMensagem;

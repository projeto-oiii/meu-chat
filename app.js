// Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import {
  getFirestore, collection, addDoc, query, where, getDocs,
  orderBy, onSnapshot, doc, getDoc
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import {
  getAuth, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

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
const auth = getAuth(app);

// Referências
const chatList = document.getElementById("chatList");
const chatMessages = document.getElementById("chatMessages");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const logoutBtn = document.getElementById("logoutBtn");
const chatHeader = document.getElementById("chatHeader");

// Popup
const popup = document.getElementById("groupInfoPopup");
const closePopup = document.getElementById("closePopup");

// Usuário logado
let currentUser = null;
let currentChatId = null;

// Autenticação
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    document.getElementById("currentUserName").innerText = user.email;
    carregarChats();
  } else {
    window.location.href = "index.html";
  }
});

// Logout
logoutBtn.addEventListener("click", () => {
  signOut(auth);
});

// Carregar lista de chats
async function carregarChats() {
  const q = query(collection(db, "chats"));
  const querySnapshot = await getDocs(q);
  chatList.innerHTML = "";
  querySnapshot.forEach((docSnap) => {
    const chat = docSnap.data();
    const div = document.createElement("div");
    div.textContent = chat.nome;
    div.onclick = () => abrirChat(docSnap.id, chat);
    chatList.appendChild(div);
  });
}

// Abrir chat
function abrirChat(chatId, chatData) {
  currentChatId = chatId;
  document.getElementById("chatName").textContent = chatData.nome;
  document.getElementById("chatDescription").textContent = chatData.descricao || "";
  document.getElementById("chatPhoto").src = chatData.foto || "default-group.png";

  // Ao clicar no header, abre popup de info do grupo
  chatHeader.onclick = () => abrirPopup(chatId);

  // Carregar mensagens em tempo real
  const q = query(collection(db, "chats", chatId, "mensagens"), orderBy("timestamp"));
  onSnapshot(q, (snapshot) => {
    chatMessages.innerHTML = "";
    snapshot.forEach((doc) => {
      const msg = doc.data();
      const div = document.createElement("div");
      div.classList.add("message");
      div.classList.add(msg.remetente === currentUser.uid ? "sent" : "received");
      div.textContent = msg.texto;
      chatMessages.appendChild(div);
    });
    chatMessages.scrollTop = chatMessages.scrollHeight;
  });
}

// Enviar mensagem
sendBtn.addEventListener("click", async () => {
  if (!messageInput.value.trim() || !currentChatId) return;
  await addDoc(collection(db, "chats", currentChatId, "mensagens"), {
    remetente: currentUser.uid,
    texto: messageInput.value,
    timestamp: new Date()
  });
  messageInput.value = "";
});

// Abrir popup de informações do grupo
async function abrirPopup(chatId) {
  const chatDoc = await getDoc(doc(db, "chats", chatId));
  if (chatDoc.exists()) {
    const chatData = chatDoc.data();

    document.getElementById("groupName").textContent = chatData.nome;
    document.getElementById("groupDescription").textContent = chatData.descricao || "Sem descrição";
    document.getElementById("groupPhoto").src = chatData.foto || "default-group.png";
    document.getElementById("groupCreatedAt").textContent = chatData.criadoEm || "Desconhecido";
    document.getElementById("groupAdmin").textContent = chatData.admin || "Sem adm";

    // Listar participantes
    const membersList = document.getElementById("groupMembers");
    membersList.innerHTML = "";
    if (chatData.membros && Array.isArray(chatData.membros)) {
      chatData.membros.forEach(m => {
        const li = document.createElement("li");
        li.textContent = m;
        membersList.appendChild(li);
      });
    }

    popup.style.display = "flex";
  }
}

// Fechar popup
closePopup.addEventListener("click", () => {
  popup.style.display = "none";
});

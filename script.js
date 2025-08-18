// Firebase (somente Firestore; sem Auth/Storage para manter 100% grátis)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getFirestore, collection, addDoc, setDoc, doc, onSnapshot, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// -> Substitua por suas credenciais se forem diferentes
const firebaseConfig = {
  apiKey: "AIzaSyDFvYgca0_HRX0m_RSER0RgQ3LZDa6kaJ8",
  authDomain: "meu-chat-71046.firebaseapp.com",
  projectId: "meu-chat-71046",
  storageBucket: "meu-chat-71046.appspot.com",
  messagingSenderId: "268291748548",
  appId: "1:268291748548:web:4001f2e4002d7f0eeb8f91"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let currentUser = null;
let currentChat = null;      // id do usuário ou do grupo
let currentChatType = null;  // "user" | "room"

// Login simples por nome (o doc do usuário é criado automaticamente).
document.getElementById("loginBtn").addEventListener("click", async () => {
  const username = document.getElementById("username").value.trim();
  if (!username) return alert("Digite um nome");
  currentUser = username;

  // Cria/atualiza doc do usuário (id = nome)
  await setDoc(doc(db, "users", username), { name: username, updatedAt: serverTimestamp() }, { merge: true });

  // UI
  document.getElementById("login-container").classList.add("hidden");
  document.getElementById("chat-container").classList.remove("hidden");

  carregarUsuarios();
  carregarRooms();
});

// Lista de usuários (exceto eu)
function carregarUsuarios() {
  const userList = document.getElementById("user-list");
  onSnapshot(collection(db, "users"), (snapshot) => {
    userList.innerHTML = "";
    snapshot.forEach((d) => {
      if (d.id !== currentUser) {
        const li = document.createElement("li");
        li.textContent = d.data().name || d.id;
        li.onclick = () => abrirChat(d.id, "user");
        userList.appendChild(li);
      }
    });
  });
}

// Lista de grupos
function carregarRooms() {
  const roomList = document.getElementById("room-list");
  onSnapshot(collection(db, "rooms"), (snapshot) => {
    roomList.innerHTML = "";
    snapshot.forEach((d) => {
      const li = document.createElement("li");
      li.textContent = d.id;
      li.onclick = () => abrirChat(d.id, "room");
      roomList.appendChild(li);
    });
  });
}

// Criar novo grupo
document.getElementById("createRoomBtn").addEventListener("click", async () => {
  const roomName = document.getElementById("newRoom").value.trim();
  if (!roomName) return;
  await setDoc(doc(db, "rooms", roomName), { createdBy: currentUser, createdAt: serverTimestamp() }, { merge: true });
  document.getElementById("newRoom").value = "";
});

// Abrir conversa
function abrirChat(id, type) {
  currentChat = id;
  currentChatType = type;
  document.getElementById("chat-title").textContent = (type === "user" ? "Chat com " : "Grupo: ") + id;
  carregarMensagens();
}

// Enviar mensagem
document.getElementById("sendBtn").addEventListener("click", async () => {
  const input = document.getElementById("messageInput");
  const text = input.value.trim();
  if (!text || !currentChat) return;

  const path = (currentChatType === "user")
    ? `chats/${[currentUser, currentChat].sort().join("_")}/messages`
    : `rooms/${currentChat}/messages`;

  await addDoc(collection(db, path), {
    sender: currentUser,
    text,
    createdAt: serverTimestamp()
  });

  input.value = "";
});

// Carregar mensagens em tempo real
let unsubscribe = null;
function carregarMensagens() {
  if (!currentChat) return;
  if (unsubscribe) unsubscribe();

  const path = (currentChatType === "user")
    ? `chats/${[currentUser, currentChat].sort().join("_")}/messages`
    : `rooms/${currentChat}/messages`;

  const q = query(collection(db, path), orderBy("createdAt"));
  unsubscribe = onSnapshot(q, (snap) => {
    const messagesDiv = document.getElementById("messages");
    messagesDiv.innerHTML = "";
    snap.forEach((docu) => {
      const m = docu.data();
      const div = document.createElement("div");
      div.classList.add("message");
      div.classList.add(m.sender === currentUser ? "me" : "other");
      div.textContent = `${m.sender}: ${m.text}`;
      messagesDiv.appendChild(div);
    });
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  });
}

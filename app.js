import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, setDoc, getDocs, query, where, doc, updateDoc, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

let currentUser = localStorage.getItem("user");
let currentChat = null;

if (document.getElementById("currentUser")) {
  document.getElementById("currentUser").innerText = currentUser;
}

// =============== CADASTRO ===============
if (document.getElementById("cadastroBtn")) {
  document.getElementById("cadastroBtn").addEventListener("click", async () => {
    const nome = document.getElementById("nome").value.trim();
    const nickname = document.getElementById("nickname").value.trim();
    const telefone = document.getElementById("telefone").value.trim();
    const senha = document.getElementById("senha").value.trim();

    if (!nome || !nickname || !telefone || !senha) {
      alert("Preencha todos os campos!");
      return;
    }

    const usersRef = collection(db, "users");

    await setDoc(doc(usersRef, nickname), {
      nome,
      nickname,
      telefone,
      senha
    });

    alert("Cadastro realizado! Faça login.");
    window.location.href = "index.html";
  });
}

// =============== LOGIN ===============
if (document.getElementById("loginBtn")) {
  document.getElementById("loginBtn").addEventListener("click", async () => {
    const user = document.getElementById("loginUser").value.trim();
    const pass = document.getElementById("loginPass").value.trim();

    const usersRef = collection(db, "users");
    const q = query(usersRef, where("senha", "==", pass));
    const querySnap = await getDocs(q);

    let found = false;
    querySnap.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.nickname === user || data.telefone === user) {
        localStorage.setItem("user", data.nickname);
        found = true;
        window.location.href = "chat.html";
      }
    });

    if (!found) {
      alert("Usuário ou senha inválidos.");
    }
  });
}

// =============== LOGOUT ===============
if (document.getElementById("logoutBtn")) {
  document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.removeItem("user");
    window.location.href = "index.html";
  });
}

// =============== CHAT ===============
if (document.getElementById("sendBtn")) {
  document.getElementById("sendBtn").addEventListener("click", async () => {
    const input = document.getElementById("messageInput");
    const text = input.value.trim();
    if (!text || !currentChat) return;

    const msgRef = collection(db, "chats", currentChat, "messages");
    const newMsg = {
      sender: currentUser,
      text,
      timestamp: new Date(),
      status: "sending"
    };

    const docRef = await addDoc(msgRef, newMsg);
    await updateDoc(docRef, { status: "sent" });
    input.value = "";
  });
}

function loadMessages(chatId) {
  const messagesDiv = document.getElementById("messages");
  messagesDiv.innerHTML = "";

  const q = query(collection(db, "chats", chatId, "messages"), orderBy("timestamp", "asc"));
  onSnapshot(q, async (snapshot) => {
    messagesDiv.innerHTML = "";
    let lastDate = "";

    for (const docSnap of snapshot.docs) {
      const msg = docSnap.data();
      const msgDate = new Date(msg.timestamp.seconds * 1000);
      const dateString = msgDate.toLocaleDateString();

      // separador de data
      if (dateString !== lastDate) {
        const dateSep = document.createElement("div");
        dateSep.classList.add("date-separator");

        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);

        if (dateString === today.toLocaleDateString()) {
          dateSep.innerText = "Hoje";
        } else if (dateString === yesterday.toLocaleDateString()) {
          dateSep.innerText = "Ontem";
        } else {
          dateSep.innerText = dateString;
        }

        messagesDiv.appendChild(dateSep);
        lastDate = dateString;
      }

      // atualizar status
      if (msg.sender !== currentUser) {
        if (msg.status === "sent") {
          await updateDoc(docSnap.ref, { status: "delivered" });
        }
        if (document.hasFocus()) {
          await updateDoc(docSnap.ref, { status: "read" });
        }
      }

      const div = document.createElement("div");
      div.classList.add("message");
      div.classList.add(msg.sender === currentUser ? "sent" : "received");

      const time = msgDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

      div.innerHTML = `
        <span>${msg.text}</span>
        <div class="time-status">
          ${time}
          ${msg.sender === currentUser ? `<span class="status ${msg.status}"></span>` : ""}
        </div>
      `;

      messagesDiv.appendChild(div);
    }

    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  });
}

async function loadContacts() {
  const contactsList = document.getElementById("contactsList");
  if (!contactsList) return;
  contactsList.innerHTML = "";

  const q = query(collection(db, "chats"));
  const snapshot = await getDocs(q);

  snapshot.forEach((docSnap) => {
    const li = document.createElement("li");
    li.innerText = docSnap.id;
    li.addEventListener("click", () => {
      currentChat = docSnap.id;
      document.getElementById("chatWith").innerText = "Chat: " + docSnap.id;
      loadMessages(currentChat);
    });
    contactsList.appendChild(li);
  });
}

if (document.getElementById("contactsList")) {
  loadContacts();
}

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, addDoc, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDFvYgca0_HRX0m_RSER0RgQ3LZDa6kaJ8",
  authDomain: "meu-chat-71046.firebaseapp.com",
  projectId: "meu-chat-71046",
  storageBucket: "meu-chat-71046.firebasestorage.app",
  messagingSenderId: "268291748548",
  appId: "1:268291748548:web:4001f2e4002d7f0eeb8f91"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let currentChat = null;

// Cadastro
const cadastroForm = document.getElementById("cadastroForm");
if (cadastroForm) {
  cadastroForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nome = document.getElementById("nome").value;
    const usuario = document.getElementById("usuario").value;
    const telefone = document.getElementById("telefone").value;
    const senha = document.getElementById("senha").value;

    const emailFake = telefone + "@meuchat.com";
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, emailFake, senha);
      await setDoc(doc(db, "users", userCredential.user.uid), {
        nome,
        usuario,
        telefone,
        contacts: []
      });
      alert("Usuário cadastrado com sucesso!");
      window.location.href = "index.html";
    } catch (error) {
      alert("Erro: " + error.message);
    }
  });
}

// Login
const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const loginUser = document.getElementById("loginUser").value;
    const senha = document.getElementById("loginPassword").value;
    const emailFake = loginUser + "@meuchat.com";

    try {
      const userCredential = await signInWithEmailAndPassword(auth, emailFake, senha);
      currentUser = userCredential.user.uid;
      window.location.href = "chat.html";
    } catch (error) {
      alert("Erro: " + error.message);
    }
  });
}

// Chat
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "index.html";
  });
}

async function loadContacts() {
  const contactsList = document.getElementById("contactsList");
  if (!contactsList) return;
  contactsList.innerHTML = "";

  const userRef = doc(db, "users", auth.currentUser.uid);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    const data = userSnap.data();
    const contacts = data.contacts || [];

    contacts.forEach((contactId) => {
      const li = document.createElement("li");
      li.innerText = contactId;
      li.addEventListener("click", () => {
        currentChat = [auth.currentUser.uid, contactId].sort().join("_");
        document.getElementById("chatWith").innerText = "Chat: " + contactId;
        loadMessages(currentChat);
      });
      contactsList.appendChild(li);
    });
  }
}

const messageForm = document.getElementById("messageForm");
if (messageForm) {
  messageForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = document.getElementById("messageInput");
    const text = input.value.trim();
    if (!text || !currentChat) return;

    const msgRef = await addDoc(collection(db, "chats", currentChat, "mensagens"), {
      sender: auth.currentUser.uid,
      text,
      timestamp: new Date(),
      status: "sent"
    });
    input.value = "";
  });
}

async function loadMessages(chatId) {
  const messagesDiv = document.getElementById("messages");
  messagesDiv.innerHTML = "";

  const q = query(collection(db, "chats", chatId, "mensagens"), orderBy("timestamp"));
  onSnapshot(q, async (snapshot) => {
    messagesDiv.innerHTML = "";
    let lastDate = "";

    for (const docSnap of snapshot.docs) {
      const msg = docSnap.data();
      const date = new Date(msg.timestamp.seconds * 1000);
      const dateStr = date.toLocaleDateString();

      if (dateStr !== lastDate) {
        const sep = document.createElement("div");
        sep.className = "date-separator";
        sep.innerText = dateStr;
        messagesDiv.appendChild(sep);
        lastDate = dateStr;
      }

      const div = document.createElement("div");
      div.className = "message " + (msg.sender === auth.currentUser.uid ? "sent" : "received");
      div.innerHTML = `
        <span>${msg.text}</span>
        <span class="time">${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} ${getStatusSymbol(msg.status)}</span>
      `;
      messagesDiv.appendChild(div);

      // Atualiza status para delivered
      if (msg.sender !== auth.currentUser.uid && msg.status === "sent") {
        await updateDoc(doc(db, "chats", chatId, "mensagens", docSnap.id), { status: "delivered" });
      }

      // Atualiza status para read quando abre chat
      if (msg.sender !== auth.currentUser.uid && msg.status !== "read") {
        await updateDoc(doc(db, "chats", chatId, "mensagens", docSnap.id), { status: "read" });
      }
    }
  });
}

function getStatusSymbol(status) {
  switch (status) {
    case "pending": return "⏳";
    case "sent": return "✓";
    case "delivered": return "✓✓";
    case "read": return "✓✓ azul";
    default: return "";
  }
}

if (window.location.pathname.endsWith("chat.html")) {
  auth.onAuthStateChanged((user) => {
    if (user) {
      currentUser = user.uid;
      loadContacts();
    } else {
      window.location.href = "index.html";
    }
  });
}

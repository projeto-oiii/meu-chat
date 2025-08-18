// Import Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, getDocs, addDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Config Firebase
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "meu-chat-71046.firebaseapp.com",
  projectId: "meu-chat-71046",
  storageBucket: "meu-chat-71046.appspot.com",
  messagingSenderId: "637408192765",
  appId: "1:637408192765:web:1cf46321e1d0709dc688fe"
};

// Inicializar
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Funções de tela (login ↔ cadastro)
window.showRegister = () => {
  document.getElementById("loginDiv").style.display = "none";
  document.getElementById("registerDiv").style.display = "block";
};
window.showLogin = () => {
  document.getElementById("loginDiv").style.display = "block";
  document.getElementById("registerDiv").style.display = "none";
};

// Botões de login/cadastro
document.getElementById("registerBtn")?.addEventListener("click", async () => {
  const email = document.getElementById("registerEmail").value;
  const senha = document.getElementById("registerPassword").value;
  try {
    await createUserWithEmailAndPassword(auth, email, senha);
    alert("Cadastro realizado! Agora faça login.");
    showLogin();
  } catch (e) {
    alert("Erro: " + e.message);
  }
});

document.getElementById("loginBtn")?.addEventListener("click", async () => {
  const email = document.getElementById("loginEmail").value;
  const senha = document.getElementById("loginPassword").value;
  try {
    await signInWithEmailAndPassword(auth, email, senha);
    window.location = "chat.html"; // Redireciona
  } catch (e) {
    alert("Erro: " + e.message);
  }
});

// Logout
document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  await signOut(auth);
  window.location = "index.html";
});

// Garantir que só logado acessa o chat
onAuthStateChanged(auth, (user) => {
  if (window.location.pathname.includes("chat.html") && !user) {
    window.location = "index.html"; // se não logado, volta pro login
  }
});

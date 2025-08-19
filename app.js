// Import Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDocs, collection, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

// ---------------- CADASTRO ----------------
async function cadastrar(nome, usuario, telefone, senha) {
  try {
    // Criar conta com email "fake" baseado no telefone (já que você não usa email real)
    const emailFake = telefone + "@meuchat.com";

    const userCredential = await createUserWithEmailAndPassword(auth, emailFake, senha);
    await updateProfile(userCredential.user, { displayName: usuario });

    await setDoc(doc(db, "users", userCredential.user.uid), {
      nome,
      usuario,
      telefone
    });

    alert("Cadastro realizado com sucesso! Faça login.");
    window.location.href = "index.html";
  } catch (error) {
    alert("Erro ao cadastrar: " + error.message);
  }
}

// ---------------- LOGIN ----------------
async function login(loginInput, senha) {
  try {
    let emailLogin = null;

    // Verifica se o login é telefone ou usuário
    const q1 = query(collection(db, "users"), where("usuario", "==", loginInput));
    const q2 = query(collection(db, "users"), where("telefone", "==", loginInput));
    let querySnapshot = await getDocs(q1);

    if (querySnapshot.empty) {
      querySnapshot = await getDocs(q2);
    }

    if (!querySnapshot.empty) {
      const userData = querySnapshot.docs[0].data();
      emailLogin = userData.telefone + "@meuchat.com"; // mesmo padrão do cadastro
    } else {
      alert("Usuário não encontrado.");
      return;
    }

    await signInWithEmailAndPassword(auth, emailLogin, senha);
    window.location.href = "chat.html";
  } catch (error) {
    alert("Erro no login: " + error.message);
  }
}

// ---------------- EVENTOS FORM ----------------
document.addEventListener("DOMContentLoaded", () => {
  const cadastroForm = document.getElementById("cadastroForm");
  if (cadastroForm) {
    cadastroForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const nome = document.getElementById("nomeCadastro").value;
      const usuario = document.getElementById("usuarioCadastro").value;
      const telefone = document.getElementById("telefoneCadastro").value;
      const senha = document.getElementById("senhaCadastro").value;
      cadastrar(nome, usuario, telefone, senha);
    });
  }

  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const loginInput = document.getElementById("loginInput").value;
      const senha = document.getElementById("senhaLogin").value;
      login(loginInput, senha);
    });
  }
});

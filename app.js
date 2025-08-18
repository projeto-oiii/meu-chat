// app.js

// Importando Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, query, where, collection, getDocs } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// 🔑 CONFIGURAÇÃO DO FIREBASE (copie exatamente como aparece no seu console Firebase)
const firebaseConfig = {
  apiKey: "AIzaSyDFvYgca0_HRX0m_RSER0RgQ3LZDa6kaJ8",
  authDomain: "meu-chat-71046.firebaseapp.com",
  projectId: "meu-chat-71046",
  storageBucket: "meu-chat-71046.firebasestorage.app",
  messagingSenderId: "268291748548",
  appId: "1:268291748548:web:4001f2e4002d7f0eeb8f91"
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Função de cadastro
export async function cadastrarUsuario(nome, usuario, telefone) {
  try {
    const userRef = doc(db, "users", usuario);
    await setDoc(userRef, {
      nome: nome,
      usuario: usuario,
      telefone: telefone
    });
    alert("Usuário cadastrado com sucesso!");
    window.location.href = "index.html"; // volta para login
  } catch (error) {
    alert("Erro ao cadastrar: " + error.message);
  }
}

// Função de login
export async function loginUsuario(entrada) {
  try {
    // Procura por nome de usuário
    const userDoc = await getDoc(doc(db, "users", entrada));

    if (userDoc.exists()) {
      localStorage.setItem("usuarioLogado", JSON.stringify(userDoc.data()));
      window.location.href = "chat.html";
      return;
    }

    // Se não for usuário, procura por telefone
    const q = query(collection(db, "users"), where("telefone", "==", entrada));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      querySnapshot.forEach((docSnap) => {
        localStorage.setItem("usuarioLogado", JSON.stringify(docSnap.data()));
      });
      window.location.href = "chat.html";
      return;
    }

    alert("Usuário ou telefone não encontrado!");
  } catch (error) {
    alert("Erro no login: " + error.message);
  }
}

// app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } 
  from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, setDoc, doc, getDocs, collection, query, where } 
  from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 🔹 Sua configuração do Firebase (copiar do console Firebase)
const firebaseConfig = {
  apiKey: "SUA_API_KEY_AQUI",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  projectId: "SEU_PROJETO",
  storageBucket: "SEU_PROJETO.appspot.com",
  messagingSenderId: "XXXXXXX",
  appId: "XXXXXXXX"
};

// Inicializa
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ---------------- CADASTRO ----------------
window.cadastrar = async function() {
  const nome = document.getElementById("nome").value;
  const usuario = document.getElementById("usuario").value;
  const telefone = document.getElementById("telefone").value;
  const senha = document.getElementById("senha").value;

  // Criar um "email falso" baseado no telefone (Firebase exige email)
  const emailFake = telefone + "@meuchat.com";

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, emailFake, senha);
    const user = userCredential.user;

    // Salvar no Firestore
    await setDoc(doc(db, "usuarios", user.uid), {
      nome,
      usuario,
      telefone
    });

    alert("Cadastro realizado com sucesso!");
    window.location.href = "index.html";

  } catch (error) {
    alert("Erro ao cadastrar: " + error.message);
  }
};

// ---------------- LOGIN ----------------
window.login = async function() {
  const login = document.getElementById("login").value;
  const senha = document.getElementById("senhaLogin").value;

  try {
    let emailFake = "";

    // 🔎 Primeiro vamos ver se login é telefone ou usuário
    if (/^\d+$/.test(login)) {
      // só números → telefone
      emailFake = login + "@meuchat.com";
    } else {
      // Se for usuário, precisamos buscar no Firestore o telefone correspondente
      const q = query(collection(db, "usuarios"), where("usuario", "==", login));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        alert("Usuário não encontrado!");
        return;
      }

      const dados = snapshot.docs[0].data();
      emailFake = dados.telefone + "@meuchat.com";
    }

    // Login com Firebase Auth
    await signInWithEmailAndPassword(auth, emailFake, senha);
    alert("Login realizado com sucesso!");
    window.location.href = "chat.html";

  } catch (error) {
    alert("Erro no login: " + error.message);
  }
};

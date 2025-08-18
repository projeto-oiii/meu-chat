// Configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDFvYgca0_HRX0m_RSER0RgQ3LZDa6kaJ8",
  authDomain: "meu-chat-71046.firebaseapp.com",
  projectId: "meu-chat-71046",
  storageBucket: "meu-chat-71046.firebasestorage.app",
  messagingSenderId: "268291748548",
  appId: "1:268291748548:web:4001f2e4002d7f0eeb8f91"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Função de Login
function login() {
  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;

  auth.signInWithEmailAndPassword(email, password)
    .then(() => {
      alert("Login realizado com sucesso!");
      window.location.href = "chat.html";
    })
    .catch(error => {
      alert("Erro no login: " + error.message);
    });
}

// Função de Cadastro
function cadastro() {
  const nome = document.getElementById("nome").value;
  const usuario = document.getElementById("usuario").value;
  const telefone = document.getElementById("telefone").value;
  const email = document.getElementById("cadastroEmail").value;
  const senha = document.getElementById("cadastroPassword").value;

  auth.createUserWithEmailAndPassword(email, senha)
    .then(cred => {
      return db.collection("users").doc(cred.user.uid).set({
        nome: nome,
        usuario: usuario,
        telefone: telefone,
        email: email
      });
    })
    .then(() => {
      alert("Cadastro realizado com sucesso!");
      window.location.href = "index.html";
    })
    .catch(error => {
      alert("Erro no cadastro: " + error.message);
    });
}

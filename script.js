// ======================
// Configuração do Firebase
// ======================
const firebaseConfig = {
  apiKey: "AIzaSyDFvYgca0_HRX0m_RSER0RgQ3LZDa6kaJ8",
  authDomain: "meu-chat-71046.firebaseapp.com",
  projectId: "meu-chat-71046",
  storageBucket: "meu-chat-71046.firebasestorage.app",
  messagingSenderId: "268291748548",
  appId: "1:268291748548:web:4001f2e4002d7f0eeb8f91"
};

// Inicializa o Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ======================
// Lógica de Login e Cadastro
// ======================
document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("login-form");
  const signupForm = document.getElementById("signup-form");

  if (loginForm) {
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = document.getElementById("login-email").value;
      const password = document.getElementById("login-password").value;

      auth.signInWithEmailAndPassword(email, password)
        .then(() => {
          // Redireciona para o chat
          window.location.href = "chat.html";
        })
        .catch((error) => {
          alert("Erro no login: " + error.message);
        });
    });
  }

  if (signupForm) {
    signupForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = document.getElementById("signup-email").value;
      const password = document.getElementById("signup-password").value;

      auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
          const user = userCredential.user;
          // Salva no Firestore
          return db.collection("users").doc(user.uid).set({
            email: user.email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        })
        .then(() => {
          alert("Cadastro realizado com sucesso!");
          window.location.href = "chat.html";
        })
        .catch((error) => {
          alert("Erro no cadastro: " + error.message);
        });
    });
  }
});

// ======================
// Lógica do Chat (apenas quando estiver no chat.html)
// ======================
if (window.location.pathname.includes("chat.html")) {
  const logoutBtn = document.getElementById("logout");

  auth.onAuthStateChanged((user) => {
    if (!user) {
      // Se não estiver logado, volta para login
      window.location.href = "index.html";
    }
  });

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      auth.signOut().then(() => {
        window.location.href = "index.html";
      });
    });
  }
}

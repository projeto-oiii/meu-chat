// Import Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, addDoc, collection, query, orderBy, onSnapshot, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Configuração Firebase
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

// Salvar login ativo no navegador
function salvarSessao(usuario) {
  localStorage.setItem("usuarioAtivo", JSON.stringify(usuario));
}
function pegarSessao() {
  return JSON.parse(localStorage.getItem("usuarioAtivo"));
}
function limparSessao() {
  localStorage.removeItem("usuarioAtivo");
}

// ===== Cadastro =====
const cadastroForm = document.getElementById("cadastroForm");
if (cadastroForm) {
  cadastroForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nome = document.getElementById("nome").value;
    const usuario = document.getElementById("usuario").value;
    const telefone = document.getElementById("telefone").value;
    const senha = document.getElementById("senha").value;

    try {
      await setDoc(doc(db, "users", usuario), {
        nome, usuario, telefone, senha
      });
      alert("Cadastro realizado com sucesso!");
      window.location.href = "index.html";
    } catch (err) {
      alert("Erro ao cadastrar: " + err.message);
    }
  });
}

// ===== Login =====
const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const loginUser = document.getElementById("loginUser").value;
    const senha = document.getElementById("loginSenha").value;

    try {
      // busca por nickname ou telefone
      const q1 = query(collection(db, "users"), where("usuario", "==", loginUser));
      const q2 = query(collection(db, "users"), where("telefone", "==", loginUser));

      let querySnapshot = await getDocs(q1);
      if (querySnapshot.empty) {
        querySnapshot = await getDocs(q2);
      }

      if (querySnapshot.empty) {
        alert("Usuário não encontrado.");
        return;
      }

      const userDoc = querySnapshot.docs[0].data();
      if (userDoc.senha !== senha) {
        alert("Senha incorreta.");
        return;
      }

      salvarSessao(userDoc);
      window.location.href = "chat.html";
    } catch (err) {
      alert("Erro no login: " + err.message);
    }
  });
}

// ===== Chat =====
const chatForm = document.getElementById("chatForm");
const chatMessages = document.getElementById("chatMessages");
const logoutBtn = document.getElementById("logoutBtn");

if (chatForm && chatMessages) {
  const usuario = pegarSessao();
  if (!usuario) {
    window.location.href = "index.html";
  } else {
    document.getElementById("meNome").innerText = usuario.nome;
    document.getElementById("meUser").innerText = "@" + usuario.usuario;

    chatForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const msg = document.getElementById("mensagemInput").value;
      await addDoc(collection(db, "mensagens"), {
        texto: msg,
        usuario: usuario.usuario,
        nome: usuario.nome,
        timestamp: new Date()
      });
      chatForm.reset();
    });

    const q = query(collection(db, "mensagens"), orderBy("timestamp", "asc"));
    onSnapshot(q, (snapshot) => {
      chatMessages.innerHTML = "";
      snapshot.forEach((doc) => {
        const msg = doc.data();
        const div = document.createElement("div");
        div.classList.add("msg");
        div.classList.add(msg.usuario === usuario.usuario ? "me" : "other");
        div.innerHTML = `<div class="from">${msg.nome}</div>${msg.texto}`;
        chatMessages.appendChild(div);
      });
      chatMessages.scrollTop = chatMessages.scrollHeight;
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      limparSessao();
      window.location.href = "index.html";
    });
  }
}

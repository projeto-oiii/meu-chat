// app.js (type="module")

/* ========= Firebase ========= */
import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore,
  doc, getDoc, setDoc, updateDoc, addDoc, getDocs,
  collection, serverTimestamp, onSnapshot, query, where, orderBy, limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ========= SUA CONFIG DO FIREBASE ========= */
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
const db   = getFirestore(app);

/* ========= Helpers de rota ========= */
export function ensureLoggedOut() {
  onAuthStateChanged(auth, (user) => {
    if (user) window.location.href = "./chat.html";
  });
}

export function ensureLoggedIn() {
  onAuthStateChanged(auth, (user) => {
    if (!user) window.location.href = "./index.html";
  });
}

/* ========= Auth ========= */
export async function loginWithEmail(email, password) {
  try {
    await signInWithEmailAndPassword(auth, email, password);
    window.location.href = "./chat.html";
  } catch (e) {
    alert("Erro ao entrar: " + e.message);
  }
}

export async function signUpWithEmail({ name, username, phone, email, password }) {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (name) {
      await updateProfile(cred.user, { displayName: name });
    }
    // cria/atualiza documento do usuário
    await setDoc(doc(db, "users", cred.user.uid), {
      uid: cred.user.uid,
      name: name || "",
      username: username || "",
      phone: phone || "",
      email,
      photoURL: cred.user.photoURL || "",
      createdAt: serverTimestamp()
    });
    // Após cadastro, volta para login
    alert("Cadastro realizado! Faça login para entrar.");
    await signOut(auth);
    window.location.href = "./index.html";
  } catch (e) {
    alert("Erro ao cadastrar: " + e.message);
  }
}

export async function logout() {
  await signOut(auth);
  window.location.href = "./index.html";
}

/* ========= Dados do usuário logado ========= */
export function loadMe({ nameEl, usernameEl }) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) return;
    const snap = await getDoc(doc(db, "users", user.uid));
    const data = snap.exists() ? snap.data() : { name: user.displayName || "", username: "" };
    if (nameEl) nameEl.textContent = data.name || user.email || "Você";
    if (usernameEl) usernameEl.textContent = data.username ? "@" + data.username : user.email;
  });
}

/* ========= Conversas (modelagem) =========
   - Conversas diretas: 'chats' (docId = uidA_uidB ordenado) | subcoleção 'messages'
   - Controle por usuário: 'users/{uid}/conversations/{chatId}' com {archived: bool, peerUid, lastMsg,...}
   - Grupos: 'groups/{groupId}' {name, owner, members[]} | 'groups/{id}/messages'
*/ 

// util: id determinístico p/ chat direto
function directChatId(uid1, uid2) {
  return [uid1, uid2].sort().join("_");
}

let CURRENT_CHAT = null; // {type: 'direct'|'group', id, peer?:{uid,name}, archived?:bool}
let MESSAGES_UNSUB = null;

// abre prompt para iniciar chat com @username
export async function openNewChatPrompt() {
  const username = prompt("Digite o @username para iniciar conversa (ex.: joaosilva)").trim().toLowerCase();
  if (!username) return;
  const q = query(collection(db, "users"), where("username", "==", username), limit(1));
  const res = await getDocs(q);
  if (res.empty) return alert("Usuário não encontrado.");
  const peer = res.docs[0].data();
  return openDirectChat(peer.uid);
}

// cria/abre chat direto
export async function openDirectChat(peerUid) {
  const user = auth.currentUser;
  if (!user) return;
  const chatId = directChatId(user.uid, peerUid);

  // Garante que cada usuário possua o registro de conversa
  const peerSnap = await getDoc(doc(db, "users", peerUid));
  const peerData = peerSnap.exists() ? peerSnap.data() : { name: "Contato", username: "" };

  await setDoc(doc(db, "users", user.uid, "conversations", chatId), {
    chatId, type: "direct", peerUid, archived: false, updatedAt: serverTimestamp(),
    peerName: peerData.name || peerData.username || "Contato"
  }, { merge: true });

  await setDoc(doc(db, "users", peerUid, "conversations", chatId), {
    chatId, type: "direct", peerUid: user.uid, archived: false, updatedAt: serverTimestamp(),
    peerName: auth.currentUser.displayName || auth.currentUser.email
  }, { merge: true });

  // prepara UI
  CURRENT_CHAT = { type: "direct", id: chatId, peer: { uid: peerUid, name: peerData.name || ("@" + peerData.username) } };
  renderPeerHeader();
  listenMessages("chats", chatId);
}

// abre grupo
export async function openGroupChat(groupId) {
  const snap = await getDoc(doc(db, "groups", groupId));
  if (!snap.exists()) return;
  const data = snap.data();
  CURRENT_CHAT = { type: "group", id: groupId, peer: { name: data.name } };
  renderPeerHeader();
  listenMessages("groups", groupId);
}

// enviar mensagem
export async function sendMessage(text) {
  const user = auth.currentUser;
  if (!user || !CURRENT_CHAT) return;

  const base =
    CURRENT_CHAT.type === "direct"
      ? doc(db, "chats", CURRENT_CHAT.id)
      : doc(db, "groups", CURRENT_CHAT.id);

  const msgs = collection(base, "messages");
  await addDoc(msgs, {
    text,
    from: user.uid,
    name: user.displayName || user.email,
    createdAt: serverTimestamp()
  });

  // atualiza resumo (conversations)
  if (CURRENT_CHAT.type === "direct") {
    const [a, b] = CURRENT_CHAT.id.split("_");
    await updateDoc(doc(db, "users", a, "conversations", CURRENT_CHAT.id), {
      lastMsg: text, updatedAt: serverTimestamp()
    }).catch(()=>{});
    await updateDoc(doc(db, "users", b, "conversations", CURRENT_CHAT.id), {
      lastMsg: text, updatedAt: serverTimestamp()
    }).catch(()=>{});
  }
}

// ouvir mensagens do chat atual
function listenMessages(kind, id) {
  if (MESSAGES_UNSUB) { MESSAGES_UNSUB(); MESSAGES_UNSUB = null; }
  const base = doc(db, kind, id);
  const qMsgs = query(collection(base, "messages"), orderBy("createdAt","asc"));
  const box = document.getElementById("messages");
  box.innerHTML = "";

  MESSAGES_UNSUB = onSnapshot(qMsgs, (snap) => {
    box.innerHTML = "";
    snap.forEach((d) => {
      const m = d.data();
      const mine = m.from === (auth.currentUser && auth.currentUser.uid);
      const el = document.createElement("div");
      el.className = "msg " + (mine ? "me" : "other");
      el.innerHTML = `<div class="from">${m.name || ""}</div>${m.text || ""}`;
      box.appendChild(el);
    });
    box.scrollTop = box.scrollHeight;
  });
}

// header do chat
function renderPeerHeader() {
  const nameEl = document.getElementById("peerName");
  const subEl  = document.getElementById("peerSub");
  if (!CURRENT_CHAT) {
    nameEl.textContent = "Selecione uma conversa";
    subEl.textContent = "";
    return;
  }
  nameEl.textContent = CURRENT_CHAT.peer?.name || "Conversa";
  subEl.textContent  = CURRENT_CHAT.type === "direct" ? "Mensagem direta" : "Grupo";
}

/* ========= Listas: conversas, arquivadas e grupos ========= */
export function listenConversations(containerEl, onOpen) {
  onAuthStateChanged(auth, (user) => {
    if (!user) return;
    const qRef = query(collection(db, "users", user.uid, "conversations"),
      where("archived","==",false), orderBy("updatedAt","desc"));
    onSnapshot(qRef, (snap) => {
      containerEl.innerHTML = "";
      snap.forEach(d => {
        const c = d.data();
        const item = document.createElement("div");
        item.className = "sidebar-item";
        item.innerHTML = `
          <div class="avatar">💬</div>
          <div>
            <div class="item-title">${c.peerName || "Conversa"}</div>
            <div class="item-sub">${c.lastMsg ? c.lastMsg : "sem mensagens"}</div>
          </div>`;
        item.addEventListener("click", () => onOpen(c.peerUid ? directChatId(auth.currentUser.uid, c.peerUid) : c.chatId) || openDirectChat(c.peerUid));
        containerEl.appendChild(item);
      });
    });
  });
}

export function listenArchived(containerEl, onOpen) {
  onAuthStateChanged(auth, (user) => {
    if (!user) return;
    const qRef = query(collection(db, "users", user.uid, "conversations"),
      where("archived","==",true), orderBy("updatedAt","desc"));
    onSnapshot(qRef, (snap) => {
      containerEl.innerHTML = "";
      snap.forEach(d => {
        const c = d.data();
        const item = document.createElement("div");
        item.className = "sidebar-item";
        item.innerHTML = `
          <div class="avatar">📦</div>
          <div>
            <div class="item-title">${c.peerName || "Conversa"}</div>
            <div class="item-sub">${c.lastMsg || ""}</div>
          </div>`;
        item.addEventListener("click", () => onOpen(c.peerUid ? directChatId(auth.currentUser.uid, c.peerUid) : c.chatId) || openDirectChat(c.peerUid));
        containerEl.appendChild(item);
      });
    });
  });
}

export function listenGroups(containerEl, onOpen) {
  onAuthStateChanged(auth, (user) => {
    if (!user) return;
    const qRef = query(collection(db, "groups"), where("members","array-contains", user.uid), orderBy("updatedAt","desc"));
    onSnapshot(qRef, (snap) => {
      containerEl.innerHTML = "";
      snap.forEach(d => {
        const g = d.data();
        const item = document.createElement("div");
        item.className = "sidebar-item";
        item.innerHTML = `
          <div class="avatar">👥</div>
          <div>
            <div class="item-title">${g.name}</div>
            <div class="item-sub">${(g.members||[]).length} membros</div>
          </div>`;
        item.addEventListener("click", () => onOpen(g.id));
        containerEl.appendChild(item);
      });
    });

    // cria grupo
    const btn = document.getElementById("btnCreateGroup");
    if (btn && !btn._bound) {
      btn._bound = true;
      btn.addEventListener("click", async () => {
        const name = document.getElementById("groupName").value.trim();
        const membersUsernames = document.getElementById("groupMembers").value
          .split(",")
          .map(s => s.trim().toLowerCase())
          .filter(Boolean);

        if (!name) return alert("Dê um nome ao grupo.");
        const memberUids = [user.uid];

        // busca uids por username
        for (const u of membersUsernames) {
          const qU = query(collection(db, "users"), where("username","==", u), limit(1));
          const r  = await getDocs(qU);
          if (!r.empty) memberUids.push(r.docs[0].data().uid);
        }

        const ref = await addDoc(collection(db, "groups"), {
          name, owner: user.uid, members: Array.from(new Set(memberUids)),
          createdAt: serverTimestamp(), updatedAt: serverTimestamp()
        });
        await updateDoc(ref, { id: ref.id });
        alert("Grupo criado!");
      });
    }
  });
}

/* ========= Tabs e Arquivo ========= */
export function onTabChange(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.tab[data-tab="${tab}"]`).classList.add('active');

  document.getElementById('listConversas').classList.add('hidden');
  document.getElementById('listArquivadas').classList.add('hidden');
  document.getElementById('groupsPane').classList.add('hidden');

  if (tab === 'conversas') document.getElementById('listConversas').classList.remove('hidden');
  if (tab === 'arquivadas') document.getElementById('listArquivadas').classList.remove('hidden');
  if (tab === 'grupos') document.getElementById('groupsPane').classList.remove('hidden');
}

export async function toggleArchive() {
  const user = auth.currentUser;
  if (!user || !CURRENT_CHAT || CURRENT_CHAT.type !== "direct") return;

  const convRef = doc(db, "users", user.uid, "conversations", CURRENT_CHAT.id);
  const snap = await getDoc(convRef);
  if (!snap.exists()) return;
  const now = !snap.data().archived;
  await updateDoc(convRef, { archived: now, updatedAt: serverTimestamp() });
  alert(now ? "Conversa arquivada." : "Conversa desarquivada.");
}

/* ========= Export auth/db (se precisar em outros módulos) ========= */
export { auth, db };

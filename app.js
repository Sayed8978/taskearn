import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, addDoc, query, where, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBAeBFnjaLRgcBozI9Hh6ky78SAhgwUWn0",
  authDomain: "taskearn-fe85f.firebaseapp.com",
  projectId: "taskearn-fe85f",
  storageBucket: "taskearn-fe85f.firebasestorage.app",
  messagingSenderId: "846804162602",
  appId: "1:846804162602:web:6cddbcccc8bd1e97f34b53"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const $ = (id) => document.getElementById(id);
let balance = 0;

function addRow(list, left, right) {
  const li = document.createElement("li");
  const a = document.createElement("span");
  const b = document.createElement("span");
  a.textContent = left;
  b.textContent = right;
  li.append(a, b);
  list.appendChild(li);
}

function empty(list, text) {
  const p = document.createElement("p");
  p.className = "empty";
  p.textContent = text;
  list.replaceChildren(p);
}

$("loginBtn").onclick = async () => {
  $("err").textContent = "";
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (e) {
    $("err").textContent = "লগইন হয়নি (" + e.code + ")। আবার চেষ্টা করুন।";
  }
};

$("logout").onclick = () => signOut(auth);

onAuthStateChanged(auth, async (u) => {
  $("login").hidden = !!u;
  $("app").hidden = !u;
  if (!u) return;
  $("who").textContent = u.displayName || u.email;
  await ensureUser(u);
  await Promise.all([loadBalance(u), loadTasks(), loadWithdrawals(u)]);
});

async function ensureUser(u) {
  try {
    const ref = doc(db, "users", u.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        name: u.displayName || "",
        email: u.email,
        balance: 0,
        createdAt: serverTimestamp()
      });
    }
  } catch (e) {
    console.error(e);
  }
}

async function loadBalance(u) {
  try {
    const snap = await getDoc(doc(db, "users", u.uid));
    balance = Number((snap.data() || {}).balance) || 0;
  } catch (e) {
    balance = 0;
  }
  $("bal").textContent = "৳" + balance;
}

async function loadTasks() {
  const list = $("tasks");
  list.replaceChildren();
  try {
    const snap = await getDocs(collection(db, "tasks"));
    if (snap.empty) return empty(list, "এখন কোনো কাজ নেই।");
    snap.forEach((d) => {
      const t = d.data();
      addRow(list, t.title || "নামহীন কাজ", "৳" + (t.reward || 0));
    });
  } catch (e) {
    empty(list, "কাজ লোড করা যায়নি।");
  }
}

async function loadWithdrawals(u) {
  const list = $("wList");
  list.replaceChildren();
  const label = { pending: "অপেক্ষায়", paid: "পরিশোধিত", rejected: "বাতিল" };
  try {
    const q = query(collection(db, "withdrawals"), where("userId", "==", u.uid));
    const snap = await getDocs(q);
    const rows = snap.docs.map((d) => d.data());
    rows.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    rows.forEach((w) => addRow(list, "৳" + w.amount, label[w.status] || w.status));
  } catch (e) {
    console.error(e);
  }
}

$("wForm").onsubmit = async (e) => {
  e.preventDefault();
  const u = auth.currentUser;
  const amount = Number($("amt").value);
  const msg = $("wMsg");
  if (!u || !(amount > 0)) return;
  if (amount > balance) {
    msg.textContent = "ব্যালেন্সের চেয়ে বেশি তোলা যাবে না।";
    return;
  }
  try {
    await addDoc(collection(db, "withdrawals"), {
      userId: u.uid,
      amount: amount,
      status: "pending",
      createdAt: serverTimestamp()
    });
    msg.textContent = "অনুরোধ পাঠানো হয়েছে।";
    $("amt").value = "";
    loadWithdrawals(u);
  } catch (err) {
    msg.textContent = "অনুরোধ পাঠানো যায়নি (" + err.code + ")।";
  }
};


const chat = document.getElementById("chat");
const form = document.getElementById("chatForm");
const input = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const statusText = document.getElementById("status");
const historyBox = document.getElementById("history");
const useWeb = document.getElementById("useWeb");

let conversations = [];
let currentId = null;
let busy = false;

try {
  const saved = JSON.parse(localStorage.getItem("cakcuk-chats") || "[]");
  conversations = Array.isArray(saved) ? saved : [];
} catch {
  conversations = [];
}

function saveChats() {
  localStorage.setItem("cakcuk-chats", JSON.stringify(conversations));
}

function currentChat() {
  return conversations.find(c => c.id === currentId);
}

function createChat() {
  const c = {
    id: crypto.randomUUID(),
    title: "Yeni sohbet",
    messages: []
  };

  conversations.unshift(c);
  currentId = c.id;
  saveChats();
  renderHistory();
  renderMessages();
  input.focus();
}

function renderHistory() {
  historyBox.replaceChildren();

  conversations.forEach(c => {
    const button = document.createElement("button");
    button.className = "history-item" +
      (c.id === currentId ? " active" : "");
    button.textContent = c.title;
    button.title = c.title;

    button.addEventListener("click", () => {
      currentId = c.id;
      renderHistory();
      renderMessages();
      document.getElementById("sidebar").classList.remove("open");
    });

    historyBox.appendChild(button);
  });
}

function makeAvatar(role) {
  const img = document.createElement("img");
  img.className = "avatar";
  img.src = role === "user" ? "/benim.jpg" : "/cakcuk.jpg";
  img.alt = role === "user" ? "Sen" : "Cakcuk";

  img.onerror = () => {
    const fallback = document.createElement("div");
    fallback.className = "avatar avatar-fallback";
    fallback.textContent = role === "user" ? "S" : "C";
    img.replaceWith(fallback);
  };

  return img;
}

function addMessage(role, content) {
  const row = document.createElement("div");
  row.className = "message " + role;

  const body = document.createElement("div");
  body.className = "message-content";

  const name = document.createElement("div");
  name.className = "message-name";
  name.textContent = role === "user" ? "Sen" : "Cakcuk";

  const text = document.createElement("div");
  text.className = "message-text";
  text.textContent = content;

  body.append(name, text);
  row.append(makeAvatar(role), body);
  chat.appendChild(row);

  return row;
}

function showWelcome() {
  const panel = document.createElement("div");
  panel.className = "welcome";

  const img = document.createElement("img");
  img.className = "welcome-avatar";
  img.src = "/cakcuk.jpg";
  img.alt = "Cakcuk";
  img.onerror = () => img.remove();

  const heading = document.createElement("h1");
  heading.textContent = "Ne konuşuyoruz?";

  const description = document.createElement("p");
  description.textContent = "Sor bakalım, neyi çözüyoruz?";

  const suggestions = document.createElement("div");
  suggestions.className = "suggestions";

  [
    "Bana komik bir laf sok",
    "Minecraft'ta yardım et",
    "Bir kod yazalım"
  ].forEach(value => {
    const button = document.createElement("button");
    button.className = "suggestion";
    button.type = "button";
    button.textContent = value;
    button.addEventListener("click", () => sendMessage(value));
    suggestions.appendChild(button);
  });

  panel.append(img, heading, description, suggestions);
  chat.appendChild(panel);
}

function renderMessages() {
  chat.replaceChildren();

  const c = currentChat();

  if (!c || c.messages.length === 0) {
    showWelcome();
    return;
  }

  c.messages.forEach(m => addMessage(m.role, m.content));
  chat.scrollTop = chat.scrollHeight;
}

async function sendMessage(value) {
  const message = value.trim();

  if (!message || busy) return;

  if (!currentChat()) createChat();

  const c = currentChat();
  c.messages.push({ role: "user", content: message });

  if (c.messages.length === 1) {
    c.title = message.slice(0, 35);
  }

  input.value = "";
  input.style.height = "auto";
  saveChats();
  renderHistory();
  renderMessages();

  busy = true;
  sendBtn.disabled = true;
  statusText.textContent = "Cakcuk düşünüyor...";

  const loading = addMessage("assistant", "Bir saniye...");
  chat.scrollTop = chat.scrollHeight;

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: c.messages.slice(-6),
        useWeb: useWeb.checked
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Bir hata oluştu.");
    }

    const reply = data.reply || "Bu sefer cevap üretemedim.";
    loading.querySelector(".message-text").textContent = reply;

    c.messages.push({ role: "assistant", content: reply });
    saveChats();
    statusText.textContent = "Çevrimiçi";
  } catch (error) {
    loading.querySelector(".message-text").textContent =
      "Cevap alınamadı: " + error.message;
    statusText.textContent = "Bağlantı/API hatası";
  } finally {
    busy = false;
    sendBtn.disabled = false;
    input.focus();
    chat.scrollTop = chat.scrollHeight;
  }
}

form.addEventListener("submit", event => {
  event.preventDefault();
  sendMessage(input.value);
});

input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 180) + "px";
});

input.addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

document.getElementById("newChat").addEventListener("click", createChat);

document.getElementById("menuBtn").addEventListener("click", () => {
  document.getElementById("sidebar").classList.toggle("open");
});

async function checkStatus() {
  try {
    const response = await fetch("/api/status");
    const data = await response.json();
    statusText.textContent = data.configured
      ? "API hazır"
      : "API anahtarı gerekli";
  } catch {
    statusText.textContent = "Sunucuya bağlanılamıyor";
  }
}

if (conversations.length > 0) {
  currentId = conversations[0].id;
}

renderHistory();
renderMessages();
checkStatus();

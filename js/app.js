// js/app.js (SnapMap Lite — improved UX, same structure)
// Requires js/categories.js (exported `categories`)

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

import {
  ref, set, update, onValue, push
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

import { categories } from './categories.js';

// ---------------- DOM ----------------
const DOM = {
  loginBtn: document.getElementById('loginBtn'),
  logoutBtn: document.getElementById('logoutBtn'),
  loginModal: document.getElementById('loginModal'),
  signInBtn: document.getElementById('signInBtn'),
  signUpBtn: document.getElementById('signUpBtn'),
  closeLoginBtn: document.getElementById('closeLoginBtn'),
  emailInput: document.getElementById('emailInput'),
  passwordInput: document.getElementById('passwordInput'),
  authError: document.getElementById('authError'),
  displayName: document.getElementById('displayName'),
  myAvatarImg: document.getElementById('myAvatar'),
  avatarInput: document.getElementById('avatarInput'),
  balanceEl: document.getElementById('balance'),
  statusEl: document.getElementById('status'),
  spawnItemBtn: document.getElementById('spawnItem'),
  openInventoryBtn: document.getElementById('openInventory'),
  inventoryModal: document.getElementById('inventoryModal'),
  inventoryList: document.getElementById('inventoryList'),
  closeInventory: document.getElementById('closeInventory'),
  sellAllBtn: document.getElementById('sellAll'),
  openListingModalBtn: document.getElementById('openListingModal'),
  listingModal: document.getElementById('listingModal'),
  listingNameInput: document.getElementById('listingNameInput'),
  listingCategory: document.getElementById('listingCategory'),
  listingContactInput: document.getElementById('listingContactInput'),
  submitListingBtn: document.getElementById('submitListingBtn'),
  closeListingBtn: document.getElementById('closeListingBtn'),
  chatModal: document.getElementById('chatModal'),
  chatWithTitle: document.getElementById('chatWithTitle'),
  chatWindow: document.getElementById('chatWindow'),
  chatInput: document.getElementById('chatInput'),
  sendChatBtn: document.getElementById('sendChatBtn'),
  closeChatBtn: document.getElementById('closeChatBtn'),
};

// ---------------- Firebase ----------------
const auth = window.firebaseAuth;
const db = window.firebaseDB;

// ---------------- App State ----------------
let myUid = null;
let myState = {
  id: null,
  name: 'You',
  avatarDataUrl: DOM.myAvatarImg.src,
  lat: 0,
  lon: 0,
  balance: 100,
  inventory: []
};
let players = {};
let currentChatTarget = null;

// ---------------- Map ----------------
const map = L.map('map', { center: [0, 0], zoom: 2 });
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
const itemsLayer = L.layerGroup().addTo(map);
const listingsLayer = L.layerGroup().addTo(map);

// ---------------- Helpers ----------------
function displayNameText() {
  return (DOM.displayName?.textContent || 'You').trim();
}
function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, m =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])
  );
}
function createAvatarIcon(dataUrl, size = 48) {
  return L.divIcon({
    className: 'custom-avatar',
    html: `<img src="${dataUrl}" width="${size}" height="${size}" />`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
  });
}
function makeRoomId(a, b) {
  return [a, b].sort().join('_');
}

// ---------------- Marker ----------------
let myMarker = L.marker([0, 0], {
  icon: createAvatarIcon(myState.avatarDataUrl)
}).addTo(map);

// ---------------- Auth UI ----------------
DOM.loginBtn.onclick = () => DOM.loginModal.classList.remove('hidden');
DOM.closeLoginBtn.onclick = () => DOM.loginModal.classList.add('hidden');

DOM.signInBtn.onclick = async () => {
  DOM.signInBtn.disabled = true;
  DOM.signInBtn.textContent = 'Signing in…';
  try {
    await signInWithEmailAndPassword(auth,
      DOM.emailInput.value.trim(),
      DOM.passwordInput.value.trim()
    );
    DOM.loginModal.classList.add('hidden');
    DOM.authError.textContent = '';
  } catch (e) {
    DOM.authError.textContent = e.message;
  } finally {
    DOM.signInBtn.disabled = false;
    DOM.signInBtn.textContent = 'Sign In';
  }
};

DOM.signUpBtn.onclick = async () => {
  DOM.signUpBtn.disabled = true;
  DOM.signUpBtn.textContent = 'Creating…';
  try {
    const cred = await createUserWithEmailAndPassword(
      auth,
      DOM.emailInput.value.trim(),
      DOM.passwordInput.value.trim()
    );
    await set(ref(db, 'users/' + cred.user.uid), myState);
    DOM.loginModal.classList.add('hidden');
  } catch (e) {
    DOM.authError.textContent = e.message;
  } finally {
    DOM.signUpBtn.disabled = false;
    DOM.signUpBtn.textContent = 'Sign Up';
  }
};

DOM.logoutBtn.onclick = () => signOut(auth);

// ---------------- Auth State ----------------
onAuthStateChanged(auth, user => {
  if (user) {
    myUid = user.uid;
    DOM.loginBtn.style.display = 'none';
    DOM.logoutBtn.style.display = 'inline-block';
    DOM.statusEl.textContent = '🟢 Online';

    onValue(ref(db, 'users/' + myUid), snap => {
      if (snap.exists()) {
        Object.assign(myState, snap.val());
        updateUI();
      }
    });

    onValue(ref(db, 'users'), snap => rebuildUsers(snap.val() || {}));
  } else {
    myUid = null;
    DOM.loginBtn.style.display = 'inline-block';
    DOM.logoutBtn.style.display = 'none';
    DOM.statusEl.textContent = '🔴 Offline';
    listingsLayer.clearLayers();
  }
});

// ---------------- Prevent actions when logged out ----------------
function requireAuth() {
  if (!myUid) {
    alert('Please log in first');
    return false;
  }
  return true;
}

// ---------------- Items ----------------
DOM.spawnItemBtn.onclick = () => {
  if (!requireAuth()) return;
  spawnItemAt(myState.lat, myState.lon);
};

map.on('click', e => {
  if (!requireAuth()) return;
  spawnItemAt(e.latlng.lat, e.latlng.lng);
});

function spawnItemAt(lat, lon) {
  const marker = L.marker([lat, lon], {
    icon: L.divIcon({ html: '🎁', className: 'item-marker' })
  }).addTo(itemsLayer);
}

// ---------------- Chat ----------------
DOM.sendChatBtn.onclick = async () => {
  if (!DOM.chatInput.value.trim() || !currentChatTarget) return;
  DOM.sendChatBtn.disabled = true;
  await push(ref(db, 'messages/' + makeRoomId(myUid, currentChatTarget)), {
    fromName: displayNameText(),
    text: DOM.chatInput.value,
    timestamp: Date.now()
  });
  DOM.chatInput.value = '';
  DOM.sendChatBtn.disabled = false;
};

// ---------------- ESC closes modals ----------------
window.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal')
      .forEach(m => m.classList.add('hidden'));
  }
});

// ---------------- UI ----------------
function updateUI() {
  DOM.displayName.textContent = myState.name;
  DOM.myAvatarImg.src = myState.avatarDataUrl;
  myMarker.setIcon(createAvatarIcon(myState.avatarDataUrl));
  DOM.balanceEl.textContent = myState.balance;
}

// ---------------- Users ----------------
function rebuildUsers(all) {
  listingsLayer.clearLayers();
  Object.entries(all).forEach(([uid, data]) => {
    if (!data.inventory) return;
    data.inventory.forEach(item => {
      const m = L.marker([data.lat, data.lon], {
        icon: L.divIcon({ html: '📌' })
      }).addTo(listingsLayer);
      m.bindPopup(`<strong>${escapeHtml(item.itemName)}</strong>`);
    });
  });
}

// ---------------- Categories ----------------
function populateCategoriesSelect() {
  DOM.listingCategory.innerHTML = '';
  categories.forEach(c => {
    const o = document.createElement('option');
    o.value = c;
    o.textContent = c;
    DOM.listingCategory.appendChild(o);
  });
}
populateCategoriesSelect();













































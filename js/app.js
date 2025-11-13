// js/app.js (UPDATED)
// SnapMap Lite — merged multiplayer app (improved: listings + fullscreen map)
// Note: requires js/categories.js (exported `categories`) to be available

import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { ref, set, update, onValue, push, get } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
import { categories } from './categories.js'; // simple categories list

// Firebase references created in index.html
const auth = window.firebaseAuth;
const db = window.firebaseDB;
const storage = window.firebaseStorage; // not used heavily yet

/* ---------------- DOM ---------------- */
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const loginModal = document.getElementById('loginModal');
const signInBtn = document.getElementById('signInBtn');
const signUpBtn = document.getElementById('signUpBtn');
const closeLoginBtn = document.getElementById('closeLoginBtn');
const emailInput = document.getElementById('emailInput');
const passwordInput = document.getElementById('passwordInput');
const authError = document.getElementById('authError');

const displayNameEl = document.getElementById('displayName');
const myAvatarImg = document.getElementById('myAvatar');
const avatarInput = document.getElementById('avatarInput');
const balanceEl = document.getElementById('balance');
const statusEl = document.getElementById('status');
const toggleSimBtn = document.getElementById('toggleSim');
const spawnItemBtn = document.getElementById('spawnItem');

const openInventoryBtn = document.getElementById('openInventory');
const inventoryModal = document.getElementById('inventoryModal');
const inventoryList = document.getElementById('inventoryList');
const closeInventory = document.getElementById('closeInventory');
const sellAllBtn = document.getElementById('sellAll');

const openListingModalBtn = document.getElementById('openListingModal');
const listingModal = document.getElementById('listingModal');
const listingNameInput = document.getElementById('listingNameInput');
const listingCategory = document.getElementById('listingCategory');
const listingContactInput = document.getElementById('listingContactInput');
const submitListingBtn = document.getElementById('submitListingBtn');
const closeListingBtn = document.getElementById('closeListingBtn');

const chatModal = document.getElementById('chatModal');
const chatWithTitle = document.getElementById('chatWithTitle');
const chatWindow = document.getElementById('chatWindow');
const chatInput = document.getElementById('chatInput');
const sendChatBtn = document.getElementById('sendChatBtn');
const closeChatBtn = document.getElementById('closeChatBtn');

/* ---------------- App state ---------------- */
let myUid = null;
let myState = {
  id: null,
  name: 'You',
  avatarDataUrl: myAvatarImg.src,
  lat: 0,
  lon: 0,
  balance: 100,
  inventory: [] // listings live here
};

let players = {}; // uid -> { marker, data }
let simEnabled = true;

/* ---------------- Map init ---------------- */
const map = L.map('map', { center: [0,0], zoom: 2 });
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// layers
const itemsLayer = L.layerGroup().addTo(map);
const listingsLayer = L.layerGroup().addTo(map); // all users' listings as pins

// helper for avatar icons
function createAvatarIcon(dataUrl, size = 48) {
  return L.divIcon({
    className: 'custom-avatar',
    html: `<img src="${dataUrl}" width="${size}" height="${size}" style="border-radius:50%;object-fit:cover"/>`,
    iconSize: [size, size],
    iconAnchor: [size/2, size/2]
  });
}

/* ---------------- Simulated friends (kept) ---------------- */
const simFriends = [];
function spawnSimFriends(n = 3) {
  for (let i=0;i<n;i++){
    const lat = (Math.random()*140)-70;
    const lon = (Math.random()*360)-180;
    const id = 'sim-' + Math.random().toString(36).slice(2,7);
    const avatar = `https://api.dicebear.com/6.x/thumbs/svg?seed=${id}`;
    const m = L.marker([lat,lon], { icon: createAvatarIcon(avatar, 40) }).addTo(map);
    m._data = { id, name: 'Friend ' + (i+1), avatar };
    m.bindPopup(`<strong>Friend ${i+1}</strong>`);
    simFriends.push(m);
  }
}
spawnSimFriends(3);
let simTimer = null;
function startSimMovement(){
  if(simTimer) return;
  simTimer = setInterval(()=> {
    simFriends.forEach(m => {
      const cur = m.getLatLng();
      m.setLatLng([cur.lat + (Math.random()-0.5)*0.01, cur.lng + (Math.random()-0.5)*0.01]);
    });
  }, 2000);
}
function stopSimMovement(){ if(simTimer){ clearInterval(simTimer); simTimer = null; } }
if(simEnabled) startSimMovement();

/* ---------------- Populate categories select ---------------- */
function populateCategoriesSelect() {
  if(!listingCategory) return;
  listingCategory.innerHTML = '';
  categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    listingCategory.appendChild(opt);
  });
}
populateCategoriesSelect();

/* ---------------- Firebase: Auth handlers ---------------- */
loginBtn.addEventListener('click', ()=> loginModal.classList.remove('hidden'));
closeLoginBtn.addEventListener('click', ()=> loginModal.classList.add('hidden'));

signInBtn.addEventListener('click', async () => {
  const email = emailInput.value.trim();
  const pass = passwordInput.value.trim();
  if(!email || !pass) { authError.textContent='Enter email and password'; return; }
  try {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    loginModal.classList.add('hidden');
    authError.textContent = '';
  } catch(err) {
    authError.textContent = err.message;
  }
});

signUpBtn.addEventListener('click', async () => {
  const email = emailInput.value.trim();
  const pass = passwordInput.value.trim();
  if(!email || !pass) { authError.textContent='Enter email and password'; return; }
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    // initialize user object
    const uid = cred.user.uid;
    const userRef = ref(db, 'users/' + uid);
    await set(userRef, {
      name: displayNameElText(),
      avatarDataUrl: myState.avatarDataUrl,
      lat: 0, lon: 0,
      balance: 100,
      inventory: []
    });
    loginModal.classList.add('hidden');
    authError.textContent = '';
  } catch(err) {
    authError.textContent = err.message;
  }
});

logoutBtn.addEventListener('click', async () => {
  await signOut(auth);
});

/* ---------------- Utility to read displayName DOM */
function displayNameElText(){ return (document.getElementById('displayName')?.textContent || 'You').trim(); }

/* ---------------- OnAuthStateChanged: set up listeners for user data + players list ---------------- */
onAuthStateChanged(auth, async user => {
  if(user){
    myUid = user.uid;
    myState.id = myUid;
    document.getElementById('authStatus').textContent = `Logged in: ${user.email || myUid}`;
    loginBtn.style.display = 'none';
    logoutBtn.style.display = 'inline-block';

    // Make map fullscreen by adding class to body
    document.body.classList.add('map-only');

    // listen to my user object
    const myRef = ref(db, 'users/' + myUid);
    onValue(myRef, snapshot => {
      const data = snapshot.val();
      if(data) {
        // merge into myState
        myState = Object.assign(myState, data);
        updateUI();
      } else {
        // create initial object
        set(myRef, {
          name: displayNameElText(),
          avatarDataUrl: myState.avatarDataUrl,
          lat: myState.lat,
          lon: myState.lon,
          balance: myState.balance,
          inventory: myState.inventory
        });
      }
    });

    // listen to all users (players). We'll display markers and show listings on the map
    const usersRef = ref(db, 'users');
    onValue(usersRef, snapshot => {
      const all = snapshot.val() || {};
      // remove players missing
      Object.keys(players).forEach(uid => {
        if(!all[uid]) { // removed
          try { map.removeLayer(players[uid].marker); } catch(e){}
          delete players[uid];
        }
      });
      // update/add players and rebuild listings layer
      Object.entries(all).forEach(([uid, data]) => {
        if(uid === myUid) return; // skip self (we handle own marker separately)
        if(players[uid]) {
          // update
          players[uid].data = data;
          try {
            players[uid].marker.setLatLng([data.lat || 0, data.lon || 0]);
            players[uid].marker.setIcon(createAvatarIcon(data.avatarDataUrl || 'assets/avatar-default.png', 40));
          } catch(e){}
        } else {
          // create marker
          const marker = L.marker([data.lat || 0, data.lon || 0], { icon: createAvatarIcon(data.avatarDataUrl || 'assets/avatar-default.png', 40) }).addTo(map);
          marker.bindPopup(() => {
            // dynamic popup showing name and listings with contact + "Message" button
            let html = `<strong>${escapeHtml(data.name || 'Player')}</strong><br>`;
            if(data.inventory && Array.isArray(data.inventory) && data.inventory.length > 0) {
              html += '<hr><strong>Listings</strong><br>';
              data.inventory.slice().reverse().forEach(it => {
                html += `<div class="listing-row"><strong>${escapeHtml(it.itemName)}</strong> <em>(${escapeHtml(it.category)})</em><br>Contact: ${escapeHtml(it.contact)}<br><button class="msg-btn" data-uid="${uid}">Message</button><hr></div>`;
              });
            } else {
              html += '<em>No listings</em>';
            }
            return html;
          });
          marker.on('popupopen', () => {
            // attach message button handlers after popup is in DOM
            setTimeout(() => {
              const buttons = document.querySelectorAll('.msg-btn');
              buttons.forEach(b => {
                b.onclick = () => {
                  const targetUid = b.getAttribute('data-uid');
                  openDirectChat(targetUid);
                };
              });
            }, 50);
          });
          players[uid] = { marker, data };
        }
      });

      // rebuild listings layer for all users
      rebuildListingsLayer(all);
    });

  } else {
    myUid = null;
    document.getElementById('authStatus').textContent = 'Not logged in';
    loginBtn.style.display = 'inline-block';
    logoutBtn.style.display = 'none';

    // remove map-only class so UI returns
    document.body.classList.remove('map-only');

    // remove players markers
    Object.keys(players).forEach(uid => {
      try { map.removeLayer(players[uid].marker); } catch(e){}
      delete players[uid];
    });

    // clear listings layer
    listingsLayer.clearLayers();
  }
});

/* ---------------- Save my user object / location ---------------- */
function saveUserData(){
  if(!myUid) return;
  set(ref(db, 'users/' + myUid), {
    name: displayNameElText(),
    avatarDataUrl: myState.avatarDataUrl,
    lat: myState.lat,
    lon: myState.lon,
    balance: myState.balance,
    inventory: myState.inventory
  }).catch(err => console.error('saveUserData err', err));
}

/* update only location quickly */
function saveLocation(){
  if(!myUid) return;
  update(ref(db, 'users/' + myUid), { lat: myState.lat, lon: myState.lon }).catch(e=>{});
}

/* ---------------- Avatar upload (local preview + save URL as dataURL in DB) ---------------- */
avatarInput.addEventListener('change', (e) => {
  const f = e.target.files && e.target.files[0];
  if(!f) return;
  const reader = new FileReader();
  reader.onload = async () => {
    myState.avatarDataUrl = reader.result;
    myAvatarImg.src = reader.result;
    try { myMarker.setIcon(createAvatarIcon(myState.avatarDataUrl, 48)); } catch(e){}
    saveUserData();
  };
  reader.readAsDataURL(f);
});

/* ---------------- My marker (local) ---------------- */
let myMarker = L.marker([0,0], { icon: createAvatarIcon(myState.avatarDataUrl, 48) }).addTo(map);
myMarker.bindPopup(() => `<strong>${displayNameElText()}</strong>`);

/* ---------------- Geolocation -> updates my marker and DB ---------------- */
function successLoc(pos){
  const lat = pos.coords.latitude, lon = pos.coords.longitude;
  myState.lat = lat; myState.lon = lon;
  myMarker.setLatLng([lat, lon]);
  map.setView([lat, lon], 15);
  statusEl.textContent = `Lat:${lat.toFixed(5)} Lon:${lon.toFixed(5)} (±${pos.coords.accuracy}m)`;
  saveLocation();
}
function errorLoc(err){
  statusEl.textContent = 'Location error: ' + err.message;
}
if (navigator.geolocation) {
  navigator.geolocation.watchPosition(successLoc, errorLoc, { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 });
} else {
  alert('Geolocation not supported by your browser.');
}

/* ---------------- Items (click to spawn) kept as-is (client-only) ---------------- */
function spawnItemAt(lat, lon) {
  const id = 'item-' + Math.random().toString(36).slice(2,8);
  const price = Math.floor(Math.random()*50)+10;
  const marker = L.marker([lat,lon], {
    icon: L.divIcon({ className:'item-marker', html:'🎁', iconSize:[36,36], iconAnchor:[18,18] })
  }).addTo(itemsLayer);
  marker._data = { id, price };
  marker.bindPopup(`<div>Item — $${price} <br><button class="buy-btn" data-id="${id}">Buy</button></div>`);
  marker.on('popupopen', () => {
    setTimeout(()=> {
      const btn = document.querySelector(`.buy-btn[data-id="${id}"]`);
      if(btn) btn.onclick = () => alert('This demo does not perform real purchases.');
    }, 60);
  });
}
spawnItemBtn.addEventListener('click', () => {
  const lat = myState.lat + (Math.random()-0.5)*0.01;
  const lon = myState.lon + (Math.random()-0.5)*0.01;
  spawnItemAt(lat, lon);
});
map.on('click', ev => spawnItemAt(ev.latlng.lat, ev.latlng.lng));

/* ---------------- Inventory listing management ---------------- */
openInventoryBtn.addEventListener('click', () => {
  inventoryModal.classList.remove('hidden');
  renderInventory();
});
closeInventory.addEventListener('click', () => inventoryModal.classList.add('hidden'));

function renderInventory() {
  inventoryList.innerHTML = '';
  const inv = myState.inventory || [];
  if(inv.length === 0) {
    inventoryList.innerHTML = '<div class="small">(no listings)</div>';
    return;
  }
  inv.slice().reverse().forEach((it, idx) => {
    const el = document.createElement('div');
    el.className = 'inventory-item';
    el.innerHTML = `<strong>${escapeHtml(it.itemName)}</strong> <em>(${escapeHtml(it.category)})</em><br>Contact: ${escapeHtml(it.contact)}<br><button class="remove-listing-btn" data-idx="${idx}">Remove</button>`;
    inventoryList.appendChild(el);
  });
  // attach remove handlers
  setTimeout(()=> {
    const btns = inventoryList.querySelectorAll('.remove-listing-btn');
    btns.forEach(b => {
      b.onclick = () => {
        const idx = parseInt(b.getAttribute('data-idx'), 10);
        // remove the appropriate element from end (since we reversed)
        const realIdx = myState.inventory.length - 1 - idx;
        myState.inventory.splice(realIdx, 1);
        saveUserData();
        renderInventory();
      };
    });
  }, 50);
}
sellAllBtn.addEventListener('click', () => {
  if(!confirm('Clear all your listings?')) return;
  myState.inventory = [];
  saveUserData();
  renderInventory();
});

/* ---------------- Create listing modal ---------------- */
openListingModalBtn.addEventListener('click', () => {
  if(!myUid) { alert('Log in first'); return; }
  // show form centered and prefill
  listingModal.classList.remove('hidden');
});
closeListingBtn.addEventListener('click', () => listingModal.classList.add('hidden'));
submitListingBtn.addEventListener('click', () => {
  if(!myUid) { alert('Log in first'); return; }
  const name = listingNameInput.value.trim();
  const cat = listingCategory.value;
  const contact = listingContactInput.value.trim();
  if(!name || !contact) { alert('Fill all fields'); return; }
  const newListing = {
    itemName: name,
    category: cat,
    contact,
    createdAt: Date.now()
  };
  myState.inventory = myState.inventory || [];
  myState.inventory.push(newListing);
  saveUserData();
  // optional: also add a short-lived listing marker at your location so it appears immediately
  addListingMarkerForUser(myUid, myState, newListing);
  listingNameInput.value = '';
  listingContactInput.value = '';
  listingModal.classList.add('hidden');
  renderInventory();
});

/* ---------------- Listings layer helpers ---------------- */
function rebuildListingsLayer(allUsersObj) {
  listingsLayer.clearLayers();
  if(!allUsersObj) return;
  Object.entries(allUsersObj).forEach(([uid, userData]) => {
    if(!userData || !userData.inventory || !Array.isArray(userData.inventory)) return;
    const baseLat = userData.lat || 0;
    const baseLon = userData.lon || 0;
    // place each listing slightly offset so multiple listings don't overlap exactly
    userData.inventory.forEach((it, idx) => {
      const offset = (idx % 5) * 0.00007;
      const lat = baseLat + offset;
      const lon = baseLon + ((Math.floor(idx/5) % 5) * 0.00007);
      const marker = L.marker([lat, lon], {
        icon: L.divIcon({ className: 'listing-marker', html: '📌', iconSize: [28,28], iconAnchor: [14,14] })
      }).addTo(listingsLayer);
      marker.bindPopup(buildListingPopupHtml(it, uid, userData));
      marker.on('popupopen', () => {
        // attach message button if present
        setTimeout(()=> {
          const btn = document.querySelector(`.msg-btn-listing[data-uid="${uid}"]`);
          if(btn) btn.onclick = () => openDirectChat(uid);
        }, 60);
      });
    });
  });
}

function addListingMarkerForUser(uid, userData, listing) {
  // Add a temporary marker for newly posted listing (so user sees it instantly)
  const lat = userData.lat || myState.lat || 0;
  const lon = userData.lon || myState.lon || 0;
  const marker = L.marker([lat + 0.00005, lon + 0.00003], {
    icon: L.divIcon({ className: 'listing-marker', html: '📌', iconSize: [28,28], iconAnchor: [14,14] })
  }).addTo(listingsLayer);
  marker.bindPopup(buildListingPopupHtml(listing, uid, userData)).openPopup();
  // will be replaced on next usersRef snapshot by rebuildListingsLayer
}

function buildListingPopupHtml(listing, ownerUid, ownerData) {
  const ownerName = ownerData && ownerData.name ? escapeHtml(ownerData.name) : 'Seller';
  return `
    <div style="min-width:200px;">
      <strong>${escapeHtml(listing.itemName)}</strong><br>
      <em>${escapeHtml(listing.category)}</em><br>
      <div style="margin-top:6px;">Contact: ${escapeHtml(listing.contact)}</div>
      <div style="margin-top:8px;">Seller: ${ownerName}</div>
      <div style="margin-top:8px;"><button class="msg-btn-listing" data-uid="${ownerUid}">Message Seller</button></div>
    </div>
  `;
}

/* ---------------- Chat system (direct messages) ---------------- */
/*
  We'll create roomId = joinSorted(u1, u2) so it's unique for pair.
  messages stored under messages/{roomId}/push(...)
*/
function makeRoomId(a,b){
  if(!a || !b) return null;
  return [a,b].sort().join('_');
}

let currentChatTarget = null;
function openDirectChat(targetUid){
  if(!myUid){ alert('Log in to chat'); return; }
  currentChatTarget = targetUid;
  chatModal.classList.remove('hidden');
  const title = (players[targetUid] && players[targetUid].data && players[targetUid].data.name) || targetUid;
  chatWithTitle.textContent = 'Chat with ' + title;
  loadDirectMessages(targetUid);
}

async function loadDirectMessages(targetUid){
  chatWindow.innerHTML = '<div class="small">Loading...</div>';
  const roomId = makeRoomId(myUid, targetUid);
  const roomRef = ref(db, 'messages/' + roomId);
  onValue(roomRef, snapshot => {
    const data = snapshot.val() || {};
    chatWindow.innerHTML = '';
    Object.values(data).forEach(msg => {
      const div = document.createElement('div');
      div.innerHTML = `<strong>${escapeHtml(msg.fromName)}:</strong> ${escapeHtml(msg.text)}`;
      chatWindow.appendChild(div);
    });
    chatWindow.scrollTop = chatWindow.scrollHeight;
  });
}

sendChatBtn.addEventListener('click', async () => {
  const text = (chatInput.value || '').trim();
  if(!text || !currentChatTarget) return;
  const roomId = makeRoomId(myUid, currentChatTarget);
  const roomRef = ref(db, 'messages/' + roomId);
  const newRef = push(roomRef);
  await set(newRef, {
    from: myUid,
    fromName: displayNameElText(),
    to: currentChatTarget,
    text,
    timestamp: Date.now()
  });
  chatInput.value = '';
});

closeChatBtn.addEventListener('click', ()=> {
  chatModal.classList.add('hidden');
  currentChatTarget = null;
});

/* ---------------- UI helpers ---------------- */
function updateUI() {
  document.getElementById('displayName').textContent = myState.name || 'You';
  myAvatarImg.src = myState.avatarDataUrl || 'assets/avatar-default.png';
  try { myMarker.setIcon(createAvatarIcon(myState.avatarDataUrl || 'assets/avatar-default.png', 48)); } catch(e){}
  balanceEl.textContent = myState.balance ?? 0;
}

/* ---------------- small util funcs ---------------- */
function escapeHtml(s){
  if(!s && s !== 0) return '';
  return String(s).replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

/* ---------------- initial load fallback from localStorage (keeps your previous behavior) ---------------- */
const SAVE_KEY = 'snapmap-lite-v1';
function loadState(){
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if(!raw) return;
    const obj = JSON.parse(raw);
    myState = Object.assign(myState, obj);
    updateUI();
  } catch(e){}
}
function saveStateLocal(){ localStorage.setItem(SAVE_KEY, JSON.stringify(myState)); }
window.addEventListener('beforeunload', saveStateLocal);
loadState();


















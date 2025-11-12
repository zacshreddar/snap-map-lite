// SnapMap Lite — client-only demo
// Put this file at js/app.js

const mapEl = document.getElementById('map');
const statusEl = document.getElementById('status') || { textContent: '' };
const displayName = document.getElementById('displayName');
const myAvatarImg = document.getElementById('myAvatar');
const avatarInput = document.getElementById('avatarInput');
const balanceEl = document.getElementById('balance');
const toggleSimBtn = document.getElementById('toggleSim');
const spawnItemBtn = document.getElementById('spawnItem');
const openInventoryBtn = document.getElementById('openInventory');
const inventoryModal = document.getElementById('inventoryModal');
const inventoryList = document.getElementById('inventoryList');
const closeInventory = document.getElementById('closeInventory');
const sellAllBtn = document.getElementById('sellAll');

let myState = {
  id: 'me-' + Math.random().toString(36).slice(2,9),
  name: 'You',
  avatarDataUrl: myAvatarImg.src,
  lat: 0, lon: 0,
  balance: 100,
  inventory: []
};

// Initialize map
const map = L.map('map', { center: [0,0], zoom: 2 });
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Custom marker render (avatar as image inside divIcon)
function createAvatarIcon(dataUrl, size = 48) {
  return L.divIcon({
    className: 'custom-avatar',
    html: `<img src="${dataUrl}" width="${size}" height="${size}" style="border-radius:50%;object-fit:cover"/>`,
    iconSize: [size, size],
    iconAnchor: [size/2, size/2]
  });
}

// My marker
let myMarker = L.marker([0,0], {icon: createAvatarIcon(myState.avatarDataUrl, 48)}).addTo(map);
myMarker.bindPopup(() => `<strong>${myState.name}</strong>`);

// Simulated friends (demo)
let simEnabled = true;
const simFriends = [];
function spawnSimFriends(n=4) {
  // create a few simulated friends around random locations
  for (let i=0;i<n;i++){
    const lat = (Math.random()*140) - 70;
    const lon = (Math.random()*360) - 180;
    const id = 'sim-' + Math.random().toString(36).slice(2,7);
    const avatar = `https://api.dicebear.com/6.x/thumbs/svg?seed=${id}`; // public avatar generator
    const marker = L.marker([lat, lon], {icon: createAvatarIcon(avatar, 40)}).addTo(map);
    marker._data = { id, name: 'Friend ' + (i+1), avatar, marker };
    marker.bindPopup(`<strong>Friend ${i+1}</strong>`);
    simFriends.push(marker);
  }
}
spawnSimFriends(3);

// Toggle sim friend movement
let simTimer = null;
function startSimMovement(){
  if(simTimer) return;
  simTimer = setInterval(() => {
    simFriends.forEach(m => {
      const cur = m.getLatLng();
      const newLat = cur.lat + (Math.random()-0.5)*0.01;
      const newLon = cur.lng + (Math.random()-0.5)*0.01;
      m.setLatLng([newLat, newLon]);
    });
  }, 2000);
}
function stopSimMovement(){
  if(simTimer){ clearInterval(simTimer); simTimer = null; }
}
if(simEnabled) startSimMovement();

// Items (game) — markers with buy price
const itemsLayer = L.layerGroup().addTo(map);
function spawnItemAt(lat, lon) {
  const id = 'item-' + Math.random().toString(36).slice(2,8);
  const price = Math.floor(Math.random()*50) + 10;
  const marker = L.marker([lat,lon], {
    icon: L.divIcon({className:'item-marker', html: '🎁', iconSize:[36,36], iconAnchor:[18,18]})
  }).addTo(itemsLayer);
  marker._data = { id, price };
  marker.bindPopup(`<div>Item — $${price} <br><button class="buy-btn" data-id="${id}">Buy</button></div>`);
  marker.on('popupopen', () => {
    // attach handler
    setTimeout(() => {
      const btn = document.querySelector(`.buy-btn[data-id="${id}"]`);
      if(btn) btn.onclick = () => buyItem(marker);
    }, 50);
  });
}

function buyItem(marker) {
  const item = marker._data;
  if (!item) return;
  if (myState.balance < item.price) {
    alert('Not enough balance (demo).');
    return;
  }
  // Deduct and add to inventory (client-only)
  myState.balance -= item.price;
  myState.inventory.push({ id: item.id, price: item.price, boughtAt: Date.now() });
  balanceEl.textContent = myState.balance.toFixed(2);
  itemsLayer.removeLayer(marker);
  alert('Purchased item for $' + item.price + ' (demo). It’s now in your inventory.');
}

// spawn item button: spawn near my position
spawnItemBtn.addEventListener('click', () => {
  const lat = myState.lat + (Math.random()-0.5)*0.01;
  const lon = myState.lon + (Math.random()-0.5)*0.01;
  spawnItemAt(lat, lon);
});

// Inventory modal
openInventoryBtn.addEventListener('click', showInventory);
closeInventory.addEventListener('click', () => inventoryModal.classList.add('hidden'));
function showInventory() {
  inventoryModal.classList.remove('hidden');
  inventoryList.innerHTML = '';
  if (myState.inventory.length === 0) {
    inventoryList.innerHTML = '<div class="small">(empty)</div>';
    return;
  }
  myState.inventory.forEach(it => {
    const el = document.createElement('div');
    el.className = 'inventory-item';
    el.innerHTML = `<div>${it.id}</div><div>$${it.price}</div>`;
    inventoryList.appendChild(el);
  });
}
sellAllBtn.addEventListener('click', () => {
  if (myState.inventory.length === 0) return alert('Nothing to sell.');
  // Sell at 50% demo
  const total = myState.inventory.reduce((s,x)=>s+x.price,0);
  const gained = Math.floor(total * 0.5);
  myState.balance += gained;
  myState.inventory = [];
  balanceEl.textContent = myState.balance.toFixed(2);
  alert('Sold all items for $' + gained + ' (demo).');
  showInventory();
});

// Avatar upload
avatarInput.addEventListener('change', (e) => {
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    myState.avatarDataUrl = r.result;
    myAvatarImg.src = r.result;
    myMarker.setIcon(createAvatarIcon(myState.avatarDataUrl, 48));
  };
  r.readAsDataURL(f);
});

// Toggle sim friends
toggleSimBtn.addEventListener('click', () => {
  simEnabled = !simEnabled;
  if (simEnabled) { startSimMovement(); toggleSimBtn.textContent = 'Toggle Sim Friends'; }
  else { stopSimMovement(); toggleSimBtn.textContent = 'Sim Friends Paused'; }
});

// Live location (watchPosition)
function successLoc(pos) {
  const lat = pos.coords.latitude;
  const lon = pos.coords.longitude;
  myState.lat = lat; myState.lon = lon;
  myMarker.setLatLng([lat,lon]);
  map.setView([lat,lon], 15);
  document.getElementById('status').textContent = `Lat:${lat.toFixed(5)} Lon:${lon.toFixed(5)} (±${pos.coords.accuracy}m)`;
}
function errorLoc(err) {
  document.getElementById('status').textContent = 'Location error: ' + err.message;
}
if (navigator.geolocation) {
  navigator.geolocation.watchPosition(successLoc, errorLoc, { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 });
} else {
  alert('Geolocation not supported by your browser.');
}

// Click map to spawn a free item (demo)
map.on('click', (ev) => {
  spawnItemAt(ev.latlng.lat, ev.latlng.lng);
});

// Simple persistence across reloads (localStorage demo)
const SAVE_KEY = 'snapmap-lite-v1';
function saveState() {
  const s = JSON.stringify(myState);
  localStorage.setItem(SAVE_KEY, s);
}
function loadState() {
  try {
    const s = localStorage.getItem(SAVE_KEY);
    if (!s) return;
    const obj = JSON.parse(s);
    myState = Object.assign(myState, obj);
    balanceEl.textContent = myState.balance.toFixed(2);
    myAvatarImg.src = myState.avatarDataUrl;
    myMarker.setIcon(createAvatarIcon(myState.avatarDataUrl, 48));
  } catch(e){}
}
window.addEventListener('beforeunload', saveState);
loadState();

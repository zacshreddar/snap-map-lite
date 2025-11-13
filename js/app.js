// js/app.js (SnapMap Lite — cleaned & enhanced)

// Firebase imports
import { 
  signInWithEmailAndPassword, createUserWithEmailAndPassword, 
  onAuthStateChanged, signOut 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

import { ref, set, update, onValue, push } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
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
  filterCategory: document.getElementById('filterCategory')
};

// ---------------- Firebase ----------------
const auth = window.firebaseAuth;
const db = window.firebaseDB;

// ---------------- App State ----------------
let myUid = null;
let myState = {
  id: null,
  name: 'You',
  avatarDataUrl: 'assets/default-profile.png', // default profile picture
  lat: 0,
  lon: 0,
  balance: 100,
  inventory: []
};
let players = {};
let currentChatTarget = null;

// ---------------- Map ----------------
const map = L.map('map', { center: [0, 0], zoom: 2 });
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
const itemsLayer = L.layerGroup().addTo(map);
const listingsLayer = L.markerClusterGroup().addTo(map);

// ---------------- Category icons ----------------
const categoryIcons = {
  'Weed': { emoji: '🌿', color: '#2ecc71' },
  'Liquor': { emoji: '🥃', color: '#e67e22' },
  'Car Hire': { emoji: '🚗', color: '#3498db' },
  'Street Food': { emoji: '🌮', color: '#e74c3c' },
  'Fresh Produce': { emoji: '🍎', color: '#27ae60' },
  'Homemade Meals': { emoji: '🍲', color: '#d35400' },
  'Snacks & Soft Drinks': { emoji: '🥤', color: '#f39c12' },
  'Coffee / Juice Stands': { emoji: '☕', color: '#8e44ad' },
  'Default': { emoji: '📌', color: '#34495e' }
};
function getCategoryIcon(category) { return categoryIcons[category] || categoryIcons['Default']; }

// ---------------- Helpers ----------------
function displayNameText() { return (DOM.displayName?.textContent || 'You').trim(); }
function escapeHtml(s) { if(!s && s!==0) return ''; return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function createAvatarIcon(dataUrl, size = 48) {
  return L.divIcon({ className: 'custom-avatar', html: `<img src="${dataUrl}" width="${size}" height="${size}" style="border-radius:50%;object-fit:cover"/>`, iconSize: [size, size], iconAnchor: [size/2, size/2] });
}
function makeRoomId(a, b) { if(!a||!b) return null; return [a,b].sort().join('_'); }

// ---------------- User Marker ----------------
let myMarker = L.marker([0,0], { icon:createAvatarIcon(myState.avatarDataUrl,48) }).addTo(map);
myMarker.bindPopup(()=>`<strong>${displayNameText()}</strong>`);

// ---------------- Auth ----------------
DOM.loginBtn.addEventListener('click', ()=>DOM.loginModal.classList.remove('hidden'));
DOM.closeLoginBtn.addEventListener('click', ()=>DOM.loginModal.classList.add('hidden'));

DOM.signInBtn.addEventListener('click', async ()=>{
  const email=DOM.emailInput.value.trim(), pass=DOM.passwordInput.value.trim();
  if(!email||!pass){ DOM.authError.textContent='Enter email and password'; return; }
  try{ 
    await signInWithEmailAndPassword(auth,email,pass);
    DOM.loginModal.classList.add('hidden'); 
    DOM.authError.textContent=''; 
  } catch(err){ DOM.authError.textContent=err.message; }
});

DOM.signUpBtn.addEventListener('click', async ()=>{
  const email=DOM.emailInput.value.trim(), pass=DOM.passwordInput.value.trim();
  if(!email||!pass){ DOM.authError.textContent='Enter email and password'; return; }
  try{
    const cred = await createUserWithEmailAndPassword(auth,email,pass);
    const uid = cred.user.uid;
    await set(ref(db,'users/'+uid), { name:displayNameText(), avatarDataUrl:myState.avatarDataUrl, lat:0, lon:0, balance:100, inventory:[] });
    DOM.loginModal.classList.add('hidden'); DOM.authError.textContent='';
  } catch(err){ DOM.authError.textContent=err.message; }
});

DOM.logoutBtn.addEventListener('click', async()=>{ await signOut(auth); });

// ---------------- On Auth State ----------------
onAuthStateChanged(auth,user=>{
  if(user){
    myUid=user.uid; myState.id=myUid;
    document.getElementById('authStatus').textContent=`Logged in: ${user.email||myUid}`;
    DOM.loginBtn.style.display='none'; DOM.logoutBtn.style.display='inline-block';
    document.body.classList.add('map-only');

    const myRef = ref(db,'users/'+myUid);
    onValue(myRef,snapshot=>{
      const data=snapshot.val();
      if(data){ Object.assign(myState,data); updateUI(); } 
      else{ set(myRef, { name:displayNameText(), avatarDataUrl:myState.avatarDataUrl, lat:myState.lat, lon:myState.lon, balance:myState.balance, inventory:myState.inventory }); }
    });

    const usersRef = ref(db,'users');
    onValue(usersRef,snapshot=>{
      const all = snapshot.val()||{};
      Object.keys(players).forEach(uid=>{ if(!all[uid]){ try{ map.removeLayer(players[uid].marker); }catch(e){} delete players[uid]; }});
      Object.entries(all).forEach(([uid,data])=>{
        if(uid===myUid) return;
        if(players[uid]){
          players[uid].data=data;
          try{ players[uid].marker.setLatLng([data.lat||0,data.lon||0]); players[uid].marker.setIcon(createAvatarIcon(data.avatarDataUrl||'assets/default-profile.png',40)); }catch(e){}
        } else {
          const marker = L.marker([data.lat||0,data.lon||0],{ icon:createAvatarIcon(data.avatarDataUrl||'assets/default-profile.png',40) }).addTo(map);
          marker.bindPopup(()=>{ 
            let html=`<strong>${escapeHtml(data.name||'Player')}</strong><br>`;
            if(data.inventory?.length){
              html+='<hr><strong>Listings</strong><br>';
              data.inventory.slice().reverse().forEach(it=>{
                html+=`<div class="listing-row"><strong>${escapeHtml(it.itemName)}</strong> <em>(${escapeHtml(it.category)})</em><br>Contact: ${escapeHtml(it.contact)}<br><button class="msg-btn" data-uid="${uid}">Message</button><hr></div>`;
              });
            } else html+='<em>No listings</em>';
            return html;
          });
          marker.on('popupopen',()=>{ setTimeout(()=>{ const btns=document.querySelectorAll('.msg-btn'); btns.forEach(b=>b.onclick=()=>openDirectChat(b.getAttribute('data-uid'))); },50); });
          players[uid]={ marker,data };
        }
      });
      rebuildListingsLayer(all);
    });

  } else {
    myUid=null; document.getElementById('authStatus').textContent='Not logged in';
    DOM.loginBtn.style.display='inline-block'; DOM.logoutBtn.style.display='none';
    document.body.classList.remove('map-only');
    Object.keys(players).forEach(uid=>{ try{ map.removeLayer(players[uid].marker); }catch(e){} delete players[uid]; });
    listingsLayer.clearLayers();
  }
});

// ---------------- Save user ----------------
function saveUserData(){ if(!myUid) return; set(ref(db,'users/'+myUid), { name:displayNameText(), avatarDataUrl:myState.avatarDataUrl, lat:myState.lat, lon:myState.lon, balance:myState.balance, inventory:myState.inventory }).catch(e=>console.error('saveUserData err',e)); }
function saveLocation(){ if(!myUid) return; update(ref(db,'users/'+myUid),{lat:myState.lat,lon:myState.lon}).catch(e=>{}); }

// ---------------- Geolocation ----------------
function successLoc(pos){ 
  const lat=pos.coords.latitude, lon=pos.coords.longitude; 
  myState.lat=lat; myState.lon=lon; 
  myMarker.setLatLng([lat,lon]); 
  map.setView([lat,lon],15); 
  DOM.statusEl.textContent=`Lat:${lat.toFixed(5)} Lon:${lon.toFixed(5)} (±${pos.coords.accuracy}m)`; 
  saveLocation(); 
}
function errorLoc(err){ DOM.statusEl.textContent='Location error: '+err.message; }
if(navigator.geolocation) navigator.geolocation.watchPosition(successLoc,errorLoc,{enableHighAccuracy:true,maximumAge:2000,timeout:15000}); else alert('Geolocation not supported.');

// ---------------- Inventory & Listings ----------------
populateCategoriesSelect();
populateFilterCategories();

// The rest of inventory/listing logic stays unchanged...


















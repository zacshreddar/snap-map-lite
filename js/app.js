// js/app.js (SnapMap Lite — full version, enhanced with category icons, filter & clustering)
// Requires js/categories.js (exported `categories`)

import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { ref, set, update, onValue, push, get } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
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
  filterCategory: document.getElementById('filterCategory')
};

// ---------------- Firebase ----------------
const auth = window.firebaseAuth;
const db = window.firebaseDB;

// ---------------- App State ----------------
let myUid = null;
let myState = { id: null, name: 'You', avatarDataUrl: DOM.myAvatarImg.src, lat: 0, lon: 0, balance: 100, inventory: [] };
let players = {};
let currentChatTarget = null;

// ---------------- Map ----------------
const map = L.map('map', { center: [0,0], zoom: 2 });
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
function getCategoryIcon(category){ return categoryIcons[category] || categoryIcons['Default']; }

// ---------------- Helpers ----------------
function displayNameText(){ return (DOM.displayName?.textContent || 'You').trim(); }
function escapeHtml(s){ if(!s && s!==0) return ''; return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function createAvatarIcon(dataUrl,size=48){ return L.divIcon({ className:'custom-avatar', html:`<img src="${dataUrl}" width="${size}" height="${size}" style="border-radius:50%;object-fit:cover"/>`, iconSize:[size,size], iconAnchor:[size/2,size/2] }); }
function makeRoomId(a,b){ if(!a||!b) return null; return [a,b].sort().join('_'); }

// ---------------- User Marker ----------------
let myMarker = L.marker([0,0], { icon:createAvatarIcon(myState.avatarDataUrl,48) }).addTo(map);
myMarker.bindPopup(()=>`<strong>${displayNameText()}</strong>`);

// ---------------- Auth ----------------
DOM.loginBtn.addEventListener('click',()=>DOM.loginModal.classList.remove('hidden'));
DOM.closeLoginBtn.addEventListener('click',()=>DOM.loginModal.classList.add('hidden'));

DOM.signInBtn.addEventListener('click',async ()=>{
  const email=DOM.emailInput.value.trim(), pass=DOM.passwordInput.value.trim();
  if(!email||!pass){ DOM.authError.textContent='Enter email and password'; return; }
  try{ await signInWithEmailAndPassword(auth,email,pass); DOM.loginModal.classList.add('hidden'); DOM.authError.textContent=''; } 
  catch(err){ DOM.authError.textContent=err.message; }
});

DOM.signUpBtn.addEventListener('click',async ()=>{
  const email=DOM.emailInput.value.trim(), pass=DOM.passwordInput.value.trim();
  if(!email||!pass){ DOM.authError.textContent='Enter email and password'; return; }
  try{
    const cred = await createUserWithEmailAndPassword(auth,email,pass);
    const uid=cred.user.uid;
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
          try{ players[uid].marker.setLatLng([data.lat||0,data.lon||0]); players[uid].marker.setIcon(createAvatarIcon(data.avatarDataUrl||'assets/avatar-default.png',40)); }catch(e){}
        } else {
          const marker = L.marker([data.lat||0,data.lon||0],{ icon:createAvatarIcon(data.avatarDataUrl||'assets/avatar-default.png',40) }).addTo(map);
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

// ---------------- Avatar upload ----------------
DOM.avatarInput.addEventListener('change',e=>{
  const f=e.target.files?.[0]; if(!f) return;
  const reader = new FileReader();
  reader.onload = ()=>{ myState.avatarDataUrl=reader.result; DOM.myAvatarImg.src=reader.result; try{ myMarker.setIcon(createAvatarIcon(myState.avatarDataUrl,48)); }catch(e){} saveUserData(); };
  reader.readAsDataURL(f);
});

// ---------------- Geolocation ----------------
function successLoc(pos){ const lat=pos.coords.latitude, lon=pos.coords.longitude; myState.lat=lat; myState.lon=lon; myMarker.setLatLng([lat,lon]); map.setView([lat,lon],15); DOM.statusEl.textContent=`Lat:${lat.toFixed(5)} Lon:${lon.toFixed(5)} (±${pos.coords.accuracy}m)`; saveLocation(); }
function errorLoc(err){ DOM.statusEl.textContent='Location error: '+err.message; }
if(navigator.geolocation) navigator.geolocation.watchPosition(successLoc,errorLoc,{enableHighAccuracy:true,maximumAge:2000,timeout:15000}); else alert('Geolocation not supported.');

// ---------------- Items ----------------
DOM.spawnItemBtn.addEventListener('click',()=>{ const lat=myState.lat+(Math.random()-0.5)*0.01, lon=myState.lon+(Math.random()-0.5)*0.01; spawnItemAt(lat,lon); });
map.on('click',ev=>spawnItemAt(ev.latlng.lat,ev.latlng.lng));
function spawnItemAt(lat,lon){ const id='item-'+Math.random().toString(36).slice(2,8); const price=Math.floor(Math.random()*50)+10; const marker=L.marker([lat,lon],{icon:L.divIcon({className:'item-marker',html:'🎁',iconSize:[36,36],iconAnchor:[18,18]})}).addTo(itemsLayer); marker._data={id,price}; marker.bindPopup(`<div>Item — $${price} <br><button class="buy-btn" data-id="${id}">Buy</button></div>`); marker.on('popupopen',()=>{ setTimeout(()=>{ const btn=document.querySelector(`.buy-btn[data-id="${id}"]`); if(btn) btn.onclick=()=>alert('This demo does not perform real purchases.'); },60); }); }

// ---------------- Inventory & Listings ----------------
populateCategoriesSelect();
populateFilterCategories();

DOM.openInventoryBtn.addEventListener('click',()=>{ DOM.inventoryModal.classList.remove('hidden'); renderInventory(); });
DOM.closeInventory.addEventListener('click',()=>DOM.inventoryModal.classList.add('hidden'));
DOM.sellAllBtn.addEventListener('click',()=>{ if(!confirm('Clear all your listings?')) return; myState.inventory=[]; saveUserData(); renderInventory(); });
DOM.openListingModalBtn.addEventListener('click',()=>{ if(!myUid){ alert('Log in first'); return; } DOM.listingModal.classList.remove('hidden'); });
DOM.closeListingBtn.addEventListener('click',()=>DOM.listingModal.classList.add('hidden'));
DOM.submitListingBtn.addEventListener('click',()=>{
  if(!myUid){ alert('Log in first'); return; }
  const name=DOM.listingNameInput.value.trim(), cat=DOM.listingCategory.value, contact=DOM.listingContactInput.value.trim();
  if(!name||!contact){ alert('Fill all fields'); return; }
  const newListing={ itemName:name, category:cat, contact, createdAt:Date.now() };
  myState.inventory=myState.inventory||[]; myState.inventory.push(newListing); saveUserData(); addListingMarkerForUser(myUid,myState,newListing);
  DOM.listingNameInput.value=''; DOM.listingContactInput.value=''; DOM.listingModal.classList.add('hidden'); renderInventory();
});

function renderInventory(){
  DOM.inventoryList.innerHTML='';
  const inv=myState.inventory||[];
  if(inv.length===0){ DOM.inventoryList.innerHTML='<div class="small">(no listings)</div>'; return; }
  inv.slice().reverse().forEach((it,idx)=>{ 
    const el=document.createElement('div'); el.className='inventory-item'; 
    el.innerHTML=`<strong>${escapeHtml(it.itemName)}</strong> <em>(${escapeHtml(it.category)})</em><br>Contact: ${escapeHtml(it.contact)}<br><button class="remove-listing-btn" data-idx="${idx}">Remove</button>`; 
    DOM.inventoryList.appendChild(el); 
  });
  setTimeout(()=>{ const btns=DOM.inventoryList.querySelectorAll('.remove-listing-btn'); btns.forEach(b=>b.onclick=()=>{ const idx=parseInt(b.getAttribute('data-idx'),10); const realIdx=myState.inventory.length-1-idx; myState.inventory.splice(realIdx,1); saveUserData(); renderInventory(); }); },50);
}

function addListingMarkerForUser(uid,userData,listing){ 
  const lat=userData.lat||myState.lat||0, lon=userData.lon||myState.lon||0; 
  const catIcon = getCategoryIcon(listing.category);
  const marker=L.marker([lat+0.00005, lon+0.00003],{
    icon:L.divIcon({className:'listing-marker',html:`<div style="font-size:24px;color:${catIcon.color}">${catIcon.emoji}</div>`,iconSize:[28,28],iconAnchor:[14,14]})
  }).addTo(listingsLayer); 
  marker.bindPopup(buildListingPopupHtml(listing,uid,userData)).openPopup(); 
}

function rebuildListingsLayer(allUsersObj){
  listingsLayer.clearLayers();
  if(!allUsersObj) return;
  const filterCat = DOM.filterCategory?.value || '';
  Object.entries(allUsersObj).forEach(([uid,userData])=>{
    if(!userData?.inventory?.length) return;
    const baseLat=userData.lat||0, baseLon=userData.lon||0;
    userData.inventory.forEach((it,idx)=>{
      if(filterCat && it.category !== filterCat) return;
      const offset=(idx%5)*0.00007, lat=baseLat+offset, lon=baseLon+((Math.floor(idx/5)%5)*0.00007);
      const catIcon = getCategoryIcon(it.category);
      const marker = L.marker([lat,lon],{
        icon:L.divIcon({className:'listing-marker',html:`<div style="font-size:24px;color:${catIcon.color}">${catIcon.emoji}</div>`,iconSize:[28,28],iconAnchor:[14,14]})
      }).addTo(listingsLayer);
      marker.bindPopup(buildListingPopupHtml(it,uid,userData));
    });
  });
}

function buildListingPopupHtml(listing,ownerUid,ownerData){ 
  const ownerName=ownerData?.name?escapeHtml(ownerData.name):'Seller'; 
  return `<div style="min-width:200px;"><strong>${escapeHtml(listing.itemName)}</strong><br><em>${escapeHtml(listing.category)}</em><br><div style="margin-top:6px;">Contact: ${escapeHtml(listing.contact)}</div><div style="margin-top:8px;">Seller: ${ownerName}</div><div style="margin-top:8px;"><button class="msg-btn-listing" data-uid="${ownerUid}">Message Seller</button></div></div>`; 
}

// ---------------- Chat ----------------
DOM.sendChatBtn.addEventListener('click',sendMessage);
DOM.closeChatBtn.addEventListener('click',()=>{ DOM.chatModal.classList.add('hidden'); currentChatTarget=null; });

function openDirectChat(targetUid){ if(!myUid){ alert('Log in to chat'); return; } currentChatTarget=targetUid; DOM.chatModal.classList.remove('hidden'); DOM.chatWithTitle.textContent='Chat with '+(players[targetUid]?.data?.name||targetUid); loadDirectMessages(targetUid); }

function sendMessage(){ 
  if(!currentChatTarget) return; 
  const msg=DOM.chatInput.value.trim(); 
  if(!msg) return; 
  const roomId=makeRoomId(myUid,currentChatTarget); 
  push(ref(db,'chats/'+roomId),{ from:myUid, to:currentChatTarget, text:msg, ts:Date.now() }); 
  DOM.chatInput.value=''; 
}

function loadDirectMessages(targetUid){ 
  const roomId=makeRoomId(myUid,targetUid); 
  const chatRef=ref(db,'chats/'+roomId); 
  onValue(chatRef,snap=>{
    const msgs=snap.val()||{}; 
    DOM.chatWindow.innerHTML=''; 
    Object.values(msgs).forEach(m=>{ const div=document.createElement('div'); div.className='chat-msg '+(m.from===myUid?'me':'them'); div.textContent=m.text; DOM.chatWindow.appendChild(div); });
    DOM.chatWindow.scrollTop=DOM.chatWindow.scrollHeight;
  });
}

// ---------------- Categories select ----------------
function populateCategoriesSelect(){
  if(!DOM.listingCategory) return;
  DOM.listingCategory.innerHTML=''; categories.forEach(c=>{ const opt=document.createElement('option'); opt.value=c; opt.textContent=c; DOM.listingCategory.appendChild(opt); });
}

// ---------------- Filter select ----------------
function populateFilterCategories(){
  if(!DOM.filterCategory) return;
  DOM.filterCategory.innerHTML='<option value="">All</option>';
  categories.forEach(c=>{ const opt=document.createElement('option'); opt.value=c; opt.textContent=c; DOM.filterCategory.appendChild(opt); });
  DOM.filterCategory.addEventListener('change',()=>{ rebuildListingsLayer(playersToPlainObj()); });
}

function playersToPlainObj(){ const obj={}; Object.entries(players).forEach(([uid,v])=>{ obj[uid]=v.data; }); if(myUid) obj[myUid]=myState; return obj; }

// ---------------- UI Updates ----------------
function updateUI(){ if(DOM.balanceEl) DOM.balanceEl.textContent='$'+(myState.balance||0); if(DOM.displayName) DOM.displayName.textContent=myState.name||'You'; }










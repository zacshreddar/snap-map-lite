// js/app.js (FINAL UPDATED VERSION for Google Maps and Login-Based Marker)

import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { ref, set, update, onValue, push } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
import { categories } from './categories.js'; // simple categories list

// Firebase references created in index.html
const auth = window.firebaseAuth;
const db = window.firebaseDB;
const onAuthStateChanged = window.onAuthStateChanged; // Exposed globally in index.html
// const storage = window.firebaseStorage; // not used heavily yet

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
// const balanceEl = document.getElementById('balance'); // Balance element is not in the provided HTML/CSS
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

let players = {}; // uid -> { data } (used for player data lookup)
let simEnabled = true;

/* ---------------- GOOGLE MAP INTEGRATION ---------------- */
let googleMap;
let myCharacterMarker = null; // Your character marker
let playerMarkers = {}; // Stores all other players' markers (uid -> marker)
let allListingMarkers = []; // Array to store all listing markers
let simFriendMarkers = []; // Stores simulated friend markers

const DEFAULT_CENTER = { lat: 0, lng: 0 };
const DEFAULT_ZOOM = 2;

// The 'callback' function called by the Google Maps API script tag
window.initMap = function() {
    console.log("Google Map initializing...");
    
    // 1. Initialize the Map
    googleMap = new google.maps.Map(document.getElementById('map'), {
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        mapId: 'DEMO_MAP_ID' 
    });

    // 2. Start Geolocation
    if (navigator.geolocation) {
        navigator.geolocation.watchPosition(
            successLoc, 
            errorLoc, 
            { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 }
        );
    } else {
        statusEl.textContent = 'Geolocation not supported by your browser.';
    }

    // 3. Set up click listener for item spawning 
    googleMap.addListener('click', (mapsMouseEvent) => {
      spawnItemAt(mapsMouseEvent.latLng.lat(), mapsMouseEvent.latLng.lng());
    });

    // 4. Initial Sim Spawn
    if(simEnabled) spawnSimFriends(3);
};

// helper for avatar icons (returns Google Maps Icon object)
function createAvatarIcon(dataUrl, size = 48) {
    return {
        url: dataUrl,
        scaledSize: new google.maps.Size(size, size),
        anchor: new google.maps.Point(size/2, size/2)
    };
}

// helper for listing pins (Google Maps Icon)
const listingPinIcon = {
  url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%234285F4"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>',
  scaledSize: new google.maps.Size(30, 30),
  anchor: new google.maps.Point(15, 30) // Anchor at the bottom center
};


/* ---------------- Simulated friends (Adapted for Google Maps) ---------------- */
function spawnSimFriends(n = 3) {
    if(!googleMap) return;
    simFriendMarkers = []; // Clear old sim markers
    for (let i=0;i<n;i++){
        const lat = (Math.random()*140)-70;
        const lng = (Math.random()*360)-180;
        const id = 'sim-' + Math.random().toString(36).slice(2,7);
        const avatar = `https://api.dicebear.com/6.x/thumbs/svg?seed=${id}`;
        
        // Create Google Maps Marker
        const m = new google.maps.Marker({
            position: { lat, lng },
            map: googleMap,
            icon: createAvatarIcon(avatar, 40)
        });

        m._data = { id, name: 'Friend ' + (i+1), avatar };
        m.addListener('click', () => {
            new google.maps.InfoWindow({ content: `<strong>Friend ${i+1} (Simulated)</strong>` }).open(googleMap, m);
        });
        simFriendMarkers.push(m);
    }
    if(simEnabled) startSimMovement();
}

let simTimer = null;
function startSimMovement(){
    if(simTimer) return;
    simTimer = setInterval(()=> {
        simFriendMarkers.forEach(m => {
            const cur = m.getPosition();
            const newLat = cur.lat() + (Math.random()-0.5)*0.01;
            const newLng = cur.lng() + (Math.random()-0.5)*0.01;
            m.setPosition({ lat: newLat, lng: newLng });
        });
    }, 2000);
}

function stopSimMovement(){ 
    if(simTimer){ clearInterval(simTimer); simTimer = null; } 
    simFriendMarkers.forEach(m => m.setMap(null)); // Remove all sim friends
    simFriendMarkers.length = 0; // Clear the array
}

toggleSimBtn.addEventListener('click', () => {
    simEnabled = !simEnabled;
    toggleSimBtn.textContent = simEnabled ? 'Sim Friends' : 'Sim Off';
    if (simEnabled) {
        spawnSimFriends(3);
    } else {
        stopSimMovement();
    }
});


/* ---------------- Populate categories select (UNMODIFIED) ---------------- */
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

/* ---------------- Firebase: Auth handlers (UNMODIFIED) ---------------- */
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

/* ---------------- Utility to read displayName DOM (UNMODIFIED) */
function displayNameElText(){ return (document.getElementById('displayName')?.textContent || 'You').trim(); }

/* ---------------- OnAuthStateChanged: set up listeners for user data + players list ---------------- */
onAuthStateChanged(auth, async user => {
    if(user){
        // --- USER LOGGED IN ---
        myUid = user.uid;
        myState.id = myUid;
        document.getElementById('authStatus').textContent = `Logged in: ${user.email || myUid}`;
        loginBtn.style.display = 'none';
        logoutBtn.style.display = 'inline-block';

        // SHOW CHARACTER MARKER
        showMyCharacterMarker();
        
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
            
            // 1. Remove markers for players missing
            Object.keys(playerMarkers).forEach(uid => {
                if(!all[uid]) { // removed
                    playerMarkers[uid].setMap(null);
                    delete playerMarkers[uid];
                }
            });

            // 2. Update/add players
            Object.entries(all).forEach(([uid, data]) => {
                if(uid === myUid) return; // skip self (we handle own marker separately)
                const position = { lat: data.lat || 0, lng: data.lon || 0 };
                players[uid] = { data }; // Store data for chat lookup
                
                if(playerMarkers[uid]) {
                    // update existing player marker
                    playerMarkers[uid].setPosition(position);
                    playerMarkers[uid].setIcon(createAvatarIcon(data.avatarDataUrl || 'assets/avatar-default.png', 40));
                } else {
                    // create new player marker
                    const marker = new google.maps.Marker({
                        position: position,
                        map: googleMap,
                        icon: createAvatarIcon(data.avatarDataUrl || 'assets/avatar-default.png', 40)
                    });

                    // Attach click listener for InfoWindow (Popup)
                    marker.addListener('click', () => {
                        const infoWindow = new google.maps.InfoWindow({ content: buildPlayerPopupHtml(uid, data) });
                        infoWindow.open(googleMap, marker);
                        
                        // Attach message button handlers after InfoWindow is in DOM
                        google.maps.event.addListener(infoWindow, 'domready', () => {
                            const buttons = document.querySelectorAll('.msg-btn');
                            buttons.forEach(b => {
                                b.onclick = () => {
                                    const targetUid = b.getAttribute('data-uid');
                                    openDirectChat(targetUid);
                                };
                            });
                        });
                    playerMarkers[uid] = marker;
                }
            });

            // 3. rebuild listings layer for all users
            rebuildListingsLayer(all);
        });

    } else {
        // --- USER LOGGED OUT ---
        myUid = null;
        document.getElementById('authStatus').textContent = 'Not logged in';
        loginBtn.style.display = 'inline-block';
        logoutBtn.style.display = 'none';

        // HIDE CHARACTER MARKER
        hideMyCharacterMarker();
        
        // remove map-only class so UI returns
        document.body.classList.remove('map-only');

        // remove all other players' markers
        Object.values(playerMarkers).forEach(marker => marker.setMap(null));
        playerMarkers = {};
        
        // clear listings layer
        clearAllListings();
    }
});

function buildPlayerPopupHtml(uid, data) {
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
}

// --- NEW/MODIFIED MARKER FUNCTIONS FOR GOOGLE MAPS ---

function showMyCharacterMarker() {
    if (!googleMap) return;
    const position = { lat: myState.lat, lng: myState.lon };

    if (myCharacterMarker) {
        myCharacterMarker.setPosition(position);
        myCharacterMarker.setIcon(createAvatarIcon(myState.avatarDataUrl, 48));
        myCharacterMarker.setMap(googleMap); // Ensure it is on the map
    } else {
        myCharacterMarker = new google.maps.Marker({
            position: position,
            map: googleMap,
            title: displayNameElText(),
            icon: createAvatarIcon(myState.avatarDataUrl, 48),
        });
        // Attach click listener for InfoWindow (Popup)
        myCharacterMarker.addListener('click', () => {
            new google.maps.InfoWindow({ content: `<strong>${displayNameElText()}</strong>` }).open(googleMap, myCharacterMarker);
        });
    }
    // Ensure map is centered on user after login/marker appearance
    googleMap.setCenter(position);
    googleMap.setZoom(15);
}

function hideMyCharacterMarker() {
    if (myCharacterMarker) {
        myCharacterMarker.setMap(null); // Remove from the map
    }
}

/* ---------------- Save my user object / location (UNMODIFIED) ---------------- */
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

/* update only location quickly (UNMODIFIED) */
function saveLocation(){
    if(!myUid) return;
    update(ref(db, 'users/' + myUid), { lat: myState.lat, lon: myState.lon }).catch(e=>{});
}

/* ---------------- Avatar upload (UNMODIFIED LOGIC) ---------------- */
avatarInput.addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if(!f) return;
    const reader = new FileReader();
    reader.onload = async () => {
        myState.avatarDataUrl = reader.result;
        myAvatarImg.src = reader.result;
        // Update character marker icon
        try { 
            if(myCharacterMarker) myCharacterMarker.setIcon(createAvatarIcon(myState.avatarDataUrl, 48)); 
        } catch(e){}
        saveUserData();
    };
    reader.readAsDataURL(f);
});

/* ---------------- Geolocation -> updates my marker and DB (Adapted for Google Maps) ---------------- */
function successLoc(pos){
    const lat = pos.coords.latitude, lon = pos.coords.longitude;
    myState.lat = lat; myState.lon = lon;
    
    // Update marker position and map view only if logged in
    if(myUid && myCharacterMarker) {
        const position = { lat, lng: lon };
        myCharacterMarker.setPosition(position);
        // Removed map.setView/setCenter here to avoid jitter from watchPosition, 
        // rely on showMyCharacterMarker() for initial center.
    } else if (!myUid && googleMap) {
        // If not logged in, just center the map initially on location (if map is currently at 0,0)
        const currentCenter = googleMap.getCenter();
        if (currentCenter.lat() === 0 && currentCenter.lng() === 0) {
            googleMap.setCenter({ lat, lng: lon });
            googleMap.setZoom(15);
        }
    }
    
    statusEl.textContent = `Lat:${lat.toFixed(5)} Lon:${lon.toFixed(5)} (±${pos.coords.accuracy}m)`;
    saveLocation();
}
function errorLoc(err){
    statusEl.textContent = 'Location error: ' + err.message;
}

/* ---------------- Items (click to spawn) Adapted for Google Maps ---------------- */
let itemMarkers = {}; // uid -> marker
function spawnItemAt(lat, lon) {
    if (!googleMap) return;
    const id = 'item-' + Math.random().toString(36).slice(2,8);
    const price = Math.floor(Math.random()*50)+10;

    // Create Google Maps Marker
    const marker = new google.maps.Marker({
        position: { lat, lng: lon },
        map: googleMap,
        icon: {
            url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23FFC107"><path d="M20 12l-1.41-1.41L13 15.17V4h-2v11.17l-5.59-5.58L4 12l8 8 8-8z"/></svg>', // Simple arrow/gift icon
            scaledSize: new google.maps.Size(30, 30),
            anchor: new google.maps.Point(15, 15)
        }
    });
    itemMarkers[id] = marker;

    // Create InfoWindow (Popup)
    const contentString = `<div>Item — $${price} <br><button class="buy-btn" data-id="${id}">Buy</button></div>`;
    const infoWindow = new google.maps.InfoWindow({ content: contentString });
    
    marker.addListener('click', () => {
        infoWindow.open(googleMap, marker);
    });
    
    // Attach buy button handler after InfoWindow is in DOM
    google.maps.event.addListener(infoWindow, 'domready', () => {
        const btn = document.querySelector(`.buy-btn[data-id="${id}"]`);
        if(btn) btn.onclick = () => alert('This demo does not perform real purchases.');
    });
}
spawnItemBtn.addEventListener('click', () => {
    const lat = myState.lat + (Math.random()-0.5)*0.01;
    const lon = myState.lon + (Math.random()-0.5)*0.01;
    spawnItemAt(lat, lon);
});


/* ---------------- Inventory listing management (UNMODIFIED) ---------------- */
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

/* ---------------- Create listing modal (UNMODIFIED) ---------------- */
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

/* ---------------- Listings layer helpers (Adapted for Google Maps) ---------------- */
function clearAllListings() {
    allListingMarkers.forEach(m => m.setMap(null));
    allListingMarkers = [];
}

function rebuildListingsLayer(allUsersObj) {
    clearAllListings(); // Clear existing markers

    if(!allUsersObj || !googleMap) return;

    Object.entries(allUsersObj).forEach(([uid, userData]) => {
        if(!userData || !userData.inventory || !Array.isArray(userData.inventory)) return;
        
        const baseLat = userData.lat || 0;
        const baseLon = userData.lon || 0;
        
        userData.inventory.forEach((it, idx) => {
            // place each listing slightly offset so multiple listings don't overlap exactly
            const offsetLat = (idx % 5) * 0.00007;
            const offsetLon = ((Math.floor(idx/5) % 5) * 0.00007);
            
            const lat = baseLat + offsetLat;
            const lng = baseLon + offsetLon;

            const marker = new google.maps.Marker({
                position: { lat, lng },
                map: googleMap,
                icon: listingPinIcon // Use the custom pin icon
            });

            // Create InfoWindow
            const infoWindow = new google.maps.InfoWindow({ content: buildListingPopupHtml(it, uid, userData) });

            marker.addListener('click', () => {
                infoWindow.open(googleMap, marker);
            });
            
            // Attach message button handler after InfoWindow is in DOM
            google.maps.event.addListener(infoWindow, 'domready', () => {
                const btn = document.querySelector(`.msg-btn-listing[data-uid="${uid}"]`);
                if(btn) btn.onclick = () => openDirectChat(uid);
            });

            allListingMarkers.push(marker);
        });
    });
}

function addListingMarkerForUser(uid, userData, listing) {
  // Add a temporary marker for newly posted listing (so user sees it instantly)
  if(!googleMap) return;
  const lat = userData.lat || myState.lat || 0;
  const lon = userData.lon || myState.lon || 0;
  
  const marker = new google.maps.Marker({
    position: { lat: lat + 0.00005, lng: lon + 0.00003 },
    map: googleMap,
    icon: listingPinIcon
  });

  const infoWindow = new google.maps.InfoWindow({ content: buildListingPopupHtml(listing, uid, userData) });
  infoWindow.open(googleMap, marker);

  allListingMarkers.push(marker);
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

/* ---------------- Chat system (UNMODIFIED LOGIC) ---------------- */
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

/* ---------------- UI helpers (UNMODIFIED LOGIC) ---------------- */
function updateUI() {
  document.getElementById('displayName').textContent = myState.name || 'You';
  myAvatarImg.src = myState.avatarDataUrl || 'assets/avatar-default.png';
  // Update character marker icon if it exists
  try { 
    if(myCharacterMarker) myCharacterMarker.setIcon(createAvatarIcon(myState.avatarDataUrl || 'assets/avatar-default.png', 48)); 
  } catch(e){}
  // balanceEl.textContent = myState.balance ?? 0;
}

/* ---------------- small util funcs (UNMODIFIED) ---------------- */
function escapeHtml(s){
  if(!s && s !== 0) return '';
  return String(s).replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

/* ---------------- initial load fallback from localStorage (UNMODIFIED) ---------------- */
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


















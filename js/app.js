import { db } from "./firebase.js";
import { collection, addDoc, onSnapshot, serverTimestamp, deleteDoc, doc } from "firebase/firestore";
import { v4 as uuidv4 } from "https://jspm.dev/uuid";
import L from "https://unpkg.com/leaflet@1.9.4/dist/leaflet-src.js";
import "https://unpkg.com/leaflet.heat/dist/leaflet-heat.js";

// Anonymous user ID
const userId = uuidv4();

// Map setup
const map = L.map('map').setView([0,0], 2);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

// Firestore collections
const pinsCol = collection(db, "pins");
const peopleCol = collection(db, "people");

// Heatmap layer
let heat = L.heatLayer([], {radius: 25, blur: 15}).addTo(map);

// Add a pin on map click
map.on('click', async (e) => {
  const text = prompt("Enter your note / vibe:");
  if (!text) return;

  const vibeColor = prompt("Vibe color: red, blue, green (default red)") || "red";

  await addDoc(pinsCol, {
    lat: e.latlng.lat,
    lng: e.latlng.lng,
    text,
    color: vibeColor,
    createdAt: serverTimestamp()
  });
});

// Real-time pins & heatmap
onSnapshot(pinsCol, (snapshot) => {
  map.eachLayer(layer => { if (layer.options && layer.options.radius) map.removeLayer(layer); }); // clear old pins
  const heatData = [];
  
  snapshot.docs.forEach(docSnap => {
    const data = docSnap.data();
    const created = data.createdAt?.toDate?.() || new Date();
    const ageHours = (Date.now() - created)/36e5;
    
    if (ageHours > 24) deleteDoc(doc(db, "pins", docSnap.id)); // auto-expire

    const marker = L.circleMarker([data.lat, data.lng], {
      color: data.color,
      radius: 8,
      fillOpacity: 0.7
    }).bindPopup(data.text).addTo(map);

    heatData.push([data.lat, data.lng, 0.5]);
  });

  heat.setLatLngs(heatData);
});

// Live user location (optional)
if (navigator.geolocation) {
  navigator.geolocation.watchPosition(async (pos) => {
    const {latitude, longitude} = pos.coords;
    await addDoc(peopleCol, {
      userId,
      lat: latitude,
      lng: longitude,
      updatedAt: serverTimestamp()
    });
  });
}

// Real-time people markers
const peopleMarkers = {};
onSnapshot(peopleCol, (snapshot) => {
  snapshot.docs.forEach(docSnap => {
    const data = docSnap.data();
    if (data.userId === userId) return; // skip self
    if (!peopleMarkers[data.userId]) {
      peopleMarkers[data.userId] = L.circleMarker([data.lat, data.lng], {
        color: "blue",
        radius: 5,
        fillOpacity: 1
      }).addTo(map);
    } else {
      peopleMarkers[data.userId].setLatLng([data.lat, data.lng]);
    }
  });
});














































// FIREBASE CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyAq8yzrDUtsJbVk9Vl-H5d18rFWvPl9T_4",
  authDomain: "snapmap-lite.firebaseapp.com",
  projectId: "snapmap-lite",
  storageBucket: "snapmap-lite.appspot.com",
  messagingSenderId: "874569389218",
  appId: "1:874569389218:web:4dd9cd48cb2fa2a74e73fb"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// INITIALIZE MAP
const map = L.map('map').setView([0, 0], 2); // global view
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// CLICK TO DROP PIN
map.on('click', async (e) => {
  const text = prompt("Enter your note / vibe:");
  if (!text) return;
  const color = prompt("Vibe color (red, blue, green, yellow):") || "red";

  try {
    await db.collection("pins").add({
      lat: e.latlng.lat,
      lng: e.latlng.lng,
      text,
      color,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (err) {
    console.error("Error adding pin:", err);
  }
});

// REAL-TIME PINS
db.collection("pins").onSnapshot((snapshot) => {
  snapshot.docChanges().forEach((change) => {
    if (change.type === "added") {
      const data = change.doc.data();
      const marker = L.circleMarker([data.lat, data.lng], {
        color: data.color,
        radius: 8,
        fillOpacity: 0.8
      }).bindPopup(data.text).addTo(map);
    }
  });
});

















































import { db } from './firebaseConfig.js';
import { collection, getDocs, setDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

// Initialize Leaflet map
const map = L.map('map').setView([20, 0], 2); // global view

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19
}).addTo(map);

// Category colors
const categoryColors = {
  "Colonial": "#e6194b",
  "Culture": "#3cb44b",
  "Freedom Struggle": "#ffe119",
  "Myth": "#4363d8",
  "Personal Story": "#f58231"
};

// Add legend
const legend = L.control({position: 'bottomleft'});
legend.onAdd = function () {
  const div = L.DomUtil.create('div', 'legend');
  for (const cat in categoryColors) {
    div.innerHTML += `
      <div class="legend-item">
        <div class="legend-color" style="background:${categoryColors[cat]}"></div>
        <span>${cat}</span>
      </div>
    `;
  }
  return div;
};
legend.addTo(map);

// Example pins (10 worldwide)
const examplePins = [
  { title: "Mombasa Fort", description: "Built by the Portuguese in 1500s.", category: "Colonial", lat: -4.0435, lng: 39.6682 },
  { title: "Nairobi National Museum", description: "Showcases Kenya's culture.", category: "Culture", lat: -1.2921, lng: 36.8219 },
  { title: "Uhuru Park", description: "Freedom struggle demonstrations.", category: "Freedom Struggle", lat: -1.2850, lng: 36.8219 },
  { title: "Mount Kenya Myth", description: "Home of legendary spirits.", category: "Myth", lat: -0.1521, lng: 37.3080 },
  { title: "Jomo Kenyatta's House", description: "Personal story of Kenya's first president.", category: "Personal Story", lat: -1.2867, lng: 36.8172 },
  { title: "Stonehenge", description: "Famous prehistoric monument in UK.", category: "Myth", lat: 51.1789, lng: -1.8262 },
  { title: "Freedom Trail", description: "Historic path in Boston, USA.", category: "Freedom Struggle", lat: 42.3601, lng: -71.0589 },
  { title: "Great Wall of China", description: "Ancient Chinese defensive architecture.", category: "Culture", lat: 40.4319, lng: 116.5704 },
  { title: "Alhambra", description: "Moorish palace in Spain.", category: "Colonial", lat: 37.1761, lng: -3.5881 },
  { title: "Machu Picchu", description: "Incan historical site in Peru.", category: "Culture", lat: -13.1631, lng: -72.5450 }
];

// Optional: Preload example pins into Firebase (run only once)
// Uncomment this block if your Firestore is empty
/*
examplePins.forEach(async pin => {
  const docRef = doc(db, "historicalPins", pin.title.replace(/\s+/g, '_'));
  await setDoc(docRef, pin);
});
*/

// Load pins from Firestore
async function loadPins() {
  const pinsCol = collection(db, "historicalPins");
  const pinsSnap = await getDocs(pinsCol);

  pinsSnap.forEach(docSnap => {
    const data = docSnap.data();
    const marker = L.circleMarker([data.lat, data.lng], {
      radius: 8,
      fillColor: categoryColors[data.category] || "#000",
      color: "#fff",
      weight: 1,
      opacity: 1,
      fillOpacity: 0.8
    }).addTo(map);

    marker.bindPopup(`
      <b>${data.title}</b><br/>
      Category: ${data.category}<br/>
      ${data.description}
    `);
  });
}

loadPins();

};













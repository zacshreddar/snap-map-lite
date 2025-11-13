import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getDatabase, ref, set, update, onValue, push } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
import { categories } from './categories.js';


// Firebase Config
const firebaseConfig = {
apiKey: 'YOUR_API_KEY',
authDomain: 'YOUR_AUTH_DOMAIN',
databaseURL: 'YOUR_DB_URL',
projectId: 'YOUR_PROJECT_ID',
storageBucket: 'YOUR_STORAGE_BUCKET',
messagingSenderId: 'YOUR_SENDER_ID',
appId: 'YOUR_APP_ID'
};


const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);


// Core Elements
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const loginModal = document.getElementById('loginModal');
const signInBtn = document.getElementById('signInBtn');
const signUpBtn = document.getElementById('signUpBtn');
const closeLoginBtn = document.getElementById('closeLoginBtn');
const emailInput = document.getElementById('emailInput');
const passwordInput = document.getElementById('passwordInput');
const authError = document.getElementById('authError');
const map = L.map('map').setView([0,0], 2);


L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);


const listingsLayer = L.layerGroup().addTo(map);


let myUid = null;
let myState = {
id: null,
name: 'You',
lat: 0,
lon: 0,
balance: 100,
inventory: []
};


// --- Auth Logic ---
loginBtn.onclick = () => loginModal.classList.remove('hidden');
closeLoginBtn.onclick = () => loginModal.classList.add('hidden');
logoutBtn.onclick = async () => await signOut(auth);


signInBtn.onclick = async () => {
try {
const email = emailInput.value.trim();
const pass = passwordInput.value.trim();
if(!email || !pass) throw new Error('Enter email and password');
await signInWithEmailAndPassword(auth, email, pass);
loginModal.classList.add('hidden');
} catch(e) { authError.textContent = e.message; }
};


signUpBtn.onclick = async () => {
try {
console.log('SnapMap Lite initialized.');




































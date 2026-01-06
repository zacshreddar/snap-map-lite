import { db } from './firebaseConfig.js';
import { doc, setDoc, getDoc, updateDoc, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

// DOM elements
const landing = document.getElementById('landing');
const playBtn = document.getElementById('playBtn');
const playerNameInput = document.getElementById('playerName');
const gameContainer = document.getElementById('gameContainer');
const gameCanvas = document.getElementById('gameCanvas');
const ctx = gameCanvas.getContext('2d');
const questionText = document.getElementById('questionText');
const answersDiv = document.getElementById('answers');
const levelText = document.getElementById('levelText');
const coinsText = document.getElementById('coinsText');

gameCanvas.width = window.innerWidth;
gameCanvas.height = window.innerHeight;

let playerId = 'p' + Math.floor(Math.random()*100000);
let playerName = '';
let playerData = { x:100, y:300, level:1, coins:0 };
let waterLevel = window.innerHeight;
let stages = [];
let allPlayers = {};
let questions = [];

// Example stages (hidden locations on Kenya map)
for(let i=1;i<=10;i++){
  stages.push({level:i, x:Math.random()*window.innerWidth, y:Math.random()*window.innerHeight*0.7, coins: i*10});
}

// Example questions (progressively harder)
questions = [
  {level:1, question:"What is used to drink tea?", options:["Cup","Spoon","Plate"], answer:"Cup", coins:5},
  {level:2, question:"Capital of Kenya?", options:["Nairobi","Mombasa","Kisumu"], answer:"Nairobi", coins:10},
  {level:3, question:"Kenya gained independence in?", options:["1963","1970","1950"], answer:"1963", coins:15},
  {level:4, question:"National bird of Kenya?", options:["Lion","Guinea fowl","Eagle"], answer:"Guinea fowl", coins:20},
  // Add more...
];

function getQuestion(level){
  const q = questions.filter(q=>q.level===level);
  return q[Math.floor(Math.random()*q.length)];
}

const playerColors = {};
function getPlayerColor(id){
  if(!playerColors[id]){
    playerColors[id] = `hsl(${Math.random()*360},70%,50%)`;
  }
  return playerColors[id];
}

function updateLeaderboard(){
  const leaderboard = document.getElementById('leaderboard');
  const sorted = Object.entries(allPlayers).sort((a,b)=>b[1].coins - a[1].coins);
  leaderboard.innerHTML = '<h4>Leaderboard</h4>'+sorted.map(p=>`<div style="color:${getPlayerColor(p[0])}">${p[1].level}:${p[1].coins}</div>`).join('');
}

function spawnCoinEffect(x,y){
  const coin = document.createElement('div');
  coin.classList.add('coin-effect');
  coin.style.left = x+'px';
  coin.style.top = y+'px';
  gameContainer.appendChild(coin);
  setTimeout(()=>coin.remove(),1000);
}

function drawPlayers(){
  Object.entries(allPlayers).forEach(([id,p])=>{
    ctx.fillStyle = getPlayerColor(id);
    ctx.beginPath();
    ctx.arc(p.x,p.y,20,0,2*Math.PI);
    ctx.fill();
    ctx.fillStyle="white";
    ctx.font="12px Arial";
    ctx.textAlign="center";
    ctx.fillText(p.level,p.x,p.y+4);
  });
}

function loop(){
  ctx.clearRect(0,0,gameCanvas.width,gameCanvas.height);
  ctx.fillStyle='#1e90ff';
  ctx.fillRect(0, waterLevel, gameCanvas.width, gameCanvas.height - waterLevel);
  stages.forEach(stage=>{
    ctx.fillStyle='gold';
    ctx.beginPath();
    ctx.arc(stage.x,stage.y,20,0,Math.PI*2);
    ctx.fill();
  });
  drawPlayers();
  updateLeaderboard();
  requestAnimationFrame(loop);
}

// Firebase: create or join game
let gameId = 'kenyaGame';
async function joinGame(){
  const gameRef = doc(db,'games',gameId);
  const gameSnap = await getDoc(gameRef);
  if(!gameSnap.exists()){
    await setDoc(gameRef,{players:{},createdAt:serverTimestamp()});
  }
  await updateDoc(gameRef,{[`players.${playerId}`]:playerData});

  onSnapshot(gameRef,(snap)=>{
    const data = snap.data();
    allPlayers = data.players || {};
  });
}

// Question handling
function loadNextQuestion(level){
  const q = getQuestion(level);
  if(!q) return;
  questionText.textContent = q.question;
  answersDiv.innerHTML='';
  q.options.forEach(opt=>{
    const btn = document.createElement('button');
    btn.textContent=opt;
    btn.onclick=()=>handleAnswer(q,opt);
    answersDiv.appendChild(btn);
  });
}

async function handleAnswer(q,choice){
  if(choice===q.answer){
    playerData.coins+=q.coins;
    playerData.level+=1;
    const nextStage = stages.find(s=>s.level===playerData.level);
    if(nextStage){
      playerData.x = nextStage.x;
      playerData.y = nextStage.y;
      spawnCoinEffect(playerData.x,playerData.y);
    }
  } else {
    waterLevel -= 30;
  }
  const gameRef = doc(db,'games',gameId);
  await updateDoc(gameRef,{[`players.${playerId}`]:playerData});

  levelText.textContent='Level: '+playerData.level;
  coinsText.textContent='Coins: '+playerData.coins;

  if(waterLevel<=0){
    alert('You lost! Restarting...');
    waterLevel = window.innerHeight;
    playerData = { x:100, y:300, level:1, coins:0 };
    await updateDoc(gameRef,{[`players.${playerId}`]:playerData});
  } else {
    loadNextQuestion(playerData.level);
  }
}

// Start game
playBtn.onclick=()=>{
  playerName = playerNameInput.value || 'Anon';
  landing.classList.add('hidden');
  gameContainer.classList.remove('hidden');
  joinGame();
  loadNextQuestion(playerData.level);
  loop();
};












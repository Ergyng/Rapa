(() => {
'use strict';

const $ = id => document.getElementById(id);
const canvas = $('world');
const ctx = canvas.getContext('2d');
const colors = ['#a56f56','#6f8b78','#c19b65','#7d6b61','#8c9a78','#b08a73'];

const defaults = {
  day: 1, season: 'Early wet season', weather: 'Light rain', temperature: 18,
  food: 124, water: 86, mood: 72, health: 84,
  action: 'rest', activeTab: 'community', paused: false, speed: 1, zoom: 1,
  leaderPos: {x: .53, y: .63},
  people: [
    {name:'Mairi',age:34,role:'Community leader',mood:'Steady',health:92,skill:'Guidance'},
    {name:'Tane',age:29,role:'Fisher',mood:'Content',health:88,skill:'Fishing'},
    {name:'Moana',age:41,role:'Taro keeper',mood:'Thoughtful',health:86,skill:'Cultivation'},
    {name:'Hina',age:23,role:'Gatherer',mood:'Bright',health:94,skill:'Foraging'},
    {name:'Paoa',age:52,role:'Builder',mood:'Quiet',health:79,skill:'Construction'},
    {name:'Rima',age:17,role:'Apprentice',mood:'Curious',health:91,skill:'Learning'},
    {name:'Teva',age:36,role:'Raft keeper',mood:'Ready',health:85,skill:'Fishing'},
    {name:'Ari',age:64,role:'Story keeper',mood:'Calm',health:76,skill:'Knowledge'},
    {name:'Nani',age:26,role:'Cook',mood:'Busy',health:90,skill:'Provision'},
    {name:'Koa',age:31,role:'Path keeper',mood:'Restless',health:87,skill:'Woodcraft'},
    {name:'Ila',age:11,role:'Young helper',mood:'Playful',health:96,skill:'Learning'},
    {name:'Vaea',age:47,role:'Rain keeper',mood:'Patient',health:82,skill:'Water'}
  ],
  fields: [
    {x:.43,y:.50,level:2},{x:.48,y:.50,level:2},{x:.53,y:.51,level:1},
    {x:.58,y:.52,level:2},{x:.44,y:.56,level:1},{x:.49,y:.57,level:2},{x:.54,y:.58,level:1}
  ],
  buildings: [], journal: ['The community settled under a soft rain in Ha’urei Bay.'],
  selectedPerson: null
};

let S;
try {
  const saved = JSON.parse(localStorage.getItem('rapa-save'));
  S = {...defaults, ...(saved || {})};
  S.people = saved?.people?.length ? saved.people : defaults.people;
  S.fields = saved?.fields?.length ? saved.fields : defaults.fields;
  S.buildings = saved?.buildings || [];
  S.journal = saved?.journal?.length ? saved.journal : defaults.journal;
} catch (_) { S = structuredClone(defaults); }

let t = 0, last = performance.now(), acc = 0;

function save(){
  try { localStorage.setItem('rapa-save', JSON.stringify(S)); toast('Your island has been saved.'); }
  catch (_) { toast('Saving is unavailable in this browser.'); }
}

function toast(message){
  const el = $('toast'); el.textContent = message; el.classList.add('show');
  clearTimeout(toast.timer); toast.timer=setTimeout(()=>el.classList.remove('show'),2600);
}

function updateTop(){
  $('dateLabel').textContent=`Day ${S.day} · ${S.season}`;
  $('weatherLabel').textContent=`${S.weather} · ${S.temperature}°C`;
  $('foodTop').textContent=Math.max(0,Math.round(S.food));
  $('waterTop').textContent=Math.max(0,Math.round(S.water));
  $('peopleTop').textContent=S.people.length;
  $('leaderName').textContent=S.people[0]?.name || 'Mairi';
  $('leaderAvatar').textContent=(S.people[0]?.name || 'M').charAt(0);
}

function renderPanel(){
  const panel=$('panel');
  if(S.activeTab==='community'){
    const visible=S.people.slice(0,6);
    panel.innerHTML=`<div class="panel-heading"><div><span class="eyebrow">THE COMMUNITY</span><h2>12 hearts at home</h2></div><button class="panel-menu">•••</button></div>
      <div class="people-list">${visible.map((p,i)=>`<button class="person-row" data-person="${i}"><div class="person-avatar" style="background:${['#8e705d','#718070','#9d8062','#778c83','#9a7869','#6f7e72'][i]}">${p.name[0]}</div><div class="person-info"><b>${p.name}</b><small>${p.role} · ${p.age}</small></div><span class="person-mood">${p.mood}</span></button>`).join('')}<button class="more-people" id="morePeople">+ ${S.people.length-6} more in the community</button></div>
      <div class="status-card"><div class="status-head">Community spirit <span>${S.mood}%</span></div><div class="meter"><i style="width:${S.mood}%"></i></div><p>The community feels ${S.mood>75?'close and capable':S.mood>45?'watchful but steady':'strained'}.</p></div>
      <div class="status-card compact"><div><small>HEALTH</small><b>${S.health}%</b></div><div><small>STORED FOOD</small><b>${Math.round(S.food)}</b></div><div><small>FRESH WATER</small><b>${Math.round(S.water)}</b></div></div>`;
  }else if(S.activeTab==='land'){
    panel.innerHTML=`<div class="panel-heading"><div><span class="eyebrow">THE ISLAND</span><h2>Terraces & shore</h2></div></div>
      <div class="land-list"><button data-action="plant"><b>Plant taro</b><small>Improve the pondfields</small></button><button data-action="harvest"><b>Tend harvest</b><small>Gather mature crops</small></button><button data-action="build"><b>Begin a shelter</b><small>Use 24 food and 18 timber</small></button></div>
      <div class="status-card"><div class="status-head">Taro pondfields <span>${S.fields.length}</span></div><p>Water-fed terraces are ${S.fields.every(f=>f.level>1)?'thriving':'recovering'}.</p></div>`;
  }else{
    panel.innerHTML=`<div class="panel-heading"><div><span class="eyebrow">FIELD NOTES</span><h2>Island journal</h2></div></div><div class="journal-list">${S.journal.slice(-8).reverse().map(entry=>`<article><span>Day ${S.day}</span><p>${entry}</p></article>`).join('')}</div>`;
  }
}

function addJournal(text){S.journal.push(text);if(S.journal.length>30)S.journal.shift();}
function act(action){
  const recipes={fish:['fishing',18,6],harvest:['harvesting',16,2],gather:['gathering',10,7],plant:['planting',8,3],build:['construction',0,0],rest:['resting',0,0]};
  if(!recipes[action])return;
  S.action=action;
  $('actionLabel').textContent={rest:'Take a moment',fish:'Cast a line',harvest:'Harvest the fields',gather:'Gather from shore',plant:'Plant a terrace',build:'Begin construction'}[action];
  if(action==='fish'){S.food+=14;S.mood=Math.min(100,S.mood+1);toast('The fish baskets return full.');addJournal('A careful morning brought fish to the baskets.');}
  if(action==='harvest'){S.food+=S.fields.reduce((n,f)=>n+f.level*3,0);S.mood=Math.min(100,S.mood+2);toast('Taro is gathered from the terraces.');addJournal('The community harvested taro from the wet terraces.');}
  if(action==='gather'){S.food+=7;S.water=Math.min(100,S.water+4);toast('Leaves, fruit, and reeds are gathered.');addJournal('Useful plants and fruit were gathered near the stream.');}
  if(action==='plant'){S.fields.forEach(f=>f.level=Math.min(3,f.level+1));S.mood=Math.min(100,S.mood+2);toast('Young taro is settled in the flowing water.');addJournal('New shoots were planted along the wet terraces.');}
  if(action==='build'){if(S.food>=24){S.food-=24;S.buildings.push({type:'Shelter',x:.56,y:.64});toast('A shelter is raised near the settlement.');addJournal('Hands raised a new shelter at the edge of the village.');}else toast('The community needs more food before building.');}
  if(action==='rest'){S.mood=Math.min(100,S.mood+3);S.health=Math.min(100,S.health+1);toast('You pause beneath the shade.');}
  updateTop();renderPanel();save();
}

function personModal(index){
  const p=S.people[index];if(!p)return;
  openModal(`<div class="eyebrow" style="color:#859681">COMMUNITY MEMBER</div><div class="modal-person"><div class="person-avatar large" style="background:${colors[index%colors.length]}">${p.name[0]}</div><div><h2>${p.name}</h2><p>${p.role} · age ${p.age}</p></div></div><div class="status-card"><p><b>Gift:</b> ${p.skill}<br><b>Health:</b> ${p.health}% · <b>Feeling:</b> ${p.mood}</p></div><button class="primary-action" id="shareTime">Spend time together</button>`);
  $('shareTime').onclick=()=>{S.mood=Math.min(100,S.mood+4);p.mood='Warm';updateTop();renderPanel();closeModal();toast(`${p.name} feels accompanied.`);save();};
}
function openModal(html){$('modalContent').innerHTML=html;$('modal').classList.remove('hidden');}
function closeModal(){ $('modal').classList.add('hidden'); }

function resize(){const rect=canvas.getBoundingClientRect();canvas.width=Math.round(rect.width*(devicePixelRatio||1));canvas.height=Math.round(rect.height*(devicePixelRatio||1));}

function hut(x,y,scale=1){ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.fillStyle='#283e35';ctx.beginPath();ctx.ellipse(0,8,17,6,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#bd9c6e';ctx.fillRect(-10,-5,20,13);ctx.fillStyle='#786247';ctx.beginPath();ctx.moveTo(-14,-4);ctx.lineTo(0,-16);ctx.lineTo(14,-4);ctx.closePath();ctx.fill();ctx.strokeStyle='#e3c58f';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-11,-3);ctx.lineTo(0,-13);ctx.lineTo(11,-3);ctx.stroke();ctx.fillStyle='#473e30';ctx.fillRect(-2,1,5,7);ctx.restore();}

function draw(){
  t+=.016; resize();
  const w=canvas.width,h=canvas.height;ctx.setTransform(w/900,0,0,h/600,0,0);
  ctx.save();
  const sea=ctx.createLinearGradient(0,0,0,600);sea.addColorStop(0,'#90a8a1');sea.addColorStop(1,'#486c6c');ctx.fillStyle=sea;ctx.fillRect(0,0,900,600);
  ctx.fillStyle='#667d69';ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(900,0);ctx.lineTo(900,600);ctx.lineTo(780,600);ctx.quadraticCurveTo(690,540,650,440);ctx.quadraticCurveTo(610,330,500,290);ctx.quadraticCurveTo(390,250,310,130);ctx.quadraticCurveTo(160,65,0,125);ctx.closePath();ctx.fill();
  ctx.fillStyle='#7f906e';ctx.beginPath();ctx.moveTo(0,95);ctx.quadraticCurveTo(130,35,260,145);ctx.quadraticCurveTo(410,310,390,600);ctx.lineTo(0,600);ctx.closePath();ctx.fill();
  ctx.fillStyle='#526c58';ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(330,0);ctx.quadraticCurveTo(270,130,360,260);ctx.quadraticCurveTo(300,420,330,600);ctx.lineTo(0,600);ctx.closePath();ctx.fill();
  ctx.strokeStyle='rgba(63,91,78,.35)';ctx.lineWidth=15;ctx.beginPath();ctx.moveTo(260,600);ctx.bezierCurveTo(310,500,260,390,350,300);ctx.bezierCurveTo(410,230,420,150,390,80);ctx.stroke();
  ctx.strokeStyle='rgba(173,196,165,.55)';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(265,600);ctx.bezierCurveTo(315,500,265,390,355,300);ctx.bezierCurveTo(415,230,425,150,395,80);ctx.stroke();
  ctx.fillStyle='#3d605b';ctx.beginPath();ctx.moveTo(0,600);ctx.quadraticCurveTo(210,530,390,600);ctx.closePath();ctx.fill();

  S.fields.forEach((f,i)=>{let x=f.x*900,y=f.y*600;ctx.fillStyle=f.level>1?'#a89b69':'#817f5c';ctx.beginPath();ctx.ellipse(x,y,34,16,-.15,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#bfc7a0';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(x,y,25,10,-.15,0,Math.PI*2);ctx.stroke();for(let j=0;j<3;j++){ctx.fillStyle='#5e7a50';ctx.beginPath();ctx.arc(x-14+j*13,y-4+(j%2)*5,3.5,0,Math.PI*2);ctx.fill();}});

  [[477,375],[510,361],[531,380],[487,397],[552,365],[519,403]].forEach((p,i)=>hut(p[0],p[1],i===0?1.12:.85));
  S.people.slice(0,8).forEach((p,i)=>{let phase=t*.25+i*1.7,x=493+Math.cos(phase)*25+i%3*3,y=387+Math.sin(phase)*13;ctx.fillStyle=colors[i%colors.length];ctx.beginPath();ctx.arc(x,y-3,3.8,0,Math.PI*2);ctx.fill();ctx.fillStyle='#3d453b';ctx.fillRect(x-2,y,4,6);});
  let lx=S.leaderPos.x*900,ly=S.leaderPos.y*600;ctx.beginPath();ctx.arc(lx,ly-11,13+Math.sin(t*2)*1.5,0,Math.PI*2);ctx.strokeStyle='rgba(255,244,203,.8)';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#e9bf7c';ctx.beginPath();ctx.arc(lx,ly-11,5,0,Math.PI*2);ctx.fill();
  S.buildings.forEach(b=>{let x=b.x*900,y=b.y*600;hut(x,y,.9);ctx.fillStyle='#f6e5bd';ctx.font='10px sans-serif';ctx.fillText('✦ '+b.type,x-18,y-22);});

  for(let i=0;i<8;i++){let x=((i*143+t*7)%1000)-30,y=52+(i%4)*24;ctx.fillStyle=`rgba(221,231,222,${.13+Math.sin(t+i)*.025})`;ctx.beginPath();ctx.ellipse(x,y,70,17,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(x-22,y-6,32,14,0,0,Math.PI*2);ctx.ellipse(x+20,y-5,39,16,0,0,Math.PI*2);ctx.fill();}
  if(S.weather.toLowerCase().includes('rain'))for(let i=0;i<45;i++){let x=(i*97+t*55)%900,y=(i*71+t*120)%600;ctx.strokeStyle='rgba(210,229,226,.27)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-3,y+8);ctx.stroke();}
  for(let i=0;i<5;i++){let x=(i*193+t*5)%900,y=170+i*43;ctx.strokeStyle='rgba(31,59,57,.48)';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(x-4,y);ctx.quadraticCurveTo(x,y-4,x+4,y);ctx.stroke();}
  ctx.restore();
}

canvas.addEventListener('click',e=>{let r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;S.leaderPos={x,y};toast(y>.53&&x>.4&&x<.68?'You return to the settlement.':'You set out to explore the island.')});
document.addEventListener('click',e=>{
  let tab=e.target.closest('.tab');if(tab){S.activeTab=tab.dataset.tab;document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t===tab));renderPanel();return;}
  let actbtn=e.target.closest('[data-action]');if(actbtn){act(actbtn.dataset.action);return;}
  let person=e.target.closest('[data-person]');if(person){personModal(Number(person.dataset.person));return;}
  if(e.target.id==='morePeople')toast('Everyone in the community has their own story.');
});

$('doAction').onclick=()=>act(S.action);
document.querySelectorAll('.quick-actions [data-action]').forEach(b=>b.onclick=()=>act(b.dataset.action));
$('saveBtn').onclick=save;$('closeModal').onclick=closeModal;$('modal').onclick=e=>{if(e.target.id==='modal')closeModal();};
$('helpBtn').onclick=()=>openModal(`<div class="eyebrow" style="color:#859681">A QUIET LIFE, FULL OF CONSEQUENCE</div><h2>Welcome to Rapa Iti</h2><p>Guide a small community through the wet valleys of Ha’urei Bay. This is a historically inspired, fictional simulation; details are restrained where Rapan history is uncertain.</p><div class="status-card"><div class="status-head">How to play</div><p><b>Fish, harvest, gather</b> to keep food and water available. <b>Plant taro</b> to improve your field. Use <b>Land</b> to tend terraces and begin construction. Click the island to explore, or select a person to spend time with them.</p></div><button class="primary-action" id="gotIt">Begin the day</button>`);

$('pauseBtn').onclick=e=>{S.paused=!S.paused;e.currentTarget.textContent=S.paused?'▶':'Ⅱ';e.currentTarget.classList.toggle('active',S.paused);};
document.querySelectorAll('.speed').forEach(b=>b.onclick=()=>{S.speed=Number(b.dataset.speed);document.querySelectorAll('.speed').forEach(x=>x.classList.toggle('active',x===b));});
$('zoomIn').onclick=()=>{S.zoom=Math.min(1.3,S.zoom+.1);toast('The map is already shown at a comfortable scale.')};
$('zoomOut').onclick=()=>{S.zoom=Math.max(.8,S.zoom-.1);toast('Map view adjusted.')};
$('centerBtn').onclick=()=>{S.leaderPos={x:.53,y:.63};toast('Centered on Ha’urei settlement.')};
document.addEventListener('keydown',e=>{if(e.code==='Space'&&document.activeElement.tagName!=='INPUT'){e.preventDefault();act('rest')}if(e.key==='Escape')closeModal();});

function timeStep(){
  S.day++;
  S.food=Math.max(0,S.food-S.people.length*.018);
  S.water=Math.max(0,S.water-.025);
  if(S.day%7===0){S.season=S.day%14===0?'Early dry season':'Early wet season';S.weather=S.season.includes('wet')?'Light rain':'Soft sun';S.temperature=S.season.includes('wet')?18:22;}
  updateTop();
}
function loop(now){let delta=Math.min((now-last)/1000,.2);last=now;if(!S.paused){acc+=delta*S.speed;while(acc>.9){timeStep();acc-=.9}}draw();requestAnimationFrame(loop);}

updateTop();renderPanel();resize();draw();requestAnimationFrame(loop);window.addEventListener('resize',resize);
})();

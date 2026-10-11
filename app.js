// Campus Event Pass — website code (GitHub Pages + Firebase)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendEmailVerification, sendPasswordResetEmail, signOut } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, deleteDoc, collection, addDoc, query, where as fsWhere, orderBy, limit,
  onSnapshot, writeBatch, increment } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const PUBLIC_DOMAINS = ["gmail.com","googlemail.com","yahoo.com","yahoo.co.in","outlook.com","hotmail.com","live.com","msn.com","icloud.com","me.com","rediffmail.com","proton.me","protonmail.com","aol.com","zoho.com","yandex.com","gmx.com"];
const DEFAULT_INTERESTS = ["AI & ML","Web Development","Robotics","Entrepreneurship","Design","Research","Cultural","Sports","Finance","Career","Health","Sustainability"];
const FRESHER = "1st year";
const YEARS = [FRESHER,"2nd year","3rd year","4th year","5th year","PG / Masters","PhD","Faculty / Staff","Alumni"];
const COVERS = {marigold:"#e39a0b", teal:"#0b7570", ink:"#14212a", rose:"#b8456a"};

const S = { loaded:false, user:null, me:null, isAdmin:false, smtp:false, links:{}, gateErr:"", gate:"signin", events:[], notices:[], settings:{}, members:[],
  view:"events", tag:"", q:"", past:false, open:null, adminTab:"events", editing:null, confirmDel:null,
  mail:{aud:"all", event:"", tag:"", optin:true, subject:"", body:""}, gate:"profile", pendingEmail:"",
  viewed:new Set(), dirty:false, busy:false };

const $app = document.getElementById("app");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ICON = {
  pin:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
  clock:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  cal:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  bell:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>',
  doc:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h7"/></svg>',
  star:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>',
  link:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
  mail:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>'
};
function toast(msg){ const t=document.getElementById("toast"); t.textContent=msg; t.hidden=false; clearTimeout(toast._t); toast._t=setTimeout(()=>t.hidden=true,3200); }
async function copy(text, done="Copied"){ try{ await navigator.clipboard.writeText(text); toast(done); }catch(e){ toast("Select the text and copy it manually"); } }

/* ---------- Firebase ---------- */
const CONFIGURED = firebaseConfig && firebaseConfig.apiKey && !String(firebaseConfig.apiKey).startsWith("PASTE");
let auth=null, db=null;
if(CONFIGURED){ const fb=initializeApp(firebaseConfig); auth=getAuth(fb); db=getFirestore(fb); }
const PAGE_URL = location.origin + location.pathname;
let unsubs=[];
function stopListeners(){ unsubs.forEach(u=>{ try{u();}catch(e){} }); unsubs=[]; }
const PENDING_KEY="cep_pending_profile";
function getPending(){ try{ return JSON.parse(localStorage.getItem(PENDING_KEY)||"null"); }catch(e){ return null; } }
function setPending(p){ try{ p?localStorage.setItem(PENDING_KEY,JSON.stringify(p)):localStorage.removeItem(PENDING_KEY); }catch(e){} }

function friendly(e){
  const c=(e&&e.code)||"";
  const m={
    "auth/email-already-in-use":"An account with this email already exists. Sign in instead.",
    "auth/invalid-credential":"The email or password is wrong.",
    "auth/wrong-password":"The email or password is wrong.",
    "auth/user-not-found":"No account uses this email. Create one first.",
    "auth/invalid-email":"Enter a valid email address.",
    "auth/weak-password":"Use a password with at least 6 characters.",
    "auth/too-many-requests":"Too many attempts. Wait a few minutes and try again.",
    "auth/network-request-failed":"No internet connection. Check it and try again.",
    "auth/unauthorized-continue-uri":"This website's address isn't on Firebase's authorised domains list yet. The organiser needs to add it.",
    "auth/unauthorized-domain":"This website's address isn't on Firebase's authorised domains list yet. The organiser needs to add it.",
    "permission-denied":"That wasn't allowed. If you just verified your email, sign out and sign in again.",
    "unavailable":"Can't reach the server. Check your internet connection.",
  };
  return m[c] || (e&&e.message) || "Something went wrong. Try again.";
}

function listen(){
  stopListeners();
  const u=S.user;
  unsubs.push(onSnapshot(doc(db,"settings","portal"), s=>{ S.settings=s.exists()?s.data():{}; render(); }, ()=>{}));
  if(!u || !u.emailVerified) { S.loaded=true; render(); return; }
  unsubs.push(onSnapshot(doc(db,"members",u.uid), async s=>{
    if(s.exists()){ S.me=s.data(); }
    else {
      S.me=null;
      const p=getPending();
      if(p && p.email===u.email.toLowerCase() && !S._creating){
        S._creating=true;
        try{ await setDoc(doc(db,"members",u.uid), newMember(p)); setPending(null); S.view="foryou"; toast("Welcome in"); }
        catch(e){ S.gate="complete"; S.gateErr=friendly(e); }
        S._creating=false;
      } else S.gate="complete";
    }
    S.loaded=true; render();
  }, e=>{ S.loaded=true; S.gateErr=friendly(e); render(); }));
  const evq = S.isAdmin ? collection(db,"events") : query(collection(db,"events"), fsWhere("status","==","published"));
  unsubs.push(onSnapshot(evq, s=>{
    S.events=s.docs.map(x=>({...x.data(), id:x.id}));
    const h=(location.hash||"").replace("#","");
    if(!S._deep && h.startsWith("e-") && S.events.some(e=>e.id===h.slice(2))){ S._deep=1; openEvent(h.slice(2)); return; }
    render();
  }, ()=>{}));
  unsubs.push(onSnapshot(query(collection(db,"notices"), orderBy("at","desc"), limit(30)), s=>{ S.notices=s.docs.map(x=>({...x.data(), id:x.id})); render(); }, ()=>{}));
  if(S.isAdmin) unsubs.push(onSnapshot(collection(db,"members"), s=>{ S.members=s.docs.map(x=>({...x.data(), uid:x.id})); render(); }, ()=>{}));
}
function newMember(p){
  return { name:p.name, email:p.email, year:p.year, dept:p.dept||"", interests:p.interests||[], optIn:p.optIn!==false,
    personalEmail:p.year===FRESHER && !institutional(p.email.split("@")[1]),
    rsvps:{}, saved:[], tagViews:{}, lastSeenNotice:"", joinedAt:new Date().toISOString() };
}
function institutional(dom){ const allowed=S.settings.allowedDomains||[]; return allowed.length ? allowed.includes(dom) : !PUBLIC_DOMAINS.includes(dom); }
function yearEmailError(year,email){
  if(!year) return "Choose your year first.";
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Enter a valid email address, like name@college.ac.in.";
  if(year!==FRESHER && !institutional(email.split("@")[1])){
    const allowed=S.settings.allowedDomains||[];
    return allowed.length ? `Use your institutional address ending in @${allowed.join(" or @")}. Only first-years can sign in with a personal email.`
      : "That's a personal address. Only first-years can use one; please use the email your institution gave you.";
  }
  return "";
}
async function saveMe(patch){
  if(!S.me) return;
  const next={...S.me, ...patch, updatedAt:new Date().toISOString()};
  S.me=next; render();
  try{ await setDoc(doc(db,"members",S.user.uid), next); }catch(e){ toast(friendly(e)); }
}
const regCountOf = id => S.isAdmin && S.members.length ? S.members.filter(m=>m.rsvps&&m.rsvps[id]).length : (S.events.find(e=>e.id===id)?.regCount||0);
const seatsFull = e => !!(e.capacity && (e.regCount||0) >= e.capacity);
async function loadLink(id){
  if(S.links[id]!==undefined) return;
  S.links[id]="";
  try{ const s=await getDoc(doc(db,"eventLinks",id)); S.links[id]=s.exists()?(s.data().url||""):""; render(); }catch(e){}
}
function downloadIcs(e){
  const stamp=iso=>d(iso).toISOString().replace(/[-:]/g,"").replace(/\.\d{3}/,"");
  const escI=s=>String(s||"").replace(/\\/g,"\\\\").replace(/\n/g,"\\n").replace(/[,;]/g,m=>"\\"+m);
  const ics=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Campus Event Pass//EN","BEGIN:VEVENT",`UID:${e.id}@campus-event-pass`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,`DTSTART:${stamp(e.start)}`,`DTEND:${stamp(endOf(e))}`,`SUMMARY:${escI(e.title)}`,
    `LOCATION:${escI(e.mode==="Online"?"Online":where(e))}`,`DESCRIPTION:${escI(details(e))}`,"END:VEVENT","END:VCALENDAR"].join("\r\n");
  const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([ics],{type:"text/calendar"}));
  a.download=(e.title||"event").replace(/[^\w\- ]+/g,"").slice(0,60)+".ics"; document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },500);
}
/* ---------- dates & money ---------- */
const d = iso => new Date(iso);
const fmtDay = iso => d(iso).toLocaleDateString(undefined,{weekday:"short",day:"numeric",month:"short",year:"numeric"});
const fmtTime = iso => d(iso).toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit"});
const toLocalInput = iso => { if(!iso) return ""; const x=d(iso); const p=n=>String(n).padStart(2,"0"); return `${x.getFullYear()}-${p(x.getMonth()+1)}-${p(x.getDate())}T${p(x.getHours())}:${p(x.getMinutes())}`; };
const gcalStamp = iso => d(iso).toISOString().replace(/[-:]/g,"").replace(/\.\d{3}/,"");
function money(ev){ const p=Number(ev.price||0); if(!p) return "Free"; try{ return new Intl.NumberFormat("en-IN",{style:"currency",currency:ev.currency||"INR",maximumFractionDigits:0}).format(p);}catch(e){ return (ev.currency||"INR")+" "+p; } }
function countdown(iso){ const ms=d(iso)-Date.now(); if(ms<0) return null; const days=Math.floor(ms/864e5); if(days>1) return `in ${days} days`; if(days===1) return "tomorrow"; const h=Math.floor(ms/36e5); return h>0?`in ${h} h`:"starting soon"; }
const isPast = ev => d(ev.end||ev.start) < Date.now();
const endOf = ev => ev.end || new Date(d(ev.start).getTime()+2*36e5).toISOString();

/* ---------- links ---------- */
const where = ev => [ev.venue, ev.address].filter(Boolean).join(", ");
const gmaps = ev => ev.mapsUrl || "https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(where(ev));
const amaps = ev => "https://maps.apple.com/?q="+encodeURIComponent(where(ev));
const eventUrl = ev => location.origin+location.pathname+"#e-"+ev.id;
const details = ev => [ev.tagline, ev.description, ev.brochureUrl?("Brochure: "+ev.brochureUrl):"", "Event page: "+eventUrl(ev)].filter(Boolean).join("\n\n").slice(0,1500);
const gcal = ev => "https://calendar.google.com/calendar/render?action=TEMPLATE&text="+encodeURIComponent(ev.title)+"&dates="+gcalStamp(ev.start)+"/"+gcalStamp(endOf(ev))+"&details="+encodeURIComponent(details(ev))+"&location="+encodeURIComponent(where(ev)||"Online");
const outlook = ev => "https://outlook.office.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent&subject="+encodeURIComponent(ev.title)+"&startdt="+encodeURIComponent(d(ev.start).toISOString())+"&enddt="+encodeURIComponent(d(endOf(ev)).toISOString())+"&location="+encodeURIComponent(where(ev))+"&body="+encodeURIComponent(details(ev));
function safeUrl(u){ try{ const x=new URL(u); return /^https?:$/.test(x.protocol)?x.href:""; }catch(e){ return ""; } }

/* ---------- derived ---------- */
const visibleEvents = () => S.events;
function allTags(){ const set=new Set(); S.events.forEach(e=>(e.tags||[]).forEach(t=>set.add(t))); return [...set].sort(); }
const rsvps = () => (S.me && S.me.rsvps) || {};
const saved = () => (S.me && S.me.saved) || [];
function recommend(){
  const interests=new Set((S.me&&S.me.interests)||[]); const aff={}; const add=(t,w)=>aff[t]=(aff[t]||0)+w;
  Object.entries((S.me&&S.me.tagViews)||{}).forEach(([t,n])=>add(t,Math.min(n,4)*0.5));
  const byId=Object.fromEntries(S.events.map(e=>[e.id,e]));
  [...Object.keys(rsvps()), ...saved()].forEach(id=>(byId[id]?.tags||[]).forEach(t=>add(t,1.5)));
  return S.events.filter(e=>!isPast(e)&&!rsvps()[e.id]&&e.status!=="draft").map(e=>{
    let score=0, why=[];
    (e.tags||[]).forEach(t=>{ if(interests.has(t)){score+=3;why.push(t);} if(aff[t]){score+=aff[t]; if(!interests.has(t)) why.push(t);} });
    if((d(e.start)-Date.now())/864e5<14) score+=0.5;
    return {e,score,why:[...new Set(why)].slice(0,2)};
  }).sort((a,b)=>b.score-a.score || d(a.e.start)-d(b.e.start));
}
const unread = () => { const seen=(S.me&&S.me.lastSeenNotice)||""; return S.notices.filter(n=>n.at>seen).length; };
function emailHint(year){
  const doms=(S.settings.allowedDomains||[]).join(", ");
  if(!year) return "Choose your year above. First-years can use a personal email; everyone else needs their institutional one.";
  if(year===FRESHER) return "First-years can use a personal email (Gmail, Yahoo, etc.) until the institutional one is issued. You can update it later under My pass.";
  return doms?`Use your ${doms} address.`:"Use the email your institution gave you. Personal addresses like Gmail or Yahoo aren't accepted.";
}

/* ---------- views ---------- */
function ticket(e, extra=""){
  const x=d(e.start); const cd=countdown(e.start); const reg=rsvps()[e.id];
  const status = e.status==="draft"?'<span class="pill mute">Draft</span>' : reg?'<span class="pill ok">Registered</span>' : isPast(e)?'<span class="pill mute">Ended</span>'
    : (e.deadline && d(e.deadline)<Date.now())?'<span class="pill warn">Registration closed</span>' : seatsFull(e)?'<span class="pill warn">Seats full</span>':"";
  return `<button class="ticket" data-act="open" data-id="${esc(e.id)}" style="${COVERS[e.cover]?`--accent-soft:color-mix(in srgb, ${COVERS[e.cover]} 18%, var(--surface))`:""}">
    <div class="stub"><div class="m">${x.toLocaleDateString(undefined,{month:"short"})}</div><div class="d">${x.getDate()}</div><div class="w">${x.toLocaleDateString(undefined,{weekday:"short"})}</div></div>
    <div class="tbody">
      <div class="row" style="justify-content:space-between"><h3>${esc(e.title)}</h3><span class="price num">${esc(money(e))}</span></div>
      ${e.tagline?`<p class="muted">${esc(e.tagline)}</p>`:""}
      <div class="tmeta"><span>${ICON.clock}${esc(fmtTime(e.start))}${cd?` · ${esc(cd)}`:""}</span><span>${ICON.pin}${esc(e.mode==="Online"?"Online":(e.venue||"Venue TBA"))}</span></div>
      <div class="row">${(e.tags||[]).map(t=>`<span class="tag">${esc(t)}</span>`).join("")}${status}</div>${extra}
    </div></button>`;
}
function header(){
  const tabs=[["events","Events"]]; if(S.me) tabs.push(["foryou","For you"],["pass","My pass"]); if(S.isAdmin) tabs.push(["admin","Admin"]);
  const n=S.me?unread():0;
  return `<header class="top"><div class="wrap">
    <div class="brand"><span class="mark">${esc((S.settings.portalName||"E").trim()[0]||"E")}</span><span>${esc(S.settings.portalName||"Campus Event Pass")}</span></div>
    <nav class="tabs">${tabs.map(([k,l])=>`<button class="tab" data-act="nav" data-v="${k}" ${S.view===k?'aria-current="page"':""}>${l}</button>`).join("")}</nav>
    ${S.me?`<button class="iconbtn" data-act="nav" data-v="notices" aria-label="Notifications${n?`, ${n} new`:""}">${ICON.bell}${n?`<span class="dot num">${n}</span>`:""}</button>`:""}
    <button class="btn sm ghost" data-act="logout">Sign out</button>
  </div></header>`;
}
function viewEvents(){
  let list=S.events.filter(e=>S.past?isPast(e):!isPast(e));
  if(S.tag) list=list.filter(e=>(e.tags||[]).includes(S.tag));
  if(S.q){ const q=S.q.toLowerCase(); list=list.filter(e=>[e.title,e.tagline,e.description,e.venue,(e.tags||[]).join(" ")].join(" ").toLowerCase().includes(q)); }
  list.sort((a,b)=>S.past?d(b.start)-d(a.start):d(a.start)-d(b.start));
  const tags=allTags(); const first=(S.me&&S.me.name||"").split(" ")[0];
  return `<section class="hero"><span class="label">${esc(S.settings.organizer?"Hosted by "+S.settings.organizer:"Event portal")}</span>
    <h1>${first?`What's on, ${esc(first)}`:"What's on"}</h1><p>${esc(S.settings.intro||"Register in one tap, drop the venue into your maps and the session into your calendar.")}</p></section>
    <div class="filters"><input id="q" class="search" type="search" placeholder="Search events, venues, topics" value="${esc(S.q)}" aria-label="Search events">
      <button class="chip" data-act="past" aria-pressed="${S.past}">${S.past?"Past events":"Upcoming"}</button></div>
    ${tags.length?`<div class="filters" style="margin-top:-8px"><button class="chip" data-act="tag" data-t="" aria-pressed="${!S.tag}">All</button>${tags.map(t=>`<button class="chip" data-act="tag" data-t="${esc(t)}" aria-pressed="${S.tag===t}">${esc(t)}</button>`).join("")}</div>`:""}
    <div class="list">${list.length?list.map(e=>ticket(e)).join(""):`<div class="empty"><h3>${S.events.length?"No events match":"No events published yet"}</h3><p>${S.events.length?"Try another topic or clear the search.":(S.isAdmin?"Add your first event from the Admin tab.":"New events from the organiser will appear here.")}</p></div>`}</div>`;
}
function viewForYou(){
  const recs=recommend(); const top=recs.filter(r=>r.score>0.5); const rest=top.length?[]:recs.slice(0,4);
  return `<section class="hero"><span class="label">Suggested for you</span><h1>Picked from your interests</h1>
    <p>Suggestions use the interests on your pass, the events you register for or star, and the topics you open most.</p>
    <div class="row">${((S.me&&S.me.interests)||[]).map(t=>`<span class="tag">${esc(t)}</span>`).join("")}<button class="btn sm ghost" data-act="nav" data-v="pass">Edit interests</button></div></section>
    <div class="list">${top.length?top.map(r=>ticket(r.e, r.why.length?`<span class="reason">Because you follow ${esc(r.why.join(" and "))}</span>`:"")).join("")
      : rest.length?`<p class="muted">Nothing matches your interests yet. Here's what's coming up soon:</p>`+rest.map(r=>ticket(r.e)).join("")
      : `<div class="empty"><h3>No suggestions yet</h3><p>Upcoming events that match your interests will show up here.</p></div>`}</div>`;
}
function viewPass(){
  const me=S.me||{}; const byId=Object.fromEntries(S.events.map(e=>[e.id,e]));
  const regs=Object.entries(rsvps()).map(([id,r])=>({e:byId[id],r})).filter(x=>x.e).sort((a,b)=>d(a.e.start)-d(b.e.start));
  const stars=saved().map(id=>byId[id]).filter(Boolean);
  return `<section class="hero"><span class="label">My pass</span><h1>${esc(me.name||"")}</h1><p class="mono">${esc(me.email||"")}${me.year?` · ${esc(me.year)}`:""}${me.dept?` · ${esc(me.dept)}`:""}</p>${me.personalEmail?`<p class="muted" style="font-size:13.5px">Got your institutional email? Update it under Your details below.</p>`:""}</section>
  <div class="section"><h2>Registered</h2>${regs.length?regs.map(({e,r})=>`<div class="pass"><div style="min-width:0"><h3>${esc(e.title)}</h3><p class="muted">${esc(fmtDay(e.start))} · ${esc(fmtTime(e.start))}${isPast(e)?" · ended":""}</p><button class="btn sm ghost" data-act="open" data-id="${esc(e.id)}" style="margin-top:6px;padding-left:0">View details</button></div><div style="text-align:right"><span class="label">Entry code</span><div class="code">${esc(r.code)}</div></div></div>`).join(""):`<div class="empty"><p>You haven't registered for anything yet.</p><button class="btn" data-act="nav" data-v="events">Browse events</button></div>`}</div>
  ${stars.length?`<div class="section"><h2>Starred</h2><div class="list">${stars.map(e=>ticket(e)).join("")}</div></div>`:""}
  <div class="section"><h2>Your details</h2><div class="panel">${profileForm("edit")}</div></div>`;
}
function interestPicker(sel){
  const opts=[...new Set([...DEFAULT_INTERESTS, ...allTags()])];
  return `<div class="row" role="group" aria-label="Interests">${opts.map(t=>`<button type="button" class="chip" data-act="interest" data-t="${esc(t)}" aria-pressed="${sel.includes(t)}">${esc(t)}</button>`).join("")}</div>`;
}
// mode: "signup" (new account), "complete" (signed in, no profile yet), "edit" (My pass)
function profileForm(mode){
  const me=S.me||{}; const pend=getPending()||{}; const src=mode==="edit"?me:pend;
  const year=S._year!==undefined?S._year:(src.year||""); const sel=S._pick||src.interests||[];
  const doms=S.settings.allowedDomains||[]; const fixedEmail=mode==="signup"?"":(mode==="edit"?me.email:(S.user&&S.user.email)||"");
  return `<form id="profile" data-mode="${mode}" novalidate>
    <div class="field"><label for="pf-year">Your year</label><select class="inp" id="pf-year" required>
      <option value="" ${!year?"selected":""} disabled>Choose your year first</option>${YEARS.map(y=>`<option ${year===y?"selected":""}>${y}</option>`).join("")}</select></div>
    <div class="field"><label for="pf-name">Full name</label><input class="inp" id="pf-name" required autocomplete="name" value="${esc(src.name||"")}"></div>
    ${mode==="signup"?`<div class="field"><label for="pf-email" id="pf-email-label">${year===FRESHER?"Email":"Institutional email"}</label><input class="inp" id="pf-email" type="email" required autocomplete="email" placeholder="${year===FRESHER?"you@gmail.com":(doms[0]?"you@"+esc(doms[0]):"you@yourcollege.ac.in")}" value="${esc(pend.email||"")}">
      <span class="hint" id="pf-email-hint">${esc(emailHint(year))}</span></div>
      <div class="field"><label for="pf-pass">Create a password</label><input class="inp" id="pf-pass" type="password" autocomplete="new-password" minlength="6"><span class="hint">At least 6 characters.</span></div>`
    :`<div class="field"><label>Email</label><p class="mono">${esc(fixedEmail)}</p>${mode==="edit"&&me.personalEmail?`<span class="hint">Got your institutional email? Sign out and create a new account with it.</span>`:""}${mode==="complete"?`<span class="hint" id="pf-email-hint">${esc(emailHint(year))}</span>`:""}</div>`}
    <div class="field"><label for="pf-dept">Department or course <span class="muted">(optional)</span></label><input class="inp" id="pf-dept" value="${esc(src.dept||"")}"></div>
    <div class="field"><label>What are you into?</label><span class="hint">Pick a few. Your suggestions are built from these.</span>${interestPicker(sel)}</div>
    <label class="row" style="font-size:14px"><input type="checkbox" id="pf-optin" ${src.optIn!==false?"checked":""}> Email me about new events and updates</label>
    <p class="err" id="pf-err" ${S.gateErr&&mode!=="edit"?"":"hidden"}>${esc(mode!=="edit"?S.gateErr||"":"")}</p>
    <button class="btn primary" type="submit">${mode==="signup"?"Create account":mode==="complete"?"Enter the portal":"Save details"}</button>
  </form>`;
}
function gate(){
  const head=sub=>`<header><span class="label">${esc(S.settings.organizer||"Members only")}</span><h1 style="font-size:30px">${esc(S.settings.portalName||"Campus Event Pass")}</h1><p style="opacity:.8">${sub}</p></header>`;
  const err=id=>`<p class="err" id="${id}" ${S.gateErr?"":"hidden"}>${esc(S.gateErr||"")}</p>`;
  const card=(sub,body)=>`<div class="gate"><div class="card">${head(sub)}${body}</div></div>`;
  if(!CONFIGURED) return card("Setup isn't finished.", `<div style="padding:22px" class="muted">Paste your Firebase settings into <span class="mono">firebase-config.js</span>, then reload this page. The setup guide shows where to find them.</div>`);
  if(S.user && !S.user.emailVerified) return card(`Confirm your email to continue.`,
    `<form id="verifyform" novalidate><p>We sent a verification link to <b>${esc(S.user.email)}</b>. Open it, then come back here and press the button below. Check your spam folder if you don't see it.</p>
    ${err("vf-err")}<button class="btn primary" type="submit">I've verified my email</button>
    <div class="row"><button class="btn ghost" type="button" data-act="resend">Send the link again</button><button class="btn ghost" type="button" data-act="logout">Use a different email</button></div></form>`);
  if(S.user && !S.me) return card("One last step: tell us about yourself.", profileForm("complete")+`<p style="padding:0 22px 20px"><button class="btn sm ghost" data-act="logout">Sign out</button></p>`);
  if(S.gate==="signup") return card("Create your account. First-years can use a personal email; everyone else needs their institutional one.",
    profileForm("signup")+`<p style="padding:0 22px 20px;font-size:13.5px" class="muted">Already have an account? <button class="btn sm ghost" data-act="gate" data-v="signin">Sign in</button></p>`);
  if(S.gate==="reset") return card("Reset your password.", `<form id="resetform" novalidate><div class="field"><label for="rf-email">Your account email</label><input class="inp" id="rf-email" type="email" autocomplete="email"></div>
    ${err("rf-err")}<button class="btn primary" type="submit">Email me a reset link</button><button class="btn ghost" type="button" data-act="gate" data-v="signin">Back to sign in</button></form>`);
  return card("Sign in to see events, register and get suggestions.",
    `<form id="signinform" novalidate><div class="field"><label for="si-email">Email</label><input class="inp" id="si-email" type="email" autocomplete="email"></div>
    <div class="field"><label for="si-pass">Password</label><input class="inp" id="si-pass" type="password" autocomplete="current-password"></div>
    ${err("si-err")}<button class="btn primary" type="submit">Sign in</button>
    <div class="row"><button class="btn ghost" type="button" data-act="gate" data-v="signup">Create an account</button><button class="btn ghost" type="button" data-act="gate" data-v="reset">Forgot password?</button></div></form>`);
}
function viewNotices(){
  const seen=(S.me&&S.me.lastSeenNotice)||"";
  return `<section class="hero"><span class="label">Notifications</span><h1>Updates from the organiser</h1></section>
  <div class="panel">${S.notices.length?S.notices.map(n=>`<div class="notice ${n.at>seen?"new":""}"><h3>${esc(n.title)}</h3><p class="desc">${esc(n.body)}</p><div class="row"><span class="label">${esc(fmtDay(n.at))}</span>${n.eventId?`<button class="btn sm ghost" data-act="open" data-id="${esc(n.eventId)}">Open event</button>`:""}</div></div>`).join(""):`<div class="empty" style="border:0"><p>No updates yet. Announcements will appear here.</p></div>`}</div>`;
}
function detail(){
  const e=S.events.find(x=>x.id===S.open); if(!e) return "";
  const reg=rsvps()[e.id]; const past=isPast(e); const closed=e.deadline&&d(e.deadline)<Date.now();
  const starred=saved().includes(e.id); const brochure=safeUrl(e.brochureUrl); const online=safeUrl(S.links[e.id]||"");
  const bens=(e.benefits||[]).filter(Boolean); const physical=e.mode!=="Online"&&where(e); const light=COVERS[e.cover]&&e.cover!=="ink";
  return `<div class="sheet-back" data-act="closebg"><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(e.title)}">
    <div class="dhead" style="${light?`background:${COVERS[e.cover]};color:#fff`:""}"><button class="close" data-act="close" aria-label="Close">×</button>
      <span class="label" style="${light?"color:#fff;opacity:.85":""}">${esc(e.mode||"In person")}${(e.tags||[]).length?" · "+esc(e.tags.join(" · ")):""}</span>
      <h1 style="font-size:clamp(26px,5vw,38px);padding-right:40px">${esc(e.title)}</h1>${e.tagline?`<p>${esc(e.tagline)}</p>`:""}</div>
    <div class="dbody">
      <div class="facts">
        <div class="fact"><span class="label">Date</span><b>${esc(fmtDay(e.start))}</b><span class="muted">${esc(fmtTime(e.start))}${e.end?" – "+esc(fmtTime(e.end)):""}${countdown(e.start)?" · "+esc(countdown(e.start)):""}</span></div>
        <div class="fact"><span class="label">Place</span><b>${esc(e.mode==="Online"?"Online":(e.venue||"To be announced"))}</b>${e.address&&e.mode!=="Online"?`<span class="muted">${esc(e.address)}</span>`:""}</div>
        <div class="fact"><span class="label">Entry</span><b class="num">${esc(money(e))}</b>${e.deadline?`<span class="muted">Register by ${esc(fmtDay(e.deadline))}</span>`:""}</div>
        ${e.audience?`<div class="fact"><span class="label">Who it's for</span><b>${esc(e.audience)}</b>${e.capacity?`<span class="muted num">${esc(e.capacity)} seats</span>`:""}</div>`:""}
      </div>
      ${reg?`<div class="pass"><div><span class="pill ok">You're registered</span><p class="muted" style="margin-top:6px">Show this code at the entry desk.</p></div><div class="code">${esc(reg.code)}</div></div>`:""}
      ${S.me?`<div class="row">
        ${reg?`<button class="btn ghost danger" data-act="unrsvp" data-id="${esc(e.id)}">Cancel registration</button>`
          : past?`<button class="btn" disabled>Event has ended</button>` : closed?`<button class="btn" disabled>Registration closed</button>`
          : seatsFull(e)?`<button class="btn" disabled>Seats full</button>` : `<button class="btn primary" data-act="rsvp" data-id="${esc(e.id)}">Register${Number(e.price)?` · ${esc(money(e))}`:""}</button>`}
        <button class="btn" data-act="star" data-id="${esc(e.id)}" aria-pressed="${starred}">${ICON.star}${starred?"Starred":"Interested"}</button>
        <button class="btn ghost" data-act="share" data-id="${esc(e.id)}">${ICON.link}Copy link</button></div>`
      :`<p class="muted">Sign in as a member to register for this event.</p>`}
      ${Number(e.price)&&!reg&&!past?`<p class="muted" style="font-size:13px">${esc(e.payNote||"Payment details are shared by the organiser after you register.")}</p>`:""}
      <div class="section" style="margin-top:4px"><span class="label">Save it</span><div class="actions">
        <a class="btn" href="${esc(gcal(e))}" target="_blank" rel="noopener">${ICON.cal}Google Calendar</a>
        <a class="btn" href="${esc(outlook(e))}" target="_blank" rel="noopener">${ICON.cal}Outlook</a>
        <button class="btn" data-act="ics" data-id="${esc(e.id)}">${ICON.cal}Apple / other (.ics)</button>
        ${physical?`<a class="btn" href="${esc(gmaps(e))}" target="_blank" rel="noopener">${ICON.pin}Save in Google Maps</a><a class="btn" href="${esc(amaps(e))}" target="_blank" rel="noopener">${ICON.pin}Apple Maps</a>`:""}
        ${brochure?`<a class="btn teal" href="${esc(brochure)}" target="_blank" rel="noopener">${ICON.doc}Brochure</a>`:""}
        ${online&&(reg||S.isAdmin)?`<a class="btn teal" href="${esc(online)}" target="_blank" rel="noopener">${ICON.link}Join online</a>`:""}
      </div>${physical?`<p class="muted" style="font-size:13px">Google Maps opens on the venue. Tap <b>Save</b> there to add it to your saved places.</p>`:""}</div>
      ${bens.length?`<div class="section" style="margin-top:4px"><h2>What you'll get</h2><ul class="benefits">${bens.map(b=>`<li>${esc(b)}</li>`).join("")}</ul></div>`:""}
      ${e.description?`<div class="section" style="margin-top:4px"><h2>About</h2><p class="desc">${esc(e.description)}</p></div>`:""}
      ${e.contact?`<p class="muted">Questions? Write to <span class="mono" style="user-select:all">${esc(e.contact)}</span></p>`:""}
      ${S.isAdmin?`<div class="row"><span class="label">Admin</span><span class="num">${regCountOf(e.id)} registered</span><button class="btn sm" data-act="edit" data-id="${esc(e.id)}">Edit event</button></div>`:""}
    </div></div></div>`;
}

/* ---------- admin ---------- */
function viewAdmin(){
  const t=S.adminTab; const tabs=[["events","Events"],["new",S.editing?"Edit event":"Add event"],["notify","Notify"],["people","Members"],["settings","Settings"]];
  const body = t==="events"?adminEvents(): t==="new"?eventForm(): t==="notify"?adminNotify(): t==="people"?adminPeople(): adminSettings();
  return `<section class="hero"><span class="label">Organiser desk</span><h1>Admin</h1></section>
    <div class="subtabs">${tabs.map(([k,l])=>`<button class="tab" data-act="atab" data-v="${k}" ${t===k?'aria-current="page"':""}>${l}</button>`).join("")}</div>
    <div class="section" style="margin-top:16px">${body}</div>`;
}
function adminEvents(){
  const evs=[...S.events].sort((a,b)=>d(b.start)-d(a.start));
  const totalReg=S.members.reduce((n,m)=>n+Object.keys(m.rsvps||{}).length,0);
  return `<div class="grid2"><div class="panel"><span class="label">Upcoming events</span><h1 class="num">${S.events.filter(e=>!isPast(e)).length}</h1></div>
    <div class="panel"><span class="label">Members signed up</span><h1 class="num">${S.members.length}</h1></div>
    <div class="panel"><span class="label">Registrations</span><h1 class="num">${totalReg}</h1></div></div>
    <div class="row" style="justify-content:space-between"><h2>All events</h2><button class="btn primary" data-act="newev">Add event</button></div>
    ${evs.length?`<div class="panel scroll" style="padding:6px 10px"><table class="atable"><thead><tr><th>Event</th><th>Date</th><th>Registered</th><th></th></tr></thead><tbody>
    ${evs.map(e=>`<tr><td><b>${esc(e.title)}</b><br><span class="muted">${esc(e.status==="draft"?"Draft":isPast(e)?"Ended":"Published")} · ${esc(money(e))}</span></td><td class="num" style="white-space:nowrap">${esc(fmtDay(e.start))}</td><td class="num">${regCountOf(e.id)}${e.capacity?" / "+esc(e.capacity):""}</td>
      <td><div class="row" style="justify-content:flex-end"><button class="btn sm" data-act="open" data-id="${esc(e.id)}">View</button><button class="btn sm" data-act="edit" data-id="${esc(e.id)}">Edit</button><button class="btn sm" data-act="mailev" data-id="${esc(e.id)}">Email</button>
        ${S.confirmDel===e.id?`<span class="confirm">Delete for good? <button class="btn sm danger" data-act="del" data-id="${esc(e.id)}">Delete</button><button class="btn sm ghost" data-act="nodel">Keep</button></span>`:`<button class="btn sm ghost danger" data-act="askdel" data-id="${esc(e.id)}">Delete</button>`}
      </div></td></tr>`).join("")}</tbody></table></div>`:`<div class="empty"><p>No events yet.</p></div>`}`;
}
function eventForm(){
  const e=S.editing?(S.events.find(x=>x.id===S.editing)||{}):{currency:"INR",mode:"In person",cover:"marigold",status:"published"};
  const f=(id,label,val,attrs="",hint="")=>`<div class="field"><label for="${id}">${label}</label><input class="inp" id="${id}" value="${esc(val??"")}" ${attrs}>${hint?`<span class="hint">${hint}</span>`:""}</div>`;
  return `<div class="panel"><form id="evform" novalidate>
    ${f("ev-title","Event name",e.title,"required")}${f("ev-tagline","One-line pitch",e.tagline,"maxlength=140","Shown on the ticket card.")}
    <div class="split">${f("ev-start","Starts",toLocalInput(e.start),'type="datetime-local" required')}${f("ev-end","Ends",toLocalInput(e.end),'type="datetime-local"')}</div>
    <div class="split"><div class="field"><label for="ev-mode">Format</label><select class="inp" id="ev-mode">${["In person","Online","Hybrid"].map(m=>`<option ${e.mode===m?"selected":""}>${m}</option>`).join("")}</select></div>${f("ev-deadline","Registration closes",toLocalInput(e.deadline),'type="datetime-local"')}</div>
    <div class="split">${f("ev-venue","Venue",e.venue,"","e.g. Main Auditorium, Block C")}${f("ev-address","Address for maps",e.address,"","Full address, so the maps link lands on the right spot.")}</div>
    <div class="split">${f("ev-maps","Google Maps link (optional)",e.mapsUrl,'type="url"',"Paste a share link to override the address search.")}${f("ev-online","Online joining link",S.links[S.editing]||"",'type="url"',"Shown to registered members only.")}</div>
    <div class="split">${f("ev-price","Price (0 = free)",e.price??0,'type="number" min="0" step="1"')}<div class="field"><label for="ev-cur">Currency</label><select class="inp" id="ev-cur">${["INR","USD","EUR","GBP"].map(c=>`<option ${e.currency===c?"selected":""}>${c}</option>`).join("")}</select></div>${f("ev-cap","Seats",e.capacity??"",'type="number" min="0"')}</div>
    ${f("ev-pay","Payment note",e.payNote,"","e.g. Pay at the desk, or UPI details are emailed after registration.")}
    ${f("ev-brochure","Brochure link",e.brochureUrl,'type="url"',"A Google Drive or website link to the PDF brochure.")}
    ${f("ev-tags","Topics",(e.tags||[]).join(", "),"","Comma separated. These drive the suggestions, e.g. AI & ML, Career")}
    ${f("ev-aud","Who it's for",e.audience,"","e.g. All UG and PG students")}
    <div class="field"><label for="ev-ben">How attendees benefit</label><textarea class="inp" id="ev-ben" placeholder="One benefit per line">${esc((e.benefits||[]).join("\n"))}</textarea></div>
    <div class="field"><label for="ev-desc">Full description</label><textarea class="inp" id="ev-desc" style="min-height:130px">${esc(e.description||"")}</textarea></div>
    <div class="split">${f("ev-contact","Contact email",e.contact,'type="email"')}
      <div class="field"><label for="ev-cover">Ticket colour</label><select class="inp" id="ev-cover">${Object.keys(COVERS).map(c=>`<option value="${c}" ${e.cover===c?"selected":""}>${c[0].toUpperCase()+c.slice(1)}</option>`).join("")}</select></div>
      <div class="field"><label for="ev-status">Visibility</label><select class="inp" id="ev-status"><option value="published" ${e.status!=="draft"?"selected":""}>Published</option><option value="draft" ${e.status==="draft"?"selected":""}>Draft (admins only)</option></select></div></div>
    ${!S.editing?`<label class="row" style="font-size:14px"><input type="checkbox" id="ev-announce" checked> Post an announcement to everyone's notifications</label>
      ${S.smtp?`<div class="field"><label for="ev-emailto">Email about this event</label><select class="inp" id="ev-emailto"><option value="tags">Members interested in these topics</option><option value="all">All members</option><option value="none">Don't email</option></select><span class="hint">Only people who agreed to receive emails.</span></div>`:""}`:""}
    <p class="err" id="ev-err" hidden></p>
    <div class="row"><button class="btn primary" type="submit">${S.editing?"Save changes":"Publish event"}</button><button class="btn ghost" type="button" data-act="atab" data-v="events">Cancel</button></div>
  </form></div>`;
}
function audience(){
  const m=S.mail; let list=S.members.filter(x=>x.email);
  if(m.aud==="event") list=list.filter(x=>x.rsvps&&x.rsvps[m.event]);
  if(m.aud==="tag") list=list.filter(x=>(x.interests||[]).includes(m.tag));
  if(m.optin) list=list.filter(x=>x.optIn!==false);
  return list;
}
function adminNotify(){
  const m=S.mail; const rec=audience(); const evs=[...S.events].sort((a,b)=>d(b.start)-d(a.start)); const tags=[...new Set([...DEFAULT_INTERESTS,...allTags()])];
  const gmail="https://mail.google.com/mail/?view=cm&fs=1&bcc="+encodeURIComponent(rec.map(x=>x.email).join(","))+"&su="+encodeURIComponent(m.subject)+"&body="+encodeURIComponent(m.body);
  const off=rec.length?"":'aria-disabled="true" style="pointer-events:none;opacity:.5"';
  return `<div class="panel"><h2>Email members</h2>
    <p class="muted">${S.smtp?"Send straight from the portal. Everyone goes in BCC, so nobody sees the other addresses.":"The message opens in Gmail with everyone in BCC, ready for you to send from your account."}</p>
    <div class="split"><div class="field"><label for="m-aud">Send to</label><select class="inp" id="m-aud"><option value="all" ${m.aud==="all"?"selected":""}>All members</option><option value="event" ${m.aud==="event"?"selected":""}>Registered for an event</option><option value="tag" ${m.aud==="tag"?"selected":""}>Interested in a topic</option></select></div>
      ${m.aud==="event"?`<div class="field"><label for="m-ev">Event</label><select class="inp" id="m-ev">${evs.map(e=>`<option value="${esc(e.id)}" ${m.event===e.id?"selected":""}>${esc(e.title)}</option>`).join("")}</select></div>`:""}
      ${m.aud==="tag"?`<div class="field"><label for="m-tag">Topic</label><select class="inp" id="m-tag">${tags.map(t=>`<option ${m.tag===t?"selected":""}>${esc(t)}</option>`).join("")}</select></div>`:""}</div>
    <label class="row" style="font-size:14px"><input type="checkbox" id="m-optin" ${m.optin?"checked":""}> Only people who agreed to receive emails</label>
    <div class="field"><label for="m-sub">Subject</label><input class="inp" id="m-sub" value="${esc(m.subject)}"></div>
    <div class="field"><label for="m-body">Message</label><textarea class="inp" id="m-body" style="min-height:150px">${esc(m.body)}</textarea></div>
    <div class="field"><span class="label num">${rec.length} recipient${rec.length===1?"":"s"}</span><div class="copybox">${esc(rec.map(x=>x.email).join(", "))||"Nobody matches this audience yet."}</div></div>
    <div class="row">${S.smtp?`<button class="btn primary" data-act="sendmail" ${rec.length?"":"disabled"}>${ICON.mail}Send email now</button>`:`<a class="btn primary" href="${esc(gmail)}" target="_blank" rel="noopener" ${off}>${ICON.mail}Open in Gmail</a>`}
      <button class="btn ghost" data-act="copyem">Copy addresses</button><button class="btn ghost" data-act="copymsg">Copy message</button><button class="btn teal" data-act="postnotice">Post in portal</button></div></div>
    <div class="panel"><h2>Recent announcements</h2>${S.notices.length?S.notices.slice(0,8).map(n=>`<div class="notice"><h3>${esc(n.title)}</h3><span class="label">${esc(fmtDay(n.at))}</span>
      <div>${S.confirmDel==="n:"+n.id?`<span class="confirm">Remove it? <button class="btn sm danger" data-act="delnotice" data-id="${esc(n.id)}">Remove</button><button class="btn sm ghost" data-act="nodel">Keep</button></span>`:`<button class="btn sm ghost danger" data-act="askdel" data-id="n:${esc(n.id)}">Remove</button>`}</div></div>`).join(""):`<p class="muted">None yet.</p>`}</div>`;
}
function adminPeople(){
  const counts={}; S.members.forEach(m=>(m.interests||[]).forEach(t=>counts[t]=(counts[t]||0)+1));
  const top=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,10); const max=top[0]?.[1]||1;
  const ms=[...S.members].sort((a,b)=>(a.name||"").localeCompare(b.name||""));
  return `<div class="panel"><h2>What members want</h2><p class="muted">Interest counts across ${S.members.length} member${S.members.length===1?"":"s"}. Plan your next event around the top of this list.</p>
    ${top.length?top.map(([t,n])=>`<div class="bar"><span>${esc(t)}</span><div class="track"><div class="fill" style="width:${(n/max*100).toFixed(1)}%"></div></div><span class="num" style="text-align:right">${n}</span></div>`).join(""):`<p class="muted">No interests recorded yet.</p>`}</div>
    <div class="panel scroll" style="padding:6px 10px">${ms.length?`<table class="atable"><thead><tr><th>Name</th><th>Email</th><th>Interests</th><th>Events</th></tr></thead><tbody>
    ${ms.map(m=>`<tr><td><b>${esc(m.name)}</b><br><span class="muted">${esc([m.year,m.dept].filter(Boolean).join(" · "))}</span></td><td class="mono">${esc(m.email)}${m.personalEmail?'<br><span class="pill warn">personal · 1st year</span>':""}${m.optIn===false?'<br><span class="pill mute">no emails</span>':""}</td><td>${(m.interests||[]).map(t=>`<span class="tag">${esc(t)}</span>`).join(" ")}</td><td class="num">${Object.keys(m.rsvps||{}).length}</td></tr>`).join("")}</tbody></table>`:`<div class="empty" style="border:0"><p>Nobody has signed up yet. Share the portal link so people can register.</p></div>`}</div>`;
}
function adminSettings(){
  const s=S.settings;
  return `<div class="panel"><form id="setform">
    <div class="field"><label for="s-name">Portal name</label><input class="inp" id="s-name" value="${esc(s.portalName||"")}" placeholder="Campus Event Pass"></div>
    <div class="field"><label for="s-org">Organiser</label><input class="inp" id="s-org" value="${esc(s.organizer||"")}" placeholder="e.g. Tech Club, Dept. of CSE"></div>
    <div class="field"><label for="s-intro">Welcome line</label><input class="inp" id="s-intro" value="${esc(s.intro||"")}"></div>
    <div class="field"><label for="s-dom">Allowed email domains</label><input class="inp" id="s-dom" value="${esc((s.allowedDomains||[]).join(", "))}" placeholder="e.g. yourcollege.ac.in"><span class="hint">Leave empty to accept any non-personal address. With domains set, only those exact domains can sign in, so list each one (e.g. college.ac.in, cse.college.ac.in). First-years can still use a personal email.</span></div>
    <button class="btn primary" type="submit">Save settings</button></form></div>`;
}

function render(){
  if(S.dirty) return;
  if(!S.loaded){ if(!CONFIGURED){ $app.innerHTML=gate(); } return; }
  const focus=document.activeElement&&document.activeElement.id; const pos=focus&&document.activeElement.selectionStart;
  if(!S.user || !S.user.emailVerified || !S.me){ $app.innerHTML=gate(); }
  else {
    const main = S.view==="foryou"?viewForYou(): S.view==="pass"?viewPass(): S.view==="notices"?viewNotices(): S.view==="admin"&&S.isAdmin?viewAdmin(): viewEvents();
    $app.innerHTML = header()+`<main class="wrap">${main}</main>`+(S.open?detail():"");
  }
  if(focus){ const el=document.getElementById(focus); if(el){ el.focus(); try{ if(pos!=null) el.setSelectionRange(pos,pos);}catch(e){} } }
}

/* ---------- actions ---------- */
function openEvent(id){
  S.open=id; try{ history.replaceState(null,"","#e-"+id);}catch(e){}
  const ev=S.events.find(x=>x.id===id);
  if(ev && (rsvps()[id] || S.isAdmin)) loadLink(id);
  if(ev && S.me && !S.viewed.has(id) && (ev.tags||[]).length){ S.viewed.add(id);
    const tv={...(S.me.tagViews||{})}; ev.tags.forEach(t=>tv[t]=(tv[t]||0)+1); saveMe({tagViews:tv}); return; }
  render();
}
function closeEvent(){ S.open=null; try{ history.replaceState(null,"",location.pathname+location.search);}catch(e){} render(); }
function mailBody(e){ return `Hi,\n\n${e.title}${e.tagline?" — "+e.tagline:""}\n\nWhen: ${fmtDay(e.start)}, ${fmtTime(e.start)}\nWhere: ${e.mode==="Online"?"Online":where(e)}\nEntry: ${money(e)}\n${(e.benefits||[]).length?"\nWhat you'll get:\n"+e.benefits.map(b=>"• "+b).join("\n")+"\n":""}\nRegister and add it to your calendar: ${eventUrl(e)}\n\n${S.settings.organizer||""}`.trim(); }
function code(){ const a="ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; const r=new Uint32Array(6); crypto.getRandomValues(r); return "EVT-"+[...r].map(x=>a[x%a.length]).join(""); }

async function register(id){
  const e=S.events.find(x=>x.id===id); if(!e||!S.me) return;
  if(seatsFull(e)) return toast("All seats are taken.");
  const next={...S.me, rsvps:{...rsvps(), [id]:{at:new Date().toISOString(), code:code()}}, updatedAt:new Date().toISOString()};
  const b=writeBatch(db); b.set(doc(db,"members",S.user.uid), next); b.update(doc(db,"events",id), {regCount:increment(1)});
  try{ await b.commit(); toast(`You're registered. Entry code ${next.rsvps[id].code}`); loadLink(id); }
  catch(err){ toast(err.code==="permission-denied"?"Couldn't register. The seats may have just filled up.":friendly(err)); }
}
async function unregister(id){
  const r={...rsvps()}; delete r[id];
  const b=writeBatch(db); b.set(doc(db,"members",S.user.uid), {...S.me, rsvps:r, updatedAt:new Date().toISOString()});
  if(S.events.some(e=>e.id===id)) b.update(doc(db,"events",id), {regCount:increment(-1)});
  try{ await b.commit(); toast("Registration cancelled"); }catch(err){ toast(friendly(err)); }
}

document.addEventListener("click", async ev=>{
  const b=ev.target.closest("[data-act]"); if(!b) return;
  const a=b.dataset.act, id=b.dataset.id; if(a!=="interest") S.dirty=false;
  if(a==="closebg"){ if(ev.target===b) closeEvent(); return; }
  if(a==="gate"){ S.gate=b.dataset.v; S.gateErr=""; S._year=undefined; S._pick=null; render(); return; }
  if(a==="logout"){ await signOut(auth).catch(()=>{}); S.gate="signin"; S.view="events"; S.open=null; S.gateErr=""; return; }
  if(a==="resend"){ try{ await sendEmailVerification(S.user,{url:PAGE_URL}); toast("Link sent again. Check your inbox and spam."); }catch(e){ toast(friendly(e)); } return; }
  if(a==="nav"){ S.view=b.dataset.v; S.open=null;
    if(S.view==="notices" && S.notices[0] && S.me && (S.me.lastSeenNotice||"")<S.notices[0].at){ saveMe({lastSeenNotice:S.notices[0].at}); }
    render(); scrollTo(0,0); return; }
  if(a==="open"){ ev.preventDefault(); openEvent(id); return; }
  if(a==="close"){ closeEvent(); return; }
  if(a==="tag"){ S.tag=b.dataset.t; render(); return; }
  if(a==="past"){ S.past=!S.past; render(); return; }
  if(a==="interest"){ const cur=[...(S._pick||(document.getElementById("profile")?.dataset.mode==="edit"?(S.me&&S.me.interests):(getPending()||{}).interests)||[])]; const t=b.dataset.t; const i=cur.indexOf(t); i>=0?cur.splice(i,1):cur.push(t); S._pick=cur; b.setAttribute("aria-pressed", i<0); return; }
  if(a==="rsvp"){ b.disabled=true; register(id); return; }
  if(a==="unrsvp"){ b.disabled=true; unregister(id); return; }
  if(a==="star"){ const s=[...saved()]; const i=s.indexOf(id); i>=0?s.splice(i,1):s.push(id); saveMe({saved:s}); return; }
  if(a==="ics"){ const e=S.events.find(x=>x.id===id); if(e) downloadIcs(e); return; }
  if(a==="share"){ const e=S.events.find(x=>x.id===id); copy(eventUrl(e), "Event link copied"); return; }
  if(a==="atab"){ S.adminTab=b.dataset.v; if(S.adminTab!=="new") S.editing=null; S.confirmDel=null; render(); return; }
  if(a==="newev"){ S.editing=null; S.adminTab="new"; S.view="admin"; S.open=null; render(); return; }
  if(a==="edit"){ S.editing=id; S.adminTab="new"; S.view="admin"; S.open=null; loadLink(id); render(); scrollTo(0,0); return; }
  if(a==="askdel"){ S.confirmDel=id; render(); return; }
  if(a==="nodel"){ S.confirmDel=null; render(); return; }
  if(a==="del"){ S.confirmDel=null; try{ await deleteDoc(doc(db,"events",id)); await deleteDoc(doc(db,"eventLinks",id)).catch(()=>{}); toast("Event deleted"); }catch(e){ toast(friendly(e)); } return; }
  if(a==="delnotice"){ S.confirmDel=null; try{ await deleteDoc(doc(db,"notices",id)); toast("Announcement removed"); }catch(e){ toast(friendly(e)); } return; }
  if(a==="mailev"){ const e=S.events.find(x=>x.id===id); S.mail={...S.mail, aud:"event", event:id, subject:`Reminder: ${e.title} on ${fmtDay(e.start)}`, body:mailBody(e)}; S.adminTab="notify"; render(); return; }
  if(a==="copyem"){ copy(audience().map(x=>x.email).join(", "), "Addresses copied"); return; }
  if(a==="copymsg"){ copy(S.mail.subject+"\n\n"+S.mail.body, "Message copied"); return; }
  if(a==="postnotice"){ if(!S.mail.subject.trim()) return toast("Add a subject first");
    try{ await addDoc(collection(db,"notices"),{title:S.mail.subject.trim(), body:S.mail.body.trim(), eventId:S.mail.aud==="event"?S.mail.event:"", at:new Date().toISOString()}); toast("Posted to everyone's notifications"); }catch(e){ toast(friendly(e)); } return; }
});
document.addEventListener("input", ev=>{
  const t=ev.target;
  if(t.closest && t.closest("#evform,#setform,#profile")) S.dirty=true;
  if(t.id==="q"){ S.q=t.value; clearTimeout(S._qt); S._qt=setTimeout(render,180); }
  if(t.id==="m-sub") S.mail.subject=t.value;
  if(t.id==="m-body") S.mail.body=t.value;
});
document.addEventListener("change", ev=>{
  const t=ev.target;
  if(t.id==="pf-year"){ S._year=t.value; const fr=t.value===FRESHER; const h=document.getElementById("pf-email-hint"); if(h) h.textContent=emailHint(t.value);
    const l=document.getElementById("pf-email-label"); if(l) l.textContent=fr?"Email":"Institutional email";
    const i=document.getElementById("pf-email"); if(i){ const doms=S.settings.allowedDomains||[]; i.placeholder=fr?"you@gmail.com":(doms[0]?"you@"+doms[0]:"you@yourcollege.ac.in"); }
    const e=document.getElementById("pf-err"); if(e) e.hidden=true; }
  if(t.id==="m-aud"){ S.mail.aud=t.value; if(t.value==="event"&&!S.mail.event&&S.events[0]) S.mail.event=S.events[0].id; if(t.value==="tag"&&!S.mail.tag) S.mail.tag=DEFAULT_INTERESTS[0]; render(); }
  if(t.id==="m-ev"){ S.mail.event=t.value; render(); }
  if(t.id==="m-tag"){ S.mail.tag=t.value; render(); }
  if(t.id==="m-optin"){ S.mail.optin=t.checked; render(); }
  if(t.id==="m-sub"||t.id==="m-body") render();
});
document.addEventListener("keydown", ev=>{ if(ev.key==="Escape" && S.open) closeEvent(); });

document.addEventListener("submit", async ev=>{
  ev.preventDefault(); const f=ev.target;
  const v=id=>(document.getElementById(id)?.value||"").trim();
  const showErr=(id,m)=>{ const e=document.getElementById(id); if(e){ e.textContent=m; e.hidden=false; } else toast(m); S.dirty=true; };
  const btn=f.querySelector('[type="submit"]'); if(btn) btn.disabled=true;
  try{
    if(f.id==="signinform"){ S.gateErr=""; await signInWithEmailAndPassword(auth, v("si-email"), document.getElementById("si-pass").value); S.dirty=false; return; }
    if(f.id==="resetform"){ await sendPasswordResetEmail(auth, v("rf-email"), {url:PAGE_URL}); S.dirty=false; S.gate="signin"; toast("Reset link sent. Check your inbox and spam."); render(); return; }
    if(f.id==="verifyform"){
      await S.user.reload();
      if(!auth.currentUser.emailVerified) return showErr("vf-err","Not verified yet. Open the link in the email first, then press this button again.");
      await auth.currentUser.getIdToken(true); S.user=auth.currentUser; S.dirty=false; S.loaded=false; await checkAdmin(); listen(); return;
    }
    if(f.id==="profile"){
      const mode=f.dataset.mode; const year=v("pf-year");
      const email = mode==="signup" ? v("pf-email").toLowerCase() : mode==="edit" ? S.me.email : S.user.email.toLowerCase();
      const name=v("pf-name"); const interests=S._pick||(mode==="edit"?S.me.interests:(getPending()||{}).interests)||[];
      let adminEmail=S.isAdmin;
      if(!adminEmail && mode==="signup" && /@/.test(email)){ try{ adminEmail=(await getDoc(doc(db,"admins",email))).exists(); }catch(e){} }
      const err=(adminEmail?"":yearEmailError(year,email)) || (name.length<2?"Enter your full name.":"") || (!interests.length?"Pick at least one interest so we can suggest events.":"");
      if(err) return showErr("pf-err",err);
      const profile={name, email, year, dept:v("pf-dept"), interests, optIn:document.getElementById("pf-optin").checked};
      if(mode==="edit"){ S.dirty=false; S._pick=null; S._year=undefined;
        await saveMe({...profile, personalEmail:year===FRESHER && !institutional(email.split("@")[1])}); toast("Details saved"); return; }
      if(mode==="complete"){ S.gateErr=""; await setDoc(doc(db,"members",S.user.uid), newMember(profile)); S.dirty=false; S._pick=null; S._year=undefined; S.view="foryou"; toast("Welcome in"); return; }
      const pass=document.getElementById("pf-pass").value; if(pass.length<6) return showErr("pf-err","Use a password with at least 6 characters.");
      setPending(profile);
      const cred=await createUserWithEmailAndPassword(auth, email, pass);
      await sendEmailVerification(cred.user, {url:PAGE_URL});
      S.dirty=false; S._pick=null; S._year=undefined; S.gateErr=""; render(); return;
    }
    if(f.id==="evform"){
      const iso=x=>x?new Date(x).toISOString():"";
      if(!v("ev-title")) return showErr("ev-err","Give the event a name.");
      if(!v("ev-start")) return showErr("ev-err","Set when the event starts.");
      if(v("ev-end") && new Date(v("ev-end"))<=new Date(v("ev-start"))) return showErr("ev-err","The end time has to be after the start.");
      for(const k of ["ev-maps","ev-online","ev-brochure"]) if(v(k)&&!safeUrl(v(k))) return showErr("ev-err","Links must start with https://");
      const data={ title:v("ev-title"), tagline:v("ev-tagline"), start:iso(v("ev-start")), end:iso(v("ev-end")), mode:v("ev-mode"), deadline:iso(v("ev-deadline")),
        venue:v("ev-venue"), address:v("ev-address"), mapsUrl:v("ev-maps"), price:Number(v("ev-price")||0), currency:v("ev-cur"),
        capacity:Number(v("ev-cap")||0)||null, payNote:v("ev-pay"), brochureUrl:v("ev-brochure"), tags:v("ev-tags").split(",").map(s=>s.trim()).filter(Boolean),
        audience:v("ev-aud"), benefits:document.getElementById("ev-ben").value.split("\n").map(s=>s.trim()).filter(Boolean),
        description:document.getElementById("ev-desc").value.trim(), contact:v("ev-contact"), cover:v("ev-cover"), status:v("ev-status"), updatedAt:new Date().toISOString() };
      const online=v("ev-online");
      let id=S.editing;
      if(id){ const old=S.events.find(x=>x.id===id)||{}; await setDoc(doc(db,"events",id), {...data, regCount:old.regCount||0, createdAt:old.createdAt||data.updatedAt}); toast("Changes saved"); }
      else {
        const ref=doc(collection(db,"events")); id=ref.id;
        await setDoc(ref, {...data, regCount:0, createdAt:data.updatedAt});
        if(document.getElementById("ev-announce")?.checked && data.status!=="draft")
          await addDoc(collection(db,"notices"),{title:"New event: "+data.title, body:`${data.tagline||""}\n${fmtDay(data.start)}, ${fmtTime(data.start)} · ${data.mode==="Online"?"Online":data.venue}`.trim(), eventId:id, at:new Date().toISOString()});
        S.mail={...S.mail, aud:"tag", tag:data.tags[0]||DEFAULT_INTERESTS[0], subject:"New event: "+data.title, body:mailBody({...data,id})};
        if(!data.tags.length) S.mail.aud="all";
        toast("Published. Email members from the Notify tab.");
      }
      if(online) await setDoc(doc(db,"eventLinks",id),{url:online}); else await deleteDoc(doc(db,"eventLinks",id)).catch(()=>{});
      S.links[id]=online;
      S.dirty=false; S.editing=null; S.adminTab="events"; render(); return;
    }
    if(f.id==="setform"){
      await setDoc(doc(db,"settings","portal"),{portalName:v("s-name"), organizer:v("s-org"), intro:v("s-intro"),
        allowedDomains:v("s-dom").split(",").map(s=>s.trim().toLowerCase().replace(/^@/,"")).filter(Boolean)});
      S.dirty=false; toast("Settings saved"); return;
    }
  }catch(e){
    const errId={profile:"pf-err",signinform:"si-err",resetform:"rf-err",verifyform:"vf-err",evform:"ev-err"}[f.id];
    showErr(errId, f.id==="profile"&&e.code==="permission-denied" ? "Your email isn't accepted for the year you chose. First-years can use a personal email; everyone else needs their institutional one." : friendly(e));
  }finally{ if(btn) btn.disabled=false; }
});

/* ---------- boot ---------- */
async function checkAdmin(){
  S.isAdmin=false;
  if(!S.user||!S.user.emailVerified) return;
  try{ const s=await getDoc(doc(db,"admins",S.user.email.toLowerCase())); S.isAdmin=s.exists(); }catch(e){}
}
if(!CONFIGURED){ render(); }
else onAuthStateChanged(auth, async user=>{
  S.user=user; S.me=null; S.members=[]; S.links={}; S.loaded=false;
  if(user && user.emailVerified){ try{ await user.getIdToken(true); }catch(e){} }
  await checkAdmin(); listen();
});
setInterval(()=>{ if(S.user && !S.user.emailVerified && document.visibilityState==="visible" && !S.dirty){
  S.user.reload().then(async()=>{ if(auth.currentUser.emailVerified){ await auth.currentUser.getIdToken(true); S.user=auth.currentUser; await checkAdmin(); listen(); } }).catch(()=>{}); } }, 5000);

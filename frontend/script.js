// script.js - frontend logic (calls your backend endpoints)
// Assumes backend served at same host origin. Adjust baseURL if needed.
const baseURL = ""; // same origin; if backend on different host, set e.g. "http://localhost:5000"

function $qs(sel){ return document.querySelector(sel); }
function $qsAll(sel){ return document.querySelectorAll(sel); }

// --- UI Navigation ---
const navBtns = document.querySelectorAll(".nav-btn");
const pages = document.querySelectorAll(".page");
const pageTitle = $qs("#pageTitle");
navBtns.forEach(b=>{
  b.addEventListener("click", ()=>{
    navBtns.forEach(x=>x.classList.remove("active"));
    b.classList.add("active");
    const view = b.dataset.view;
    pages.forEach(p=>p.classList.add("hidden"));
    document.getElementById(view).classList.remove("hidden");
    pageTitle.textContent = b.textContent;
  });
});

// Quick actions
$qs("#quickPlan").addEventListener("click", ()=> {
  document.querySelector('[data-view="plan"]').classList.remove("hidden");
  document.querySelectorAll(".nav-btn").forEach(n=>n.classList.remove("active"));
  document.querySelector('.nav-btn[data-view="plan"]').classList.add("active");
  pageTitle.textContent="Plan";
});
$qs("#openChatMini").addEventListener("click", ()=> {
  document.querySelectorAll(".nav-btn").forEach(n=>n.classList.remove("active"));
  document.querySelector('.nav-btn[data-view="chat"]').classList.add("active");
  pages.forEach(p=>p.classList.add("hidden"));
  document.getElementById("chat").classList.remove("hidden");
  pageTitle.textContent="AI Chat";
});

// Dark mode toggle
const darkToggle = $qs("#darkToggle");
darkToggle.addEventListener("change", (e)=>{
  if(e.target.checked) document.documentElement.style.background = "#071023", document.body.style.background="#071023";
  else document.body.style.background = "";
});

// --- Wizard Steps ---
const steps = $qsAll(".step");
const panes = $qsAll(".step-pane");
let currentStep = 1;
function showStep(step){
  steps.forEach(s=> s.classList.toggle("active", parseInt(s.dataset.step)===step));
  panes.forEach(p=> p.classList.toggle("hidden", parseInt(p.dataset.step)!==step));
}
showStep(1);

$qs("#btnBack")?.addEventListener("click", ()=> {
  if(currentStep>1) currentStep--;
  showStep(currentStep);
});
$qsAll("[data-step]").forEach(s=> s.addEventListener("click", ()=> {
  currentStep = parseInt(s.dataset.step);
  showStep(currentStep);
}));

// next/back via generating plan flows
$qs("#btnGenerate")?.addEventListener("click", async ()=>{
  try{
    const payload = buildPlanPayload();
    // call backend api
    const resp = await fetch(`${baseURL}/api/plan_goal`, {
      method: "POST", headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload)
    });
    const data = await resp.json();
    if(data.error) alert("Error: "+data.error);
    else {
      currentPlan = data;
      savePlanToLocalStore(data);
      renderPlanResult(data);
      // switch to dashboard charts
      document.querySelectorAll(".nav-btn").forEach(n=>n.classList.remove("active"));
      document.querySelector('.nav-btn[data-view="dashboard"]').classList.add("active");
      pages.forEach(p=>p.classList.add("hidden"));
      document.getElementById("dashboard").classList.remove("hidden");
      pageTitle.textContent="Dashboard";
    }
  }catch(err){ console.error(err); alert("Failed to generate plan: " + err.message) }
});

// Build payload from form
function buildPlanPayload(){
  const goalType = $qs("#goalType").value;
  const monthly_income = Number($qs("#income").value || 0);
  const existing_savings = Number($qs("#existingSavings").value || 0);
  const duration_years = Number($qs("#durationYears").value || 1);
  const emergency = {
    one_time: Number($qs("#oneTimeExpense")?.value || 0),
    income_reduction_pct: Number($qs("#incomeReductionPct")?.value || 0),
    recovery_months: Number($qs("#recoveryMonths")?.value || 0)
  };

  const payload = {
    goal_type: goalType,
    monthly_income, existing_savings,
    duration_years,
    emergency
  };

  if(goalType==="gold"){
    const tgtType = $qs("#goldTargetType").value;
    if(tgtType==="grams") payload.target_grams = Number($qs("#goldTarget").value || 0);
    else payload.target_value = Number($qs("#goldTarget").value || 0);
  } else {
    const tgtType = $qs("#propTargetType").value;
    if(tgtType==="sqft") payload.target_sqft = Number($qs("#propTarget").value || 0);
    else payload.target_value = Number($qs("#propTarget").value || 0);

    payload.Locality = $qs("#propLocality").value || "Locality_84";
    payload.BHK = Number($qs("#propBHK").value || 2);
  }
  return payload;
}

// live preview updates
const livePreview = $qs("#livePreview");
function updateLivePreview(){
  try{
    const p = buildPlanPayload();
    let txt="";
    if(p.goal_type==="gold"){
      let t = p.target_grams ? `${p.target_grams} g` : (p.target_value ? `₹${p.target_value}` : "—");
      const m = (p.target_value && p.duration_years) ? (p.target_value/p.duration_years/12).toFixed(0) : (p.target_grams ? ( (p.target_grams*5000)/ (p.duration_years*12) ).toFixed(0) : "—");
      txt = `Target: ${t}\nEst. monthly (preview): ₹${m}`;
    } else {
      let t = p.target_sqft ? `${p.target_sqft} SqFt` : (p.target_value ? `₹${p.target_value}` : "—");
      const m = (p.target_value && p.duration_years) ? (p.target_value/p.duration_years/12).toFixed(0) : "—";
      txt = `Target: ${t}\nEst. monthly (preview): ₹${m}`;
    }
    livePreview.textContent = txt;
    $qs("#previewSummary").textContent = txt;
  }catch(e){ console.warn(e) }
}
$qsAll("#income,#existingSavings,#durationYears,#goldTarget,#propTarget,#goldTargetType,#propTargetType,#goalType,#propBHK,#propLocality").forEach(el=>{
  el.addEventListener("input", updateLivePreview);
});
updateLivePreview();

// toggle goal-specific UI
$qs("#goalType").addEventListener("change", (e)=>{
  const val=e.target.value;
  if(val==="gold"){ $qs("#goldOpts").classList.remove("hidden"); $qs("#propOpts").classList.add("hidden"); }
  else { $qs("#goldOpts").classList.add("hidden"); $qs("#propOpts").classList.remove("hidden"); }
  updateLivePreview();
});
$qs("#goldTargetType").addEventListener("change",(e)=>{
  const t = e.target.value;
  $qs("#goldTargetLabel").innerHTML = t==="grams" ? 'Target (grams) <input type="number" id="goldTarget" placeholder="e.g. 100" />' : 'Target (₹) <input type="number" id="goldTarget" placeholder="e.g. 1000000" />';
  // rebind new input to listener
  setTimeout(()=>{ $qs("#goldTarget").addEventListener("input", updateLivePreview); }, 50);
});
$qs("#propTargetType").addEventListener("change",(e)=>{
  const t = e.target.value;
  $qs("#propTargetLabel").innerHTML = t==="sqft" ? 'Target (Sq Ft) <input type="number" id="propTarget" />' : 'Target (₹) <input type="number" id="propTarget" />';
  setTimeout(()=>{ $qs("#propTarget").addEventListener("input", updateLivePreview); }, 50);
});

// --- Plan storage locally ---
let currentPlan = null;
function savePlanToLocalStore(plan){
  const name = $qs("#planName").value || `plan_${new Date().toISOString()}`;
  const saved = JSON.parse(localStorage.getItem("plans_v1")||"[]");
  saved.unshift({name, plan, created: new Date().toISOString()});
  localStorage.setItem("plans_v1", JSON.stringify(saved));
  renderRecentPlans();
}
$qs("#savePlanLocal")?.addEventListener("click", ()=>{ if(currentPlan){ savePlanToLocalStore(currentPlan); alert("Saved locally"); } else alert("No plan to save yet.");});
$qs("#loadPlanLocal")?.addEventListener("click", ()=>{ loadLatestPlan(); });
$qs("#deletePlans")?.addEventListener("click", ()=>{ localStorage.removeItem("plans_v1"); renderRecentPlans(); alert("Deleted saved plans."); });

// render recent plans
function renderRecentPlans(){
  const container = $qs("#recentPlans");
  const list = JSON.parse(localStorage.getItem("plans_v1")||"[]");
  container.innerHTML = list.slice(0,6).map(item=>`<div class="plan"><strong>${item.name}</strong><div class="muted">${new Date(item.created).toLocaleString()}</div></div>`).join("") || "<div class='muted'>No saved plans</div>";
}
function loadLatestPlan(){
  const list = JSON.parse(localStorage.getItem("plans_v1")||"[]");
  if(!list.length){ alert("No saved plans"); return; }
  currentPlan = list[0].plan;
  renderPlanResult(currentPlan);
  alert("Loaded latest plan into dashboard.");
}
renderRecentPlans();

// render plan result on dashboard (charts + metrics)
function renderPlanResult(plan){
  // show metrics
  $qs("#metricGold").textContent = plan.forecast_used==="prophet" ? `Predicted ₹${plan.timeline[0].predicted_price_per_gram.toFixed(2)}` : "—";
  $qs("#metricSaved").textContent = `₹${(plan.existing_savings||0).toLocaleString()}`;
  // compute progress
  let progress = 0;
  if(plan.goal_type==="gold"){
    const achievedValue = (plan.timeline[plan.timeline.length-1].cumulative_grams * plan.timeline[plan.timeline.length-1].predicted_price_per_gram);
    progress = Math.min(100, achievedValue / plan.target_value_inr * 100);
  } else {
    const saved = plan.timeline[plan.timeline.length-1].cumulative_saved || 0;
    progress = Math.min(100, saved / plan.target_value_inr * 100);
  }
  $qs("#metricProgress").textContent = `${progress.toFixed(1)}%`;
  // charts
  // Forecast chart (gold)
  if(plan.goal_type==="gold"){
    const dates = plan.timeline.map(t=>t.date);
    const price = plan.timeline.map(t=>t.predicted_price_per_gram);
    const grams = plan.timeline.map(t=>t.cumulative_grams);
    Plotly.newPlot("chartForecast", [{
      x: dates, y: price, name:"Predicted ₹/g", type:"scatter", fill:'tonexty'
    }], {margin:{t:20}});
    Plotly.newPlot("chartSavings", [{
      x: dates, y: grams, name:"Cumulative grams", type:"scatter", fill:'tozeroy'
    }], {margin:{t:20}});
  } else {
    // property timeline
    const dates = plan.timeline.map(t=>t.date);
    const saved = plan.timeline.map(t=>t.cumulative_saved);
    Plotly.newPlot("chartForecast", [{
      x: dates, y: saved, name:"Cumulative Saved (INR)", type:"scatter", fill:'tozeroy'
    }], {margin:{t:20}});
    Plotly.newPlot("chartSavings", [{
      x: dates, y: plan.timeline.map(t=>t.progress_percent), name:"Progress %", type:"scatter"
    }], {margin:{t:20}});
  }
  // store currentPlan
  currentPlan = plan;
}

// --- Chat integration ---
$qs("#sendChat")?.addEventListener("click", sendChat);
$qs("#chatQuery")?.addEventListener("keydown", (e)=>{ if(e.key==="Enter") sendChat(); });

async function sendChat(){
  const q = $qs("#chatQuery").value.trim();
  if(!q) return;
  appendChatBubble("user", q);
  $qs("#chatQuery").value = "";
  try{
    appendChatBubble("ai", "Thinking...");
    const resp = await fetch(`${baseURL}/api/chat`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({query:q, context:{monthly_income: Number($qs("#income").value||0)}})});
    const data = await resp.json();
    // remove last "Thinking..."
    const ais = Array.from($qs("#chatWindow").children).filter(c=>c.classList.contains("ai"));
    if(ais.length) ais[ais.length-1].remove();
    appendChatBubble("ai", data.answer || "No answer");
  }catch(err){ console.error(err); appendChatBubble("ai", "Chat failed: "+err.message) }
}
function appendChatBubble(who, text){
  const d = document.createElement("div");
  d.classList.add("bubble", who==="user"?"user":"ai");
  d.innerText = text;
  $qs("#chatWindow").appendChild(d);
  $qs("#chatWindow").scrollTop = $qs("#chatWindow").scrollHeight;
}

// --- Emergency apply (recalculate locally and ask backend)
$qs("#applyEmergency")?.addEventListener("click", async ()=>{
  const em = {
    one_time: Number($qs("#oneTimeExpense").value || 0),
    income_reduction_pct: Number($qs("#incomeReductionPct").value || 0),
    recovery_months: Number($qs("#recoveryMonths").value || 0)
  };
  const payload = buildPlanPayload();
  payload.emergency = em;
  try{
    const resp = await fetch(`${baseURL}/api/plan_goal`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
    const data = await resp.json();
    if(data.error) alert(data.error);
    else { currentPlan = data; renderPlanResult(data); savePlanToLocalStore(data); alert("Plan adjusted for emergency"); }
  }catch(err){ console.error(err); alert("Failed to adjust: "+err.message); }
});
$qs("#resetEmergency")?.addEventListener("click", ()=>{ $qs("#oneTimeExpense").value=""; $qs("#incomeReductionPct").value="0"; $qs("#recoveryMonths").value="6"; });

// --- Admin retrain ---
$qs("#btnTrain")?.addEventListener("click", async ()=>{
  if(!confirm("Retraining may be slow. Continue?")) return;
  $qs("#trainStatus").textContent = "Status: training...";
  try{
    const sample = Number($qs("#trainSample").value || 50000);
    const resp = await fetch(`${baseURL}/api/train_all`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({sample_size: sample})});
    const data = await resp.json();
    if(data.error) { $qs("#trainStatus").textContent = "Status: failed"; alert("Train failed: "+data.error); }
    else { $qs("#trainStatus").textContent = "Status: done"; alert("Training finished. Metrics: " + JSON.stringify(data)); }
  }catch(err){ $qs("#trainStatus").textContent="Status: failed"; alert("Train error: "+err.message) }
});

// --- Export CSV & PDF ---
$qs("#btnExportCSV")?.addEventListener("click", ()=> {
  if(!currentPlan) return alert("No plan to export");
  const rows = currentPlan.timeline.map(t => {
    const obj = {...t};
    if(t.date instanceof Object) obj.date = t.date;
    return obj;
  });
  const csv = toCSV(rows);
  downloadFile(csv, `plan_${currentPlan.plan_id || 'export'}.csv`, 'text/csv');
});
$qs("#btnExportPDF")?.addEventListener("click", ()=> {
  if(!currentPlan) return alert("No plan to export");
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({unit:'pt', format:'a4'});
  doc.setFontSize(14);
  doc.text("Savings Plan", 40, 60);
  doc.setFontSize(10);
  doc.text(`Plan ID: ${currentPlan.plan_id || 'n/a'}`, 40, 80);
  doc.text(`Goal Type: ${currentPlan.goal_type}`, 40, 96);
  // add table as simple lines
  let y = 120;
  doc.setFontSize(9);
  doc.text("Date | Monthly INR | Value/grams | Cumulative", 40, y);
  y += 12;
  currentPlan.timeline.slice(0,40).forEach(row=>{
    doc.text(`${row.date} | ${row.monthly_amount_inr} | ${row.predicted_price_per_gram||''} | ${row.cumulative_grams||row.cumulative_saved||''}`, 40, y);
    y += 12;
    if(y>740){ doc.addPage(); y=40; }
  });
  doc.save(`plan_${currentPlan.plan_id||'export'}.pdf`);
});

// helper: CSV
function toCSV(arr){
  if(!arr.length) return "";
  const keys = Object.keys(arr[0]);
  const lines = [keys.join(",")].concat(arr.map(r=> keys.map(k=> JSON.stringify(r[k]||"")).join(",")));
  return lines.join("\n");
}
function downloadFile(content, name, type){
  const blob = new Blob([content], {type});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// --- Optional: small mini-charts (random sample until backend forecasts available) ---
Plotly.newPlot("miniGold", [{y:[3500,3600,3550,3620], mode:'lines'}], {margin:{t:0,b:0,l:0,r:0}});
Plotly.newPlot("miniProperty", [{y:[10,12,11,13], mode:'lines'}], {margin:{t:0,b:0,l:0,r:0}});

// initial call to fetch a trivial forecast if server has a default endpoint (optional)
async function fetchInitialMetrics(){
  // fetch no-arg plan for preview? skip if not present
}
fetchInitialMetrics();

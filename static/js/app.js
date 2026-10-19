import { renderWaveform } from "./ecg-chart.js";
import { initHeroCanvas } from "./hero-canvas.js";
import { initResultCanvas } from "./result-canvas.js";

const $ = id => document.getElementById(id);
const input = $("file-input"), choose = $("choose-btn"), drop = $("drop-zone");
const analyze = $("analyze-btn"), fileRow = $("file-row"), validation = $("validation");
let selectedFile = null, samples = null;

function setValidation(ok, text, count) {
  validation.classList.toggle("valid", ok);
  validation.classList.toggle("invalid", ok === false);
  $("validation-text").textContent = text;
  $("sample-counter").textContent = `${count} / 360`;
  analyze.disabled = !ok;
}

function showError(msg) { $("error-box").textContent = msg; $("error-box").hidden = false; }
function clearError() { $("error-box").hidden = true; $("error-box").textContent = ""; }

function parseLocalCsv(text) {
  const values = [];
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  for (let i=0;i<lines.length;i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (values.length === 0 && ["ecg","sample","value","signal"].includes(line.toLowerCase())) continue;
    const parts = line.split(",").map(x=>x.trim());
    if (parts.length !== 1) throw new Error(`Row ${i+1} contains more than one column.`);
    const n = Number(parts[0]);
    if (!Number.isFinite(n)) throw new Error(`Row ${i+1} contains a non-numeric value.`);
    values.push(n);
  }
  if (values.length !== 360) throw new Error(`Expected exactly 360 numeric ECG samples; received ${values.length}.`);
  return values;
}

async function handleFile(file) {
  clearError(); selectedFile = null; samples = null; fileRow.hidden = true;
  if (!file) return;
  if (!file.name.toLowerCase().endsWith(".csv")) { setValidation(false,"Only .csv files are accepted.",0); showError("Please select a CSV file."); return; }
  try {
    const text = await file.text();
    const vals = parseLocalCsv(text);
    samples = vals; selectedFile = file;
    $("filename").textContent = file.name; $("file-state").textContent = "Validated · numeric · 360 samples";
    fileRow.hidden = false; setValidation(true,"Valid ECG input",vals.length); renderWaveform(vals);
    $("wave-empty").hidden = true;
  } catch (e) {
    setValidation(false,e.message,0); showError(e.message);
    $("wave-empty").hidden = false;
  }
}

choose.addEventListener("click",()=>input.click());
drop.addEventListener("click",e=>{if(e.target!==choose) input.click()});
drop.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();input.click()}});
input.addEventListener("change",()=>handleFile(input.files[0]));
["dragenter","dragover"].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add("dragover")}));
["dragleave","drop"].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove("dragover")}));
drop.addEventListener("drop",e=>handleFile(e.dataTransfer.files[0]));
$("clear-btn").addEventListener("click",()=>{input.value="";selectedFile=null;samples=null;fileRow.hidden=true;setValidation(false,"Awaiting ECG input",0);$("wave-empty").hidden=false;clearError()});

function pct(x){return `${(Number(x)*100).toFixed(2)}%`}

function renderResult(data) {
  const decision = String(data.final_decision || "").toUpperCase();
  const card = $("decision-card");
  card.classList.remove("status-usable","status-degraded","status-reacquire");
  card.classList.add(`status-${decision.toLowerCase()}`);
  $("decision-word").textContent=decision;
  $("decision-glyph").textContent=decision==="USABLE"?"✓":decision==="DEGRADED"?"!":"×";
  $("decision-explanation").textContent=data.explanation || "";
  $("confidence").textContent=pct(data.confidence);
  const p=data.probabilities||{};
  ["usable","degraded","reacquire"].forEach(k=>{
    const v=Number(p[k.toUpperCase()]);
    $( `prob-${k}` ).textContent=pct(v);
    const bar=$(`bar-${k}`); bar.style.width="0%";
    requestAnimationFrame(()=>requestAnimationFrame(()=>bar.style.width=`${Math.max(0,Math.min(100,v*100))}%`));
  });
  $("trace-prediction").textContent=data.model_prediction||"—";
  $("trace-threshold").textContent=pct(data.usable_threshold);
  $("trace-gate").textContent=data.safety_gate_applied?"APPLIED":"NOT APPLIED";
  $("trace-samples").textContent=data.input_length ?? "—";
  $("safety-warning").hidden=!data.safety_gate_applied;
  $("safety-reason").textContent=data.safety_gate_applied ? data.explanation : "";
  $("result-section").hidden=false;
  initResultCanvas(decision);
  setTimeout(()=>$("result-section").scrollIntoView({behavior:"smooth",block:"start"}),100);
}

async function runPrediction(file) {
  clearError(); analyze.disabled=true; $("loading-line").hidden=false;
  try {
    const form=new FormData(); form.append("file",file,file.name);
    const res=await fetch("/predict",{method:"POST",body:form});
    const data=await res.json().catch(()=>({error:"The server returned an invalid response."}));
    if(!res.ok) throw new Error(data.error||"ECG analysis failed.");
    renderResult(data);
  } catch(e) { showError(e.message); analyze.disabled=false; }
  finally { $("loading-line").hidden=true; if(samples) analyze.disabled=false; }
}
analyze.addEventListener("click",()=>{if(selectedFile)runPrediction(selectedFile)});

document.querySelectorAll(".demo-card").forEach(btn=>btn.addEventListener("click",async()=>{
  const filename=btn.dataset.demo; clearError();
  try{
    const res=await fetch(`/demo/${encodeURIComponent(filename)}`);
    if(!res.ok) throw new Error(`Demo file "${filename}" is not available in demo_data/.`);
    const blob=await res.blob(); const file=new File([blob],filename,{type:"text/csv"});
    await handleFile(file);
    if(selectedFile) await runPrediction(selectedFile);
  }catch(e){showError(e.message)}
}));

const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add("visible");observer.unobserve(e.target)}}),{threshold:.12});
document.querySelectorAll(".reveal").forEach(el=>observer.observe(el));
initHeroCanvas();

async function checkModelStatus() {
  const statusEl = document.querySelector(".model-status");
  if (!statusEl) return;
  try {
    const res = await fetch("/health");
    if (res.ok) {
      const data = await res.json();
      if (data.model_ready) {
        statusEl.querySelector("span").textContent = "MODEL READY";
        statusEl.classList.remove("warming");
      } else {
        statusEl.querySelector("span").textContent = "WARMING MODEL...";
        statusEl.classList.add("warming");
        setTimeout(checkModelStatus, 800);
      }
    }
  } catch (_) {}
}
checkModelStatus();

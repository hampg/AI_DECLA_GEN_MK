const state = {
  tab: "query",
  selectedUses: { writing:false, content:false, code:false, lit:false, images:false, peer:false, research:false },
  selectedCols: ["ai_writing_assist","ai_code_generation","ai_literature_search"],
  search: "",
  page: 1,
  pageSize: 8,
  data: []
};

const ASPECTS = [
  { key:"ai_writing_assist", label:"Szöveg (assistive)", short:"Writing" },
  { key:"ai_content_generation", label:"Tartalomgenerálás", short:"Gen content" },
  { key:"ai_code_generation", label:"Kódgenerálás", short:"Code" },
  { key:"ai_literature_search", label:"Irodalomkutatás", short:"Literature" },
  { key:"ai_images", label:"AI-képek/ábrák", short:"AI images" },
  { key:"peer_review_ai", label:"Peer review AI", short:"Peer review" },
  { key:"disclosure_where", label:"Disclosure helye", short:"Disclosure" },
];

function statusPill(status){
  const s = (status || "").toLowerCase();
  if(s === "allowed") return `<span class="pill ok">engedett</span>`;
  if(s === "conditional") return `<span class="pill warn">feltételes</span>`;
  if(s === "restricted") return `<span class="pill warn">korlátozott</span>`;
  if(s === "prohibited") return `<span class="pill no">tiltott</span>`;
  return `<span class="pill warn">ellenőrizd</span>`;
}

function escapeHtml(s){
  return String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));
}

function renderTabs(){
  const tabs = document.getElementById("tabs");
  tabs.innerHTML = `
    <div class="tabs">
      <button class="tab ${state.tab==="query"?"active":""}" data-tab="query">Lekérdezés</button>
      <button class="tab ${state.tab==="table"?"active":""}" data-tab="table">Táblázat</button>
      <button class="tab ${state.tab==="data"?"active":""}" data-tab="data">Adatok</button>
    </div>
  `;
  tabs.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      state.tab = btn.dataset.tab;
      render();
    });
  });
}

function summarizeSelectedUses(){
  const chosen = Object.entries(state.selectedUses).filter(([k,v])=>v).map(([k])=>k);
  const labelMap = {
    writing:"assistive írás", content:"tartalomgenerálás", code:"kód", lit:"irodalomkutatás",
    images:"AI-képek", peer:"peer review AI", research:"kutatási módszertan (AI a módszerben)"
  };
  return chosen.length ? chosen.map(k=>labelMap[k]).join(", ") : "nincs";
}

function buildReasons(lang, inputs){
  // inputs: {writingTool, writingPurpose, contentTool, contentPurpose, ...}
  const parts = [];
  const add = (useKey, labelHu, labelEn) => {
    const tool = (inputs[useKey+"Tool"] || "").trim();
    const purpose = (inputs[useKey+"Purpose"] || "").trim();
    if(!tool && !purpose) return;
    if(lang === "hu"){
      parts.push(`${tool ? tool : "[MI ESZKÖZ/SZOLGÁLTATÁS]"} – ${purpose ? purpose : "[CÉL]"}`);
    } else {
      parts.push(`${tool ? tool : "[NAME TOOL / SERVICE]"} – ${purpose ? purpose : "[REASON]"}`);
    }
  };
  add("writing", "Szöveg", "Writing");
  add("content", "Tartalomgenerálás", "Content generation");
  add("code", "Kód", "Code");
  add("lit", "Irodalomkutatás", "Literature search");
  add("images", "Képek/ábrák", "Images/graphics");
  add("research", "Módszertan", "Methods");
  return parts;
}

function generateStatement(lang, inputs){
  // Médiakutató vázlat = Elsevier-szerű template + felelősség; ezért a core mondatot ehhez igazítjuk.
  const uses = summarizeSelectedUses();
  const reasons = buildReasons(lang, inputs);

  const hasAny = Object.values(state.selectedUses).some(Boolean);
  if(!hasAny){
    return lang === "hu"
      ? "Nem jelöltél be AI-használatot. Ha csak helyesírás/nyelvtan javító eszközöket használtál, a vázlat szerint nem szükséges nyilatkozat."
      : "No AI use selected. If you only used basic spelling/grammar tools, a statement is typically not required.";
  }

  const modelList = reasons.length
    ? (lang==="hu"
        ? reasons.map(r=>`- ${r}`).join("\n")
        : reasons.map(r=>`- ${r}`).join("\n"))
    : (lang==="hu" ? "- [MI ESZKÖZ/SZOLGÁLTATÁS] – [CÉL]" : "- [NAME TOOL / SERVICE] – [REASON]");

  if(lang === "hu"){
    return [
      "AI-NYILATKOZAT (a hivatkozások előtt közvetlenül)",
      "",
      "A munka elkészítése során a szerző(k) az alábbi MI eszköz(öke)t/szolgáltatás(oka)t használt(ák):",
      modelList,
      "",
      "Az eszköz(ök)/szolgáltatás(ok) használata után a szerző(k) szükség szerint áttekintette(k), ellenőrizte(k) és szerkesztette(k) a tartalmat, és teljes felelősséget vállal(nak) a publikáció tartalmáért.",
      "",
      "Megjegyzés: A helyesírási és nyelvtani hibákat javító technológiákról nem szükséges beszámolni."
    ].join("\n");
  } else {
    return [
      "AI DISCLOSURE STATEMENT (insert directly before the references)",
      "",
      "During the preparation of this work the author(s) used the following AI tool(s)/service(s):",
      modelList,
      "",
      "After using these tool(s)/service(s), the author(s) reviewed, verified, and edited the content as needed and take(s) full responsibility for the content of the publication.",
      "",
      "Note: Technologies that improve spelling and grammar do not need to be reported."
    ].join("\n");
  }
}

function renderQuery(){
  const root = document.getElementById("view");
  root.innerHTML = `
    <div class="row">
      <button id="openDialogBtn">AI-használat kiválasztása</button>
      <span class="muted">Kiválasztva: <strong>${escapeHtml(summarizeSelectedUses())}</strong></span>
    </div>

    <dialog id="aiDialog" class="dialog">
      <h2>AI-segítség kiválasztása</h2>
      <div class="grid">
        <label><input type="checkbox" id="cbWriting"> Szöveg struktúrázása / szerkesztés</label>
        <label><input type="checkbox" id="cbContent"> Tartalomgenerálás</label>
        <label><input type="checkbox" id="cbCode"> Kód generálása</label>
        <label><input type="checkbox" id="cbLit"> Szakirodalomkutatás AI-val</label>
        <label><input type="checkbox" id="cbImages"> AI-képek/ábrák</label>
        <label><input type="checkbox" id="cbResearch"> AI-eszköz a módszertan részeként (explicit módszer)</label>
        <label><input type="checkbox" id="cbPeer"> Peer review során AI használata</label>
      </div>
      <div class="row" style="justify-content:flex-end;margin-top:12px">
        <button id="closeDialogBtn">Bezár</button>
        <button id="applyBtn">Kiértékelés</button>
      </div>
    </dialog>

    <div class="card" id="querySummary"></div>
    <div id="queryResults"></div>

    <div class="card" id="generatorCard">
      <div class="row" style="justify-content:space-between;align-items:flex-start">
        <div>
          <strong>AI-nyilatkozat generátor (Médiakutató / Elsevier-szerű)</strong>
          <div class="muted small">A checkboxok alapján kitölthető, HU/EN verzióval. A végén a hivatkozások elé illeszd.</div>
        </div>
        <div class="row">
          <label class="small">Nyelv:
            <select id="langSel">
              <option value="hu">HU</option>
              <option value="en">EN</option>
            </select>
          </label>
          <button id="genBtn">Generálás</button>
          <button id="copyBtn">Másolás</button>
        </div>
      </div>

      <div class="grid" style="margin-top:10px">
        <div>
          <div class="small muted"><strong>Szöveg (assistive)</strong></div>
          <input id="writingTool" placeholder="Eszköz (pl. ChatGPT-4o, Gemini)"/>
          <input id="writingPurpose" placeholder="Cél (pl. szerkezet, nyelvi szerkesztés, tömörítés)"/>
        </div>
        <div>
          <div class="small muted"><strong>Tartalomgenerálás</strong></div>
          <input id="contentTool" placeholder="Eszköz"/>
          <input id="contentPurpose" placeholder="Cél (pl. vázlat, példák, alternatív megfogalmazások)"/>
        </div>
        <div>
          <div class="small muted"><strong>Kódgenerálás</strong></div>
          <input id="codeTool" placeholder="Eszköz"/>
          <input id="codePurpose" placeholder="Cél (pl. regex, Python függvények, adatfeldolgozás)"/>
        </div>
        <div>
          <div class="small muted"><strong>Irodalomkutatás</strong></div>
          <input id="litTool" placeholder="Eszköz"/>
          <input id="litPurpose" placeholder="Cél (pl. kulcsszavak, forrás-keresési ötletek; minden hivatkozás ellenőrizve)"/>
        </div>
        <div>
          <div class="small muted"><strong>AI-képek/ábrák</strong></div>
          <input id="imagesTool" placeholder="Eszköz"/>
          <input id="imagesPurpose" placeholder="Cél (pl. illusztráció; jog/források kezelve)"/>
        </div>
        <div>
          <div class="small muted"><strong>Módszertan (AI a módszerben)</strong></div>
          <input id="researchTool" placeholder="Eszköz"/>
          <input id="researchPurpose" placeholder="Cél (pl. osztályozás/annotáció/elemzés; módszertan részletezve a Methods-ben)"/>
        </div>
      </div>

      <textarea id="outBox" style="width:100%;height:220px;margin-top:10px;border:1px solid var(--border);border-radius:12px;padding:10px;"></textarea>
      <div class="muted small" style="margin-top:8px;">
        Tipp: ha <strong>AI a módszertan része</strong>, írd le részletesen a Methods-ben is (adat, paraméterek, validáció, emberi ellenőrzés).
      </div>
    </div>
  `;

  const dialog = root.querySelector("#aiDialog");
  const cbs = {
    writing: root.querySelector("#cbWriting"),
    content: root.querySelector("#cbContent"),
    code: root.querySelector("#cbCode"),
    lit: root.querySelector("#cbLit"),
    images: root.querySelector("#cbImages"),
    peer: root.querySelector("#cbPeer"),
    research: root.querySelector("#cbResearch")
  };
  Object.keys(cbs).forEach(k => cbs[k].checked = !!state.selectedUses[k]);

  root.querySelector("#openDialogBtn").addEventListener("click", ()=> dialog.showModal());
  root.querySelector("#closeDialogBtn").addEventListener("click", ()=> dialog.close());
  root.querySelector("#applyBtn").addEventListener("click", ()=>{
    Object.keys(cbs).forEach(k => state.selectedUses[k] = cbs[k].checked);
    dialog.close();
    render(); // rerender for summary + generator suggestions
  });

  // Generator wiring
  const outBox = root.querySelector("#outBox");
  const langSel = root.querySelector("#langSel");
  const inputIds = ["writingTool","writingPurpose","contentTool","contentPurpose","codeTool","codePurpose","litTool","litPurpose","imagesTool","imagesPurpose","researchTool","researchPurpose"];
  const inputs = {};
  inputIds.forEach(id => inputs[id] = root.querySelector("#"+id));

  function collectInputs(){
    return {
      writingTool: inputs.writingTool.value, writingPurpose: inputs.writingPurpose.value,
      contentTool: inputs.contentTool.value, contentPurpose: inputs.contentPurpose.value,
      codeTool: inputs.codeTool.value, codePurpose: inputs.codePurpose.value,
      litTool: inputs.litTool.value, litPurpose: inputs.litPurpose.value,
      imagesTool: inputs.imagesTool.value, imagesPurpose: inputs.imagesPurpose.value,
      researchTool: inputs.researchTool.value, researchPurpose: inputs.researchPurpose.value,
    };
  }

  function doGenerate(){
    const lang = langSel.value;
    outBox.value = generateStatement(lang, collectInputs());
  }

  root.querySelector("#genBtn").addEventListener("click", doGenerate);
  root.querySelector("#copyBtn").addEventListener("click", async ()=>{
    try{
      await navigator.clipboard.writeText(outBox.value || "");
    }catch(e){
      // no-op
    }
  });
  doGenerate();

  // Query results
  const chosen = Object.entries(state.selectedUses).filter(([k,v])=>v).map(([k])=>k);
  root.querySelector("#querySummary").innerHTML = `
    <strong>Kiválasztott AI-használat:</strong>
    <span class="muted">${escapeHtml(chosen.length ? summarizeSelectedUses() : "nincs (nyisd meg a párbeszédablakot és jelölj be opciókat)")}</span>
  `;

  const results = root.querySelector("#queryResults");
  results.innerHTML = "";

  function pickItems(j){
    const items = [];
    if(state.selectedUses.writing) items.push(["Szöveg (assistive)", j.ai_writing_assist]);
    if(state.selectedUses.content) items.push(["Tartalomgenerálás", j.ai_content_generation]);
    if(state.selectedUses.code) items.push(["Kódgenerálás", j.ai_code_generation]);
    if(state.selectedUses.lit) items.push(["Irodalomkutatás", j.ai_literature_search]);
    if(state.selectedUses.images) items.push(["AI-képek", j.ai_images]);
    if(state.selectedUses.peer) items.push(["Peer review AI", j.peer_review_ai]);
    if(state.selectedUses.research) items.push(["Módszertan (AI a módszerben)", j.ai_code_generation]); // closest proxy in dataset
    return items;
  }

  state.data.forEach(j => {
    const items = pickItems(j);
    const policyLink = `<a href="${escapeHtml(j.policy_url)}" target="_blank" rel="noopener">Policy</a>`;
    const rows = items.map(([k,val])=>{
      if(val && typeof val === "object"){
        return `<tr><td>${escapeHtml(k)} ${statusPill(val.status)}</td><td>${escapeHtml(val.text)}</td></tr>`;
      }
      return `<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(val)}</td></tr>`;
    }).join("");

    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="row" style="justify-content:space-between;">
        <div>
          <strong>${escapeHtml(j.journal)}</strong>
          <span class="pill">${escapeHtml(j.field)}</span>
          <span class="pill">${escapeHtml(j.policy_level)}</span>
        </div>
        <div class="muted">${escapeHtml(j.publisher)} • ${policyLink}</div>
      </div>
      <div class="muted" style="margin-top:6px;">
        AI mint szerző: <strong>${escapeHtml(j.ai_author)}</strong> • Disclosure: <strong>${escapeHtml(j.disclosure_where)}</strong>
      </div>
      ${items.length ? `
        <table>
          <thead><tr><th>AI-használat</th><th>Policy-reakció</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`
      : `<p class="muted" style="margin-top:10px;">Jelölj be legalább egy AI-használati típust a kiértékeléshez.</p>`}
      <p class="muted" style="margin-top:10px;"><em>Megjegyzés:</em> ${escapeHtml(j.notes)}</p>
    `;
    results.appendChild(card);
  });
}

function renderTable(){
  const root = document.getElementById("view");

  const colOptions = ASPECTS.map(a => {
    const checked = state.selectedCols.includes(a.key) ? "checked" : "";
    return `<label class="small"><input type="checkbox" value="${a.key}" ${checked}> ${escapeHtml(a.label)}</label>`;
  }).join("");

  root.innerHTML = `
    <div class="row">
      <input type="search" id="searchBox" placeholder="Keresés (journal/publisher/field)..." value="${escapeHtml(state.search)}" />
      <span class="muted">Válassz ki <strong>max 3</strong> szempontot:</span>
    </div>
    <div class="card">
      <div class="grid" id="colPicker">${colOptions}</div>
      <p class="muted small" style="margin-top:8px;">Fix oszlopok: Journal • Field • Policy link. A választott szempontok ezek mellé jönnek.</p>
    </div>
    <div class="card" id="tableWrap"></div>
  `;

  const searchBox = root.querySelector("#searchBox");
  searchBox.addEventListener("input", () => {
    state.search = searchBox.value;
    state.page = 1;
    renderTableBody();
  });

  const picker = root.querySelector("#colPicker");
  picker.querySelectorAll("input[type=checkbox]").forEach(cb => {
    cb.addEventListener("change", () => {
      const checked = Array.from(picker.querySelectorAll("input[type=checkbox]:checked")).map(x=>x.value);
      if(checked.length > 3){
        cb.checked = false;
        return;
      }
      state.selectedCols = checked;
      renderTableBody();
    });
  });

  renderTableBody();

  function getFiltered(){
    const q = state.search.trim().toLowerCase();
    if(!q) return state.data;
    return state.data.filter(j => {
      const hay = `${j.journal} ${j.publisher} ${j.field} ${j.policy_level}`.toLowerCase();
      return hay.includes(q);
    });
  }

  function cellFor(j, key){
    if(key === "disclosure_where") return escapeHtml(j.disclosure_where || "");
    const v = j[key];
    if(v && typeof v === "object"){
      return `${statusPill(v.status)}<div class="small muted" style="margin-top:4px">${escapeHtml(v.text)}</div>`;
    }
    return escapeHtml(v ?? "");
  }

  function renderTableBody(){
    const dataFiltered = getFiltered();
    const totalPages = Math.max(1, Math.ceil(dataFiltered.length / state.pageSize));
    state.page = Math.min(state.page, totalPages);
    const start = (state.page - 1) * state.pageSize;
    const pageRows = dataFiltered.slice(start, start + state.pageSize);

    const ths = state.selectedCols.map(k => {
      const a = ASPECTS.find(x=>x.key===k);
      return `<th>${escapeHtml(a ? a.label : k)}</th>`;
    }).join("");

    const trs = pageRows.map(j => {
      const cells = state.selectedCols.map(k => `<td>${cellFor(j,k)}</td>`).join("");
      const policyLink = `<a href="${escapeHtml(j.policy_url)}" target="_blank" rel="noopener">Policy</a>`;
      return `
        <tr>
          <td><strong>${escapeHtml(j.journal)}</strong><div class="small muted">${escapeHtml(j.publisher)}</div></td>
          <td>${escapeHtml(j.field)}<div class="small muted">${escapeHtml(j.policy_level)}</div></td>
          <td>${policyLink}</td>
          ${cells}
        </tr>
      `;
    }).join("");

    const table = `
      <table>
        <thead><tr><th>Journal</th><th>Mező</th><th>Link</th>${ths}</tr></thead>
        <tbody>${trs}</tbody>
      </table>
      <div class="pagination">
        <span class="muted small">Találat: ${dataFiltered.length} • oldal ${state.page}/${totalPages}</span>
        <button id="prevBtn" ${state.page<=1?"disabled":""}>◀</button>
        <button id="nextBtn" ${state.page>=totalPages?"disabled":""}>▶</button>
      </div>
    `;

    root.querySelector("#tableWrap").innerHTML = table;
    root.querySelector("#prevBtn").addEventListener("click", ()=>{ state.page--; renderTableBody(); });
    root.querySelector("#nextBtn").addEventListener("click", ()=>{ state.page++; renderTableBody(); });
  }
}

function renderData(){
  const root = document.getElementById("view");
  root.innerHTML = `
    <div class="card">
      <div class="row" style="justify-content:space-between">
        <div>
          <strong>Adatfájlok</strong>
          <div class="muted small">A UI a <span class="kbd">data.json</span>-t tölti be. Minden rekordban van <span class="kbd">policy_url</span>.</div>
        </div>
        <div class="row">
          <a href="./data.json" target="_blank" rel="noopener">data.json</a>
          <span class="muted">•</span>
          <a href="./data.csv" target="_blank" rel="noopener">data.csv</a>
        </div>
      </div>
    </div>
    <div class="card">
      <strong>data.json (részlet)</strong>
      <pre class="small" style="white-space:pre-wrap;word-break:break-word;margin-top:8px" id="jsonPreview"></pre>
    </div>
  `;
  const preview = root.querySelector("#jsonPreview");
  preview.textContent = JSON.stringify(state.data.slice(0,2), null, 2) + "\n…";
}

function render(){
  renderTabs();
  if(state.tab === "query") renderQuery();
  else if(state.tab === "table") renderTable();
  else renderData();
}

async function init(){
  const res = await fetch("./data.json", {cache:"no-store"});
  state.data = await res.json();
  render();
}
init();

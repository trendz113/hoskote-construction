// Tools page script: quantity calculator, loan calculator, agreement and loan-estimate generators.
function calcQty() {
  const sqft = parseFloat(document.getElementById('q-sqft').value) || 1000;
  const type = document.getElementById('q-type').value;
  const factor = type === 'load' ? 0.85 : 1;

  document.getElementById('q-cement').textContent = Math.round(sqft * 0.52 * factor);
  document.getElementById('q-steel').textContent = (sqft * 0.0065 * factor).toFixed(1);
  document.getElementById('q-bricks').textContent = (sqft * 18 * factor).toLocaleString('en-IN');
  document.getElementById('q-sand').textContent = Math.round(sqft * 0.31 * factor);
  document.getElementById('q-aggregate').textContent = Math.round(sqft * 0.42 * factor);
  document.getElementById('q-water').textContent = (sqft * 12 * factor).toLocaleString('en-IN');
}

// EMI Calculator
function calcLoan() {
  const amtEl = document.getElementById('loan-amt');
  const rateEl = document.getElementById('loan-rate');
  const amtWarning = document.getElementById('loan-amt-warning');
  const rateWarning = document.getElementById('loan-rate-warning');
  const amtReadout = document.getElementById('loan-amt-readout');

  const MIN_AMT = 500000;    // ₹5,00,000
  const MAX_AMT = 20000000;  // ₹2,00,00,000

  const rawAmt = parseFloat(amtEl.value);
  const rawRate = parseFloat(rateEl.value);

  const amtOutOfRange = isNaN(rawAmt) || rawAmt < MIN_AMT || rawAmt > MAX_AMT;
  const rateOutOfRange = isNaN(rawRate) || rawRate < 6 || rawRate > 15;
  amtWarning.style.display = amtOutOfRange && amtEl.value !== '' ? 'block' : 'none';
  rateWarning.style.display = rateOutOfRange && rateEl.value !== '' ? 'block' : 'none';

  // Always calculate with clamped values so the result is never nonsensical, even before blur corrects the field
  const P = isNaN(rawAmt) ? 3000000 : Math.min(Math.max(rawAmt, MIN_AMT), MAX_AMT);
  const rate = isNaN(rawRate) ? 8.75 : Math.min(Math.max(rawRate, 6), 15);

  amtReadout.textContent = `= ₹${(P/100000).toFixed(1)} Lakhs`;

  const r = rate / 1200;
  const n = (parseInt(document.getElementById('loan-term').value) || 20) * 12;
  const emi = P * r * Math.pow(1+r,n) / (Math.pow(1+r,n)-1);
  const total = emi * n;
  const interest = total - P;
  document.getElementById('emi-result').textContent = `₹${Math.round(emi).toLocaleString('en-IN')}`;
  document.getElementById('emi-total').textContent = `Total Payable: ₹${(total/100000).toFixed(1)}L · Interest: ₹${(interest/100000).toFixed(1)}L`;
}

function clampLoanInputs() {
  const amtEl = document.getElementById('loan-amt');
  const rateEl = document.getElementById('loan-rate');
  const rawAmt = parseFloat(amtEl.value);
  const rawRate = parseFloat(rateEl.value);
  if (!isNaN(rawAmt)) amtEl.value = Math.min(Math.max(rawAmt, 500000), 20000000);
  if (!isNaN(rawRate)) rateEl.value = Math.min(Math.max(rawRate, 6), 15);
  calcLoan();
}
if (document.getElementById('loan-amt')) calcLoan();

// Timeline visualizer
// ============================================================ DOCUMENT HELPERS (shared by the agreement / estimate tools)
// Print one document: copy it into a temporary holder and hide everything else while printing
function printDocById(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const old = document.getElementById('print-holder');
  if (old) old.remove();
  const holder = document.createElement('div');
  holder.id = 'print-holder';
  const clone = el.cloneNode(true);
  clone.removeAttribute('id');
  holder.appendChild(clone);
  document.body.appendChild(holder);
  document.body.classList.add('printing-doc');
  window.addEventListener('afterprint', function cleanup() {
    document.body.classList.remove('printing-doc');
    holder.remove();
    window.removeEventListener('afterprint', cleanup);
  });
  window.print();
}

function fmtDate(d) {
  if (!d) return '[Start Date]';
  const dt = new Date(d + 'T00:00:00');
  if (isNaN(dt)) return '[Start Date]';
  return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}
function addMonths(d, months) {
  if (!d) return '[End Date]';
  const dt = new Date(d + 'T00:00:00');
  if (isNaN(dt)) return '[End Date]';
  dt.setMonth(dt.getMonth() + months);
  return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}
function money(v) {
  const n = parseFloat(v);
  return n ? '₹' + n.toLocaleString('en-IN') : '[Amount]';
}
function inWords(v) {
  const n = parseFloat(v);
  return n ? `₹${n.toLocaleString('en-IN')}/-` : '[Amount]';
}
function generateConstructionAgreement() {
  const owner = document.getElementById('ca-owner').value.trim() || '[Owner / Client Name]';
  const builder = document.getElementById('ca-builder').value.trim() || '[Builder / Contractor Name]';
  const ownerAddr = document.getElementById('ca-owner-addr').value.trim() || "[Owner's Address]";
  const builderAddr = document.getElementById('ca-builder-addr').value.trim() || "[Builder's Registered/Office Address]";
  const site = document.getElementById('ca-site').value.trim() || '[Full Construction Site Address, Hoskote]';
  const area = document.getElementById('ca-area').value || '[Built-up Area]';
  const floors = document.getElementById('ca-floors').value.trim() || '[No. of Floors]';
  const costtype = document.getElementById('ca-costtype').value;
  const costRaw = document.getElementById('ca-cost').value;
  const advance = document.getElementById('ca-advance').value;
  const startdate = document.getElementById('ca-startdate').value;
  const duration = parseInt(document.getElementById('ca-duration').value);
  const delaypenalty = document.getElementById('ca-delaypenalty').value;
  const city = document.getElementById('ca-city').value.trim() || 'Hoskote, Bengaluru Rural, Karnataka';
  const startTxt = fmtDate(startdate);
  const endTxt = addMonths(startdate, duration);
  const costLine = costtype === 'persqft'
    ? `a rate of <strong>₹${costRaw || '[Rate]'} per sq. ft.</strong>, amounting to an estimated total of <strong>${inWords(costRaw && area ? costRaw * area : '')}</strong> for ${area} sq. ft. of built-up area (final amount to be settled on actual measured area)`
    : `a fixed total contract value of <strong>${inWords(costRaw)}</strong> for the complete construction described in Clause 1, payable strictly as per the milestone schedule below`;

  const html = `
    <h4>HOUSE CONSTRUCTION AGREEMENT</h4>
    <div class="doc-sub">${floors} · ${area} sq. ft. built-up area · ${costtype === 'persqft' ? 'Per Sq Ft Contract' : 'Fixed Cost (Turnkey) Contract'}</div>
    <p>This Construction Agreement is made and executed on <strong>${startTxt}</strong> at <strong>${city}</strong>, between:</p>
    <p><strong>${owner}</strong>, residing at ${ownerAddr}, hereinafter referred to as the <strong>"OWNER / CLIENT"</strong> (which expression shall, unless repugnant to the context, include their heirs, legal representatives, and assigns) of the ONE PART;</p>
    <p>AND</p>
    <p><strong>${builder}</strong>, having office/registered address at ${builderAddr}, hereinafter referred to as the <strong>"BUILDER / CONTRACTOR"</strong> (which expression shall, unless repugnant to the context, include its partners, representatives, and assigns) of the OTHER PART.</p>

    <div class="clause-title">1. Scope of Work</div>
    <p>The Builder agrees to construct a <strong>${floors}</strong> residential structure of approximately <strong>${area} sq. ft.</strong> built-up area at <strong>${site}</strong> ("the Site"), as per the plan approved by the local Panchayat/BMRDA authority and the specifications mutually agreed and annexed as Schedule A to this Agreement, using quality materials and workmanship consistent with standard construction practice.</p>

    <div class="clause-title">2. Contract Value &amp; Payment</div>
    <p>The Owner shall pay the Builder ${costLine}.</p>
    <p>An advance/booking amount of <strong>${inWords(advance)}</strong> has been paid by the Owner to the Builder on signing this Agreement, receipt of which is hereby acknowledged. The balance amount shall be paid strictly in stage-wise milestones (foundation, plinth, each floor's slab, brickwork, plastering, flooring, finishing, and handover) as detailed in Schedule B, released only on satisfactory completion and joint inspection of each stage — not in advance of work done.</p>

    <div class="clause-title warn">3. Material Price Protection (No Mid-Project Cost Increase)</div>
    <p>${costtype === 'persqft'
      ? 'The per sq. ft. rate agreed in Clause 2 is fixed for the duration of this Agreement. The Builder shall not demand any additional amount from the Owner on account of an increase in the price of cement, steel, sand, or any other construction material during the currency of this Agreement, except for any change requested in writing by the Owner that alters the approved scope or specification.'
      : 'The fixed total contract value agreed in Clause 2 shall remain unchanged for the full duration of this Agreement, regardless of any increase in the market price of cement, steel, sand, or any other construction material during construction. The Builder bears this price risk and shall not raise any additional demand on this account. The only exception is a change of scope, design, or specification requested in writing by the Owner, which shall be costed and agreed separately before being carried out.'}</p>

    <div class="clause-title">4. Timeline &amp; Completion</div>
    <p>Construction shall commence on <strong>${startTxt}</strong> and shall be completed within <strong>${duration} months</strong>, i.e. on or before <strong>${endTxt}</strong>, subject to reasonable extension for delays directly caused by the Owner, force majeure events, or authority-mandated stoppages, which shall be recorded in writing by mutual consent.</p>

    <div class="clause-title warn">5. Consequence of Delay by Builder</div>
    <p>If the Builder fails to complete construction by the date in Clause 4 for reasons within the Builder's control, the Builder shall be liable to pay the Owner compensation at <strong>${delaypenalty}</strong>, without prejudice to the Owner's right to terminate this Agreement and engage another contractor to complete the remaining work at the Builder's cost, if the delay is unreasonable or the Builder abandons the Site.</p>

    <div class="clause-title">6. Documents &amp; Disclosures Provided Upfront (Schedule A)</div>
    <p>The Builder shall provide the Owner, before commencement of work and as a condition of this Agreement, all of the following in writing:</p>
    <p>(a) the approved building plan and a copy of the Panchayat/BMRDA plan sanction;</p>
    <p>(b) a detailed cost break-up / Bill of Quantities for the contract value in Clause 2;</p>
    <p>(c) the stage-wise payment milestone schedule (Schedule B);</p>
    <p>(d) the brand and quality specification for cement, steel (TMT bars with grade), sand, bricks/blocks, plumbing, electrical, and finishing materials to be used;</p>
    <p>(e) copies of any relevant licenses, UDYAM/GST registration, or engineer/architect credentials of the Builder's team.</p>
    <p>No verbal commitment shall override what is recorded in this Agreement and its Schedules.</p>

    <div class="clause-title">7. Quality, Inspection &amp; Rectification</div>
    <p>The Owner or their appointed engineer may inspect work at each milestone before releasing payment. Any work found not conforming to the agreed specification shall be rectified by the Builder at no additional cost to the Owner before the next stage begins.</p>

    <div class="clause-title">8. Statutory Compliance</div>
    <p>The Builder shall ensure construction complies with the sanctioned plan, local building bye-laws, and applicable safety norms, and shall be responsible for the safety and statutory compliance (labour, safety equipment) of workers engaged at the Site.</p>

    <div class="clause-title">9. Termination</div>
    <p>Either party may terminate this Agreement for material breach by the other, after giving 15 days' written notice to cure the breach. On termination, the Owner shall pay only for work actually completed and verified as per Schedule B, and any amount paid in excess of completed work shall be refunded by the Builder within 15 days.</p>

    <div class="clause-title">10. Governing Law &amp; Jurisdiction</div>
    <p>This Agreement shall be governed by the laws of India, and courts/authorities in <strong>${city}</strong> shall have exclusive jurisdiction over any dispute arising from this Agreement.</p>

    <p style="margin-top:1.5rem;">IN WITNESS WHEREOF, the parties have set their hands on the day, month, and year first above written.</p>

    <div class="sig-row">
      <div class="sig-box">OWNER / CLIENT<br>${owner}</div>
      <div class="sig-box">BUILDER / CONTRACTOR<br>${builder}</div>
    </div>
    <div class="sig-row">
      <div class="sig-box">WITNESS 1<br>Name &amp; Signature</div>
      <div class="sig-box">WITNESS 2<br>Name &amp; Signature</div>
    </div>
  `;
  document.getElementById('printable-construction-agreement').innerHTML = html;
}

function printConstructionAgreement() {
  generateConstructionAgreement();
  printDocById('printable-construction-agreement');
}

function copyConstructionAgreementText() {
  generateConstructionAgreement();
  const text = document.getElementById('printable-construction-agreement').innerText;
  navigator.clipboard.writeText(text).then(() => {
    alert('Agreement text copied! Paste it into WhatsApp, Word, or an email.');
  }).catch(() => {
    alert('Could not copy automatically — please select and copy the text manually.');
  });
}
if (document.getElementById('construction-agreement')) generateConstructionAgreement();

function generateLoanEstimate() {
  const applicant = document.getElementById('le-applicant').value.trim() || '[Applicant Name]';
  const bank = document.getElementById('le-bank').value.trim();
  const site = document.getElementById('le-site').value.trim() || '[Construction Site Address, Hoskote]';
  const plotarea = document.getElementById('le-plotarea').value || '[Plot Area]';
  const floors = document.getElementById('le-floors').value.trim() || '[No. of Floors]';
  const area = parseFloat(document.getElementById('le-area').value) || 0;
  const rate = parseFloat(document.getElementById('le-rate').value) || 1800;
  const approvalno = document.getElementById('le-approvalno').value.trim();
  const desiredLoanEl = document.getElementById('le-desired-loan');
  const desiredLoan = desiredLoanEl ? parseFloat(desiredLoanEl.value) || 0 : 0;
  const ltvEl = document.getElementById('le-ltv');
  const ltv = ltvEl ? parseFloat(ltvEl.value) || 70 : 70;
  const dateTxt = fmtDate(document.getElementById('le-date').value) || fmtDate(new Date().toISOString().slice(0,10));
  const total = area * rate;

  // BOQ-style trade-category break-up, based on typical proportions for a G+1 residential build in Bengaluru Rural
  const categories = [
    { name: 'Earthwork (Excavation)', pct: 2 },
    { name: 'Concrete (RCC — columns, slabs, beams, footing)', pct: 12 },
    { name: 'Form Work (Shuttering)', pct: 14 },
    { name: 'Steel (Fe500/Fe500D reinforcement)', pct: 9 },
    { name: 'Masonry (Foundation stone + brick/block work)', pct: 12 },
    { name: 'Plastering', pct: 15 },
    { name: 'Painting', pct: 10 },
    { name: 'Doors & Windows', pct: 1 },
    { name: 'Flooring & Dadoing', pct: 5 },
    { name: 'Miscellaneous (waterproofing, sump, compound wall, etc.)', pct: 8 },
    { name: 'Electrification', pct: 6 },
    { name: 'Plumbing', pct: 6 },
  ];
  const boqRows = categories.map(c => {
    const amt = Math.round(total * c.pct / 100);
    return `<tr><td>${c.name}</td><td class="num">${c.pct}%</td><td class="num">₹${amt.toLocaleString('en-IN')}</td></tr>`;
  }).join('');

  // Loan sizing guidance: banks typically fund a percentage (LTV) of the DECLARED total project cost, not the amount requested
  let loanGuidance = '';
  if (desiredLoan > 0) {
    const requiredEstimate = Math.round(desiredLoan * 100 / ltv);
    const shortfall = requiredEstimate > total ? requiredEstimate - total : 0;
    loanGuidance = `
    <div class="clause-title">4. Loan Sizing Check</div>
    <p>You've indicated a target loan amount of <strong>₹${desiredLoan.toLocaleString('en-IN')}</strong>. Most banks fund around <strong>${ltv}%</strong> of your total declared project cost (Loan-to-Value), not the amount you apply for. Working backwards, your submitted estimate needs to reflect a genuine total project cost of at least <strong>₹${requiredEstimate.toLocaleString('en-IN')}</strong> for the bank's ${ltv}% funding to reach your target.</p>
    ${shortfall > 0
      ? `<p style="color:#B91C1C;"><strong>Your current estimate (₹${total.toLocaleString('en-IN')}) is short by about ₹${shortfall.toLocaleString('en-IN')}.</strong> This should almost always be closed by including every <em>genuine</em> cost head you're actually incurring — interiors, compound wall, sump, landscaping, elevation design — not by inflating rates or quantities beyond real cost. Under-declaring scope is the single biggest reason people get less loan than they actually need; over-declaring beyond real cost is loan misrepresentation and should never be done. Use the Part B (Interiors) section of our full BOQ estimate template to capture the genuine additional scope.</p>`
      : `<p style="color:var(--green-600,#16A34A);"><strong>Your current estimate already supports this loan target.</strong> Make sure every cost head in it reflects work you're genuinely planning to carry out — banks and their valuers do verify declared scope against the site.</p>`}
    `;
  }

  const html = `
    <h4>ESTIMATE OF COST OF CONSTRUCTION</h4>
    <div class="doc-sub">${bank ? `Prepared for submission to ${bank} · ` : ''}${floors} · ${area || '[Area]'} sq. ft. built-up area</div>
    <p>Date: <strong>${dateTxt}</strong></p>
    <p><strong>Applicant / Borrower:</strong> ${applicant}</p>
    <p><strong>Construction Site:</strong> ${site}</p>
    <p><strong>Plot / Site Area:</strong> ${plotarea} sq. ft. &nbsp;|&nbsp; <strong>Proposed Structure:</strong> ${floors}, ${area || '[Area]'} sq. ft. total built-up area</p>
    ${approvalno ? `<p><strong>Plan Approval Reference:</strong> ${approvalno}</p>` : ''}

    <div class="clause-title">1. Basis of Estimate</div>
    <p>This estimate is prepared at a rate of <strong>₹${rate.toLocaleString('en-IN')} per sq. ft.</strong>, inclusive of structure (RCC, brickwork), plumbing, electrical, flooring, and standard finishing, for a total built-up area of <strong>${area || '[Area]'} sq. ft.</strong>, arriving at an estimated total construction cost of <strong>${inWords(total)}</strong>.</p>

    <div class="clause-title">2. Trade-wise Cost Break-up (Bill of Quantities basis)</div>
    <div class="tbl-wrap" style="margin:1rem 0;">
      <table>
        <thead><tr><th>Work Category</th><th class="num">% of Total</th><th class="num">Amount</th></tr></thead>
        <tbody>${boqRows}</tbody>
        <tfoot><tr><td><strong>Total Estimated Cost</strong></td><td></td><td class="num"><strong>₹${total.toLocaleString('en-IN')}</strong></td></tr></tfoot>
      </table>
    </div>
    <p style="font-size:.88rem;color:var(--stone-500,#8C857A);">This category structure mirrors a standard civil BOQ (earthwork, concrete, steel, masonry, plastering, painting, etc.) — the format banks and their technical valuers are most familiar with, rather than a simple payment-stage split.</p>
    ${loanGuidance}
    <div class="clause-title">${desiredLoan > 0 ? '5' : '3'}. Materials & Specification Basis</div>
    <p>This estimate assumes branded cement (Ultratech/ACC, OPC 53 Grade), Fe500D TMT steel, M20–M25 grade concrete for structural elements, and standard-quality flooring, plumbing, and electrical fittings. A detailed material specification is available on request and can be annexed to this estimate for the bank's technical appraisal.</p>

    <p style="margin-top:1.5rem;">Prepared by: <strong>HoskoteConstruction</strong>, Balaji Gold City, Hoskote, Karnataka · UDYAM-KR-02-0127051</p>

    <div class="sig-row">
      <div class="sig-box">PREPARED BY<br>HoskoteConstruction</div>
      <div class="sig-box">CERTIFIED BY<br>Civil Engineer (Name, License No. & Signature)</div>
    </div>
  `;
  document.getElementById('printable-loan-estimate').innerHTML = html;
}

function printLoanEstimate() {
  generateLoanEstimate();
  printDocById('printable-loan-estimate');
}

function copyLoanEstimateText() {
  generateLoanEstimate();
  const text = document.getElementById('printable-loan-estimate').innerText;
  navigator.clipboard.writeText(text).then(() => {
    alert('Estimate text copied! Paste it into WhatsApp, Word, or an email.');
  }).catch(() => {
    alert('Could not copy automatically — please select and copy the text manually.');
  });
}
if (document.getElementById('printable-loan-estimate')) generateLoanEstimate();

if (document.getElementById('loan-amt')) calcLoan();
if (document.getElementById('q-sqft')) calcQty();

/*
 * Indicative construction cost calculator (homepage and /construction-cost).
 * Plain arithmetic only:  built-up area x package rate = indicative construction cost.
 * It never produces a quotation. Rates come from HC_CONFIG (assets/site-config.js).
 * The page just needs:  <div id="hc-calculator"></div>
 */
(function () {
  'use strict';
  var root = document.getElementById('hc-calculator');
  var C = window.HC_CONFIG;
  if (!root || !C) return;

  var MIN_AREA = 300, MAX_AREA = 10000;
  // Typical separate costs, shown for information only. They are published on /packages and are NOT added to the figure above.
  var EXTRAS = [
    ['Plan approval fees', '₹20,000 – ₹80,000'],
    ['Temporary electricity connection', '₹15,000 – ₹40,000'],
    ['Permanent BESCOM connection', '₹15,000 – ₹45,000'],
    ['Borewell', '₹60,000 – ₹1,20,000'],
    ['Water sump', '₹35,000 – ₹70,000'],
    ['Compound wall and gate, interiors and furniture, landscaping, land', 'Budgeted separately']
  ];
  var DISCLAIMER = 'This is an indicative construction cost calculation, not a formal quotation. Actual costs depend on construction specifications, site conditions, selected package and additional requirements.';

  function inr(n) { return '₹' + Math.round(n).toLocaleString('en-IN'); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  var pkgOptions = (C.packages || []).map(function (p, i) {
    return '<option value="' + p.rate + '" data-name="' + esc(p.name) + '"' + (i === 0 ? ' selected' : '') + '>' + esc(p.name) + ': from ' + inr(p.rate) + ' per sq ft</option>';
  }).join('');

  root.innerHTML =
    '<div class="calc-wrapper calc-simple">' +
      '<div class="calc-header"><h3>Indicative construction cost</h3>' +
      '<p style="color:rgba(255,255,255,.75);font-size:.9rem;margin-top:.35rem;">Built-up area &times; construction rate. Starting from ' + inr(C.startingRate) + ' per sq ft.</p></div>' +
      '<div class="calc-body">' +
        '<div class="calc-grid">' +
          '<div class="form-group"><label for="hcc-area">Total built-up area, all floors (sq ft)</label>' +
            '<input type="number" id="hcc-area" value="1200" min="' + MIN_AREA + '" max="' + MAX_AREA + '" step="1" inputmode="numeric" aria-describedby="hcc-help hcc-error">' +
            '<div class="calc-help" id="hcc-help"><strong>Use built-up area, not plot area.</strong> Plot area is the size of your land (a 30&times;40 ft plot is 1,200 sq ft of plot). Built-up area is the total constructed floor area on every floor, so a two-floor house has more built-up area than the plot footprint.</div></div>' +
          '<div class="form-group"><label for="hcc-pkg">Construction package</label>' +
            '<select id="hcc-pkg">' + pkgOptions + '</select>' +
            '<div class="calc-help">The applicable rate depends on the package and specifications you choose.</div></div>' +
        '</div>' +
        '<div id="hcc-error" role="alert" style="display:none;color:#B91C1C;font-size:.9rem;margin-top:.75rem;"></div>' +
        '<div class="calc-result">' +
          '<div class="calc-result__main">' +
            '<div class="calc-result__label">Indicative construction cost</div>' +
            '<div class="calc-result__amount" id="hcc-amount" aria-live="polite">—</div>' +
            '<div class="calc-result__range" id="hcc-formula"></div>' +
          '</div>' +
          '<div class="calc-actions">' +
            '<a href="https://wa.me/' + C.whatsappNumber + '" id="hcc-wa" class="btn btn--whatsapp btn--lg" rel="noopener">WhatsApp: House Construction Enquiry</a>' +
            '<a href="/inspection-policy" class="btn btn--ghost-light btn--md">Read the inspection policy first</a>' +
          '</div>' +
        '</div>' +
        '<p class="calc-disclaimer"><strong>' + esc(DISCLAIMER) + '</strong> For a quotation specific to your property, see <a href="/inspection-policy" style="text-decoration:underline;">how inspections and quotations work</a>.</p>' +
        '<details class="calc-extras"><summary>Typical separate costs (not included in the figure above)</summary><ul>' +
          EXTRAS.map(function (x) { return '<li>' + esc(x[0]) + ': ' + esc(x[1]) + '</li>'; }).join('') +
        '</ul><p class="fine" style="margin-top:.5rem;">Indicative ranges from our Packages page. GST treatment and design fees are written into the agreement.</p></details>' +
      '</div>' +
    '</div>';

  var areaEl = document.getElementById('hcc-area');
  var pkgEl = document.getElementById('hcc-pkg');
  var errEl = document.getElementById('hcc-error');
  var amtEl = document.getElementById('hcc-amount');
  var formulaEl = document.getElementById('hcc-formula');
  var waEl = document.getElementById('hcc-wa');
  var tracked = false;

  function calc() {
    var raw = areaEl.value.trim();
    var area = parseFloat(raw);
    var rate = parseFloat(pkgEl.value);
    var msg = '';
    if (raw === '') msg = 'Enter your built-up area to see an indicative cost.';
    else if (!isFinite(area) || area <= 0) msg = 'Built-up area must be a positive number.';
    else if (area < MIN_AREA) msg = 'For built-up areas below ' + MIN_AREA + ' sq ft, please describe your requirement in an enquiry.';
    else if (area > MAX_AREA) msg = 'For built-up areas above ' + MAX_AREA.toLocaleString('en-IN') + ' sq ft, please describe your requirement in an enquiry.';
    else if (!isFinite(rate)) msg = 'Please choose a package.';

    if (msg) {
      errEl.textContent = msg; errEl.style.display = 'block';
      amtEl.textContent = '—'; formulaEl.textContent = '';
      waEl.href = (window.HC ? HC.waLink('house') : 'https://wa.me/' + C.whatsappNumber);
      return;
    }
    errEl.style.display = 'none';
    var cost = area * rate;
    amtEl.textContent = inr(cost);
    formulaEl.textContent = area.toLocaleString('en-IN') + ' sq ft × ' + inr(rate) + ' per sq ft';
    var name = pkgEl.options[pkgEl.selectedIndex].getAttribute('data-name');
    if (window.HC) {
      waEl.href = HC.waLink('house', {
        area: area.toLocaleString('en-IN') + ' sq ft built-up',
        pkg: name,
        amount: inr(cost) + ' for ' + area.toLocaleString('en-IN') + ' sq ft at ' + inr(rate) + ' per sq ft'
      });
    }
    if (!tracked && typeof trackEvent === 'function') { tracked = true; trackEvent('calculator_completed'); }
  }

  areaEl.addEventListener('input', calc);
  pkgEl.addEventListener('change', calc);
  calc();
})();

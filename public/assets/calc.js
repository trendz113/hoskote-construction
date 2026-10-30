// Construction cost calculator. Base cost = area per floor x floors x package rate (plain arithmetic).
// The range adds the typical one-time costs that are NOT in the per sq ft rate (published on the Packages page):
//   plan approval 20k-80k, temporary electricity 15k-40k, permanent BESCOM 15k-45k, borewell 60k-1.2L, sump 35k-70k.
var EXTRAS_LOW = 20000 + 15000 + 15000 + 60000 + 35000;     // 1,45,000
var EXTRAS_HIGH = 80000 + 40000 + 45000 + 120000 + 70000;   // 3,55,000
var lastCalc = null;

function formatINR(n) { return '₹' + Math.round(n).toLocaleString('en-IN'); }
function compactINR(n) {
  if (n >= 1e7) return '₹' + (n / 1e7).toFixed(2).replace(/\.?0+$/, '') + ' Cr';
  return '₹' + (n / 1e5).toFixed(2).replace(/\.?0+$/, '') + ' L';
}
function roundDown(n, step) { return Math.floor(n / step) * step; }
function roundUp(n, step) { return Math.ceil(n / step) * step; }

function calcCost() {
  var areaEl = document.getElementById('sqft');
  if (!areaEl) return;
  var errEl = document.getElementById('calc-error');
  var floors = parseInt(document.getElementById('floors').value, 10);
  var rate = parseFloat(document.getElementById('pkg').value);
  var area = parseFloat(areaEl.value);
  var amountEl = document.getElementById('calc-amount');
  var waEl = document.getElementById('calc-wa');
  var error = '';
  if (areaEl.value.trim() === '') error = 'Enter the built-up area per floor to see an estimate.';
  else if (!isFinite(area) || area <= 0) error = 'Area must be a positive number.';
  else if (area < 300) error = 'For areas below 300 sq ft per floor, please contact us for a custom quote.';
  else if (area > 5000) error = 'For areas above 5,000 sq ft per floor, please contact us for a custom quote.';
  else if (!isFinite(floors) || !isFinite(rate)) error = 'Please choose floors and a package.';
  var ids = ['bd-area', 'bd-rate', 'bd-base', 'bd-extras'];
  if (error) {
    errEl.textContent = error; errEl.style.display = 'block';
    amountEl.textContent = '—'; document.getElementById('calc-range').textContent = '';
    ids.forEach(function (i) { document.getElementById(i).textContent = '—'; });
    lastCalc = null; waEl.href = 'https://wa.me/919742801802';
    return;
  }
  errEl.style.display = 'none';
  var totalArea = area * floors, base = totalArea * rate;
  var lo = roundDown(base + EXTRAS_LOW, 10000), hi = roundUp(base + EXTRAS_HIGH, 10000);
  amountEl.textContent = compactINR(lo) + ' – ' + compactINR(hi);
  document.getElementById('calc-range').textContent = 'Base construction cost ' + formatINR(base) + ' plus typical additional costs';
  document.getElementById('bd-area').textContent = totalArea.toLocaleString('en-IN') + ' sq ft';
  document.getElementById('bd-rate').textContent = '₹' + rate.toLocaleString('en-IN');
  document.getElementById('bd-base').textContent = formatINR(base);
  document.getElementById('bd-extras').textContent = compactINR(EXTRAS_LOW) + ' – ' + compactINR(EXTRAS_HIGH);
  var sel = document.getElementById('pkg');
  lastCalc = { area: area, floors: floors, totalArea: totalArea, rate: rate, base: base, lo: lo, hi: hi,
    pkg: sel.options[sel.selectedIndex].text.split(':')[0], bhk: document.getElementById('bhk').value };
  var msg = 'Hi, I used your cost calculator: ' + lastCalc.pkg + ' package, ' + lastCalc.bhk + ', ' + floors + ' floor(s) x ' + area +
    ' sq ft = ' + totalArea + ' sq ft built-up. Base construction cost ' + formatINR(base) + '; indicative budget range ' + compactINR(lo) + ' to ' + compactINR(hi) +
    ' including typical additional costs. Please send me a detailed estimate.';
  waEl.href = 'https://wa.me/919742801802?text=' + encodeURIComponent(msg);
}

// Sends the visitor to the enquiry form with their calculator choices filled in.
function calcRequestQuote(e) {
  if (e) e.preventDefault();
  if (lastCalc) {
    var msg = document.getElementById('cf-msg'), type = document.getElementById('cf-type'),
        size = document.getElementById('cf-size'), floors = document.getElementById('cf-floors');
    if (type) type.value = 'Cost Estimate';
    if (size && !size.value) size.value = lastCalc.totalArea + ' sq ft built-up';
    if (floors) floors.value = String(lastCalc.floors);
    if (msg && !msg.value) msg.value = 'Calculator: ' + lastCalc.pkg + ', ' + lastCalc.bhk + ', ' + lastCalc.floors + ' floor(s) x ' + lastCalc.area +
      ' sq ft = ' + lastCalc.totalArea + ' sq ft. Base cost ' + formatINR(lastCalc.base) + ', indicative range ' + compactINR(lastCalc.lo) + ' to ' + compactINR(lastCalc.hi) + '.';
    if (typeof trackEvent === 'function') trackEvent('calculator_completed');
  }
  var f = document.getElementById('cf-name');
  var wrap = document.getElementById('contactFormWrap') || document.getElementById('contact');
  if (wrap) wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (f) setTimeout(function () { f.focus({ preventScroll: true }); }, 400);
}
calcCost();

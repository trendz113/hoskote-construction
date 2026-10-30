// Shared site script: mobile menu, tools dropdown, analytics hook, enquiry forms, FAQ accordion.
(function(){
  var t=document.getElementById('mobileToggle'),d=document.getElementById('mobileDrawer');
  if(!t||!d)return;
  t.addEventListener('click',function(){var o=d.classList.toggle('open');t.setAttribute('aria-expanded',String(o));});
  d.querySelectorAll('.nav__drawer-link').forEach(function(l){l.addEventListener('click',function(){d.classList.remove('open');t.setAttribute('aria-expanded','false');});});
})();
function scrollToSection(selector){var el=document.querySelector(selector);if(el)el.scrollIntoView({behavior:'smooth',block:'start'});}
function toggleFaq(el) {
  const item = el.parentElement;
  const isOpen = item.classList.contains('open');
  document.querySelectorAll('.faq-item.open').forEach(i => { i.classList.remove('open'); const q = i.querySelector('.faq-q'); if (q) q.setAttribute('aria-expanded', 'false'); });
  if (!isOpen) { item.classList.add('open'); el.setAttribute('aria-expanded', 'true'); }
}

// Free Tools dropdown: keep aria-expanded in sync, close on outside click / Escape
(function () {
  const dd = document.querySelector('.nav__dd');
  if (!dd) return;
  const btn = dd.querySelector('.nav__dd-btn');
  const setOpen = open => { dd.classList.toggle('open', open); btn.setAttribute('aria-expanded', String(open)); };
  btn.addEventListener('click', () => setOpen(!dd.classList.contains('open')));
  dd.addEventListener('mouseenter', () => btn.setAttribute('aria-expanded', 'true'));
  dd.addEventListener('mouseleave', () => { if (!dd.classList.contains('open')) btn.setAttribute('aria-expanded', 'false'); });
  document.addEventListener('click', e => { if (!dd.contains(e.target)) setOpen(false); });
  // Escape must close the menu even while the pointer or keyboard focus is still inside it
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && (dd.classList.contains('open') || dd.matches(':hover, :focus-within'))) {
      setOpen(false); dd.classList.add('force-closed'); btn.setAttribute('aria-expanded', 'false');
    }
  });
  const reopenAllowed = () => dd.classList.remove('force-closed');
  dd.addEventListener('mouseleave', reopenAllowed);
  btn.addEventListener('click', reopenAllowed);
  btn.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') reopenAllowed(); });
  dd.querySelectorAll('a').forEach(a => a.addEventListener('click', () => { setOpen(false); dd.classList.add('force-closed'); }));
})();
// Prefill the enquiry form when a visitor arrives from the dream-home preview
(function () {
  try {
    var raw = sessionStorage.getItem('hcJourney');
    if (!raw) return;
    sessionStorage.removeItem('hcJourney');
    var j = JSON.parse(raw), set = function (id, v) { var el = document.getElementById(id); if (el && !el.value && v) el.value = v; };
    var type = document.getElementById('cf-type'); if (type) type.value = 'Cost Estimate';
    set('cf-size', j.size); set('cf-msg', j.msg);
    var fl = document.getElementById('cf-floors'); if (fl && j.floors) fl.value = String(j.floors);
  } catch (e) { /* storage unavailable: the form simply stays empty */ }
})();
// Analytics hook: only reports if an analytics tool is actually installed on the page.
// Never sends names, phone numbers or other personal details.
function trackEvent(name) {
  try {
    if (typeof gtag === 'function') gtag('event', name);
    else if (typeof plausible === 'function') plausible(name);
  } catch (e) { /* analytics must never break the page */ }
}
document.addEventListener('click', function (e) {
  const a = e.target.closest && e.target.closest('a[href]');
  if (!a) return;
  const h = a.getAttribute('href') || '';
  if (h.indexOf('wa.me/') !== -1) trackEvent('whatsapp_cta_clicked');
  else if (h.indexOf('tel:') === 0) trackEvent('phone_cta_clicked');
});
let formStarted = false;
document.addEventListener('input', function (e) {
  if (!formStarted && e.target.id && e.target.id.indexOf('cf-') === 0) { formStarted = true; trackEvent('estimate_form_started'); }
});

// Lenient phone check (matches the server): 8-13 digits after removing spaces, dashes and +,
// and not one repeated digit. Real Indian mobile, landline and +91 formats all pass.
function phoneLooksValid(raw) {
  const d = String(raw).replace(/[^\d]/g, '');
  return d.length >= 8 && d.length <= 13 && !/^(\d)\1+$/.test(d);
}

let formSubmitting = false;
// Contact form: saves the enquiry on the server and only says "received" if the server confirms it.
async function submitForm() {
  if (formSubmitting) return;
  const v = id => (document.getElementById(id) || { value: '' }).value.trim();
  const name = v('cf-name'), phone = v('cf-phone');
  const errBox = document.getElementById('contact-error');
  const okBox = document.getElementById('contact-success');
  const btn = document.getElementById('cf-submit-btn');
  const btnLabel = btn ? btn.textContent : '';
  const showError = (msg, field) => {
    errBox.textContent = msg;
    errBox.style.display = 'block';
    okBox.style.display = 'none';
    if (field) document.getElementById(field).focus();
  };
  errBox.style.display = 'none';

  if (!name) return showError('Please enter your name.', 'cf-name');
  if (!phone) return showError('Please enter your phone number.', 'cf-phone');
  if (!phoneLooksValid(phone)) return showError('That phone number does not look right. Please check it, or WhatsApp us directly.', 'cf-phone');

  const payload = {
    name, phone,
    contactMethod: v('cf-contact'),
    area: v('cf-area'),
    size: v('cf-size'),
    floors: v('cf-floors'),
    budget: v('cf-budget'),
    startDate: v('cf-start'),
    type: v('cf-type'),
    message: v('cf-msg'),
    website: v('cf-website'),
  };

  formSubmitting = true;
  if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
  try {
    const res = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    let data = {};
    try { data = await res.json(); } catch (e) { /* non-JSON error */ }
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'We could not save your request.');
    }
    okBox.style.display = 'block';
    okBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    trackEvent('estimate_form_submitted');
    if (btn) btn.textContent = 'Request sent ✓';  // stays disabled to prevent accidental duplicates
    return;
  } catch (err) {
    console.error('Lead submit failed', err);
    const wa = 'https://wa.me/919742801802?text=' + encodeURIComponent(
      `Hi! I'm ${name}.\nRequest: ${payload.type}\nPhone: ${phone}\nLocation: ${payload.area || 'Not specified'}\nSize: ${payload.size || 'Not specified'}\n${payload.message ? 'Details: ' + payload.message : ''}`);
    errBox.innerHTML = '';
    errBox.append((err.message || 'We could not save your request.') + ' Your request was NOT sent. Please try again, or ');
    const link = document.createElement('a');
    link.href = wa; link.textContent = 'send it on WhatsApp'; link.style.fontWeight = '700'; link.style.textDecoration = 'underline';
    errBox.append(link, '.');
    errBox.style.display = 'block';
    okBox.style.display = 'none';
    if (btn) { btn.disabled = false; btn.textContent = btnLabel; }
  } finally {
    formSubmitting = false;
  }
}


// ?pkg=Comfortable (from a package card) pre-selects the interest on the enquiry form
(function () {
  try {
    var p = new URLSearchParams(location.search).get('pkg');
    var msg = document.getElementById('cf-msg');
    if (!p || !msg || msg.value) return;
    var ok = { Comfortable: 1, 'Better-Living': 1, 'Dream-Home': 1, 'Dream Home': 1 };
    if (!ok[p]) return;
    msg.value = 'I would like a detailed estimate for the ' + p.replace('-Home', ' Home') + ' package.';
    var t = document.getElementById('cf-type'); if (t) t.value = 'Cost Estimate';
  } catch (e) { /* ignore */ }
})();

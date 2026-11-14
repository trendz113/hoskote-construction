/*
 * Shared policy script (loaded on every public page, after site-config.js).
 *  1. Fills [data-cfg] placeholders from HC_CONFIG (inspection fee, package rates).
 *  2. Builds the classified WhatsApp links: <a data-wa="house|inspection|contractor|supplier|office">.
 *  3. Shows a slim policy notice under the header so the paid-inspection policy is visible
 *     before anyone taps a WhatsApp button.
 * If this script fails to load, the static text and plain wa.me links in the HTML still work.
 */
(function () {
  'use strict';
  var C = window.HC_CONFIG;
  if (!C) return;

  function inr(n) { return '₹' + Number(n).toLocaleString('en-IN'); }
  var feeKnown = C.inspection && typeof C.inspection.fee === 'number' && C.inspection.fee > 0;
  var feeText = feeKnown ? inr(C.inspection.fee) : 'a fee that is confirmed before booking';
  var feeShort = feeKnown ? inr(C.inspection.fee) : 'chargeable';

  /* ---------- WhatsApp message templates (one per enquiry type) ---------- */
  var T = {
    house: function (o) {
      o = o || {};
      var lines = [
        'Hello Hoskote Construction, I would like to enquire about house construction.',
        ''
      ];
      lines.push('Plot location:');
      lines.push('Plot size and planned built-up area (sq ft):' + (o.area ? ' ' + o.area : ''));
      lines.push('Number of floors:');
      lines.push('Expected construction start:');
      lines.push('Package I am considering (Comfortable / Better-Living / Dream Home):' + (o.pkg ? ' ' + o.pkg : ''));
      lines.push('Other requirements:');
      if (o.amount) {
        lines.push('');
        lines.push('(Website calculator figure: ' + o.amount + '. I understand this is indicative only, not a quotation.)');
      }
      lines.push('');
      lines.push('I understand that property visits are chargeable (' + feeText + ', paid in advance, adjusted in full against the construction package if I build with you) and that free quotations are not given.');
      return lines.join('\n');
    },
    inspection: function () {
      return [
        'Hello Hoskote Construction, I would like to book a paid property inspection (' + feeText + ', payable in advance).',
        '',
        'Property type (vacant plot / purchased property / bank auction property / other):',
        'Location:',
        'Approximate size:',
        'Preferred visit dates:',
        '',
        'I understand that the visit is scheduled only after payment confirmation, and that a physical inspection is not legal title verification, auction valuation or a structural safety certificate. Please share the payment details.'
      ].join('\n');
    },
    contractor: function () {
      return [
        'Hello Hoskote Construction, I am an independent contractor interested in your Contractor Partnership Programme.',
        '',
        'Name / business name:',
        'Years of experience in residential construction:',
        'Areas where I work:',
        '',
        'I will also complete the registration form on your website. I understand that scope, specifications and payment terms are agreed with Hoskote Construction before I deal with any customer.'
      ].join('\n');
    },
    supplier: function () {
      return [
        'Hello Hoskote Construction, I would like to register as a material supplier.',
        '',
        'Company name:',
        'Materials supplied:',
        'GST number:',
        '',
        'I will submit my catalogue, specifications, pricing, minimum order quantity and delivery locations through the supplier registration form.'
      ].join('\n');
    },
    office: function () {
      return [
        'Hello Hoskote Construction, I am interested in building a house and would like to request an office visit appointment.',
        '',
        'Preferred date and time (at least ' + C.officeAppointmentNotice + ' from today):',
        'What I would like to see (packages / material specifications / completed projects / process):',
        'Plot location:',
        '',
        'I will wait for your confirmation before visiting.'
      ].join('\n');
    }
  };

  function waLink(key, opts) {
    var f = T[key] || T.house;
    return 'https://wa.me/' + C.whatsappNumber + '?text=' + encodeURIComponent(f(opts));
  }

  /* ---------- fill placeholders ---------- */
  function fillConfig() {
    var map = { fee: feeShort };
    (C.packages || []).forEach(function (p) { map['rate-' + p.id] = inr(p.rate); });
    map.startingRate = inr(C.startingRate);
    map.serviceArea = C.serviceArea;
    map.phone = C.phoneDisplay;
    map.officeNotice = C.officeAppointmentNotice;
    document.querySelectorAll('[data-cfg]').forEach(function (el) {
      var k = el.getAttribute('data-cfg');
      if (map[k] != null) el.textContent = map[k];
    });
    document.querySelectorAll('a[data-wa]').forEach(function (a) {
      a.href = waLink(a.getAttribute('data-wa'), { pkg: a.getAttribute('data-wa-pkg') || undefined });
      a.rel = 'noopener';
    });
  }

  /* ---------- slim policy notice under the header ---------- */
  function addPolicyBar() {
    if (document.querySelector('.hc-policybar') || document.body.hasAttribute('data-no-policybar')) return;
    var style = document.createElement('style');
    style.textContent =
      '.hc-policybar{background:#F7EAE4;color:#5a2713;border-bottom:1px solid #e8cfc4;font:500 .8rem/1.45 Inter,system-ui,sans-serif;padding:.5rem 1rem;text-align:center}' +
      '.hc-policybar a{color:#8A3B20;font-weight:700;text-decoration:underline;white-space:nowrap}' +
      '@media(max-width:600px){.hc-policybar{font-size:.76rem;padding:.45rem .75rem;text-align:left}}';
    document.head.appendChild(style);
    var bar = document.createElement('div');
    bar.className = 'hc-policybar';
    bar.setAttribute('role', 'note');
    bar.innerHTML = 'Property visits are chargeable: ' + feeText + ' paid in advance, adjusted in full if you build with us. <a href="/inspection-policy">Read the policy</a>';
    var nav = document.querySelector('nav');
    if (nav && nav.parentNode) nav.parentNode.insertBefore(bar, nav.nextSibling);
    else document.body.insertBefore(bar, document.body.firstChild);
  }

  window.HC = { inr: inr, waLink: waLink, feeText: feeText, feeKnown: feeKnown, config: C };

  function init() { fillConfig(); addPolicyBar(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

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
  var feeShort = feeKnown ? inr(C.inspection.fee) : 'a fee confirmed before booking';

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
      return lines.join('\n');
    },
    inspection: function () {
      return [
        'Hello Hoskote Construction, I would like to book a property inspection.',
        '',
        'Property type (vacant plot / purchased property / bank auction property / other):',
        'Location:',
        'Approximate size:',
        'Preferred visit dates:',
        '',
        'I understand that the visit is scheduled only after the inspection terms are agreed with me, and that a physical inspection is not legal title verification, auction valuation, soil testing or a structural safety certificate. Please review my details and explain the inspection terms.'
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

  window.HC = { inr: inr, waLink: waLink, feeText: feeText, feeKnown: feeKnown, config: C };

  function init() { fillConfig(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

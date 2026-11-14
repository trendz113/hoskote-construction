/*
 * Shared form handler for the enquiry, contractor-partnership and supplier forms.
 *
 * Markup contract:
 *   <form data-hc-form data-endpoint="/api/leads" data-wa-fallback="house" novalidate> ... </form>
 *   fields use name="..." matching the server field names; required fields carry `required`.
 *   <div class="form-error" role="alert"> and <div class="form-success"> sit inside the form's wrapper.
 *   A hidden honeypot input name="website" must stay empty.
 *
 * Spam protection: honeypot, a "page opened at" timestamp (_t) the server checks for instant bot posts,
 * and server-side rate limiting. Validation here mirrors the server so people get quick, clear messages.
 */
(function () {
  'use strict';

  function digits(v) { return String(v || '').replace(/\D/g, ''); }
  function phoneOk(v) { var d = digits(v); return d.length >= 8 && d.length <= 13 && !/^(\d)\1+$/.test(d); }
  function emailOk(v) { return /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(String(v || '').trim()); }
  function labelOf(form, el) {
    var l = el.id && form.querySelector('label[for="' + el.id + '"]');
    return l ? l.textContent.replace(/[*:]/g, '').replace(/\s+/g, ' ').trim() : (el.name || 'this field');
  }

  function init(form) {
    var wrap = form.parentElement;
    var errBox = wrap.querySelector('.form-error');
    var okBox = wrap.querySelector('.form-success');
    var btn = form.querySelector('button[type="submit"]');
    var btnLabel = btn ? btn.textContent : '';
    var opened = Date.now();
    var submitting = false;

    function showError(msg, el) {
      errBox.textContent = msg;
      errBox.style.display = 'block';
      if (okBox) okBox.style.display = 'none';
      errBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      if (el && el.focus) el.focus({ preventScroll: true });
    }

    function collect() {
      var data = {};
      Array.prototype.forEach.call(form.elements, function (el) {
        if (!el.name || el.disabled) return;
        if (el.type === 'checkbox') {
          if (el.hasAttribute('data-group')) {
            data[el.name] = data[el.name] || [];
            if (el.checked) data[el.name].push(el.value);
          } else {
            data[el.name] = el.checked;
          }
        } else if (el.type === 'radio') {
          if (el.checked) data[el.name] = el.value;
        } else {
          data[el.name] = String(el.value || '').trim();
        }
      });
      return data;
    }

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (submitting) return;
      errBox.style.display = 'none';

      // required fields
      var els = form.querySelectorAll('[required]');
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        if (el.type === 'checkbox') {
          if (!el.checked) return showError(el.getAttribute('data-msg') || 'Please tick the confirmation box to continue.', el);
        } else if (!String(el.value || '').trim()) {
          return showError('Please fill in: ' + labelOf(form, el) + '.', el);
        }
      }
      // checkbox groups that must have one choice
      var groups = form.querySelectorAll('[data-group-required]');
      for (var g = 0; g < groups.length; g++) {
        var name = groups[g].getAttribute('data-group-required');
        if (!form.querySelector('input[name="' + name + '"]:checked')) return showError(groups[g].getAttribute('data-msg') || 'Please choose at least one option.', groups[g].querySelector('input'));
      }
      var phone = form.elements.phone;
      if (phone && !phoneOk(phone.value)) return showError('That phone number does not look right. Please check it.', phone);
      var email = form.elements.email;
      if (email && email.value.trim() && !emailOk(email.value)) return showError('That email address does not look right.', email);
      var min = form.querySelectorAll('[data-minlen]');
      for (var m = 0; m < min.length; m++) {
        if (String(min[m].value).trim().length < Number(min[m].getAttribute('data-minlen'))) {
          return showError(min[m].getAttribute('data-msg') || ('Please add a little more detail in: ' + labelOf(form, min[m]) + '.'), min[m]);
        }
      }
      var gst = form.elements.gstin;
      if (gst && gst.value.trim() && !/^\d{2}[A-Za-z]{5}\d{4}[A-Za-z][1-9A-Za-z]Z[0-9A-Za-z]$/.test(gst.value.trim())) {
        return showError('That GST number does not look right. It has 15 characters, for example 29ABCDE1234F1Z5.', gst);
      }

      var payload = collect();
      payload._t = opened;
      submitting = true;
      if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }

      fetch(form.getAttribute('data-endpoint'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) { return { ok: res.ok, data: data }; });
      }).then(function (r) {
        if (!r.ok || !r.data.success) throw new Error(r.data.error || 'We could not save your request.');
        form.style.display = 'none';
        if (okBox) { okBox.style.display = 'block'; okBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
        if (typeof trackEvent === 'function') trackEvent(form.getAttribute('data-track') || 'form_submitted');
      }).catch(function (err) {
        errBox.textContent = '';
        errBox.appendChild(document.createTextNode((err.message || 'We could not save your request.') + ' '));
        var kind = form.getAttribute('data-wa-fallback');
        if (kind && window.HC) {
          errBox.appendChild(document.createTextNode('If this keeps happening, you can '));
          var a = document.createElement('a');
          a.href = HC.waLink(kind); a.textContent = 'message us on WhatsApp'; a.style.fontWeight = '700'; a.style.textDecoration = 'underline'; a.rel = 'noopener';
          errBox.appendChild(a); errBox.appendChild(document.createTextNode('.'));
        }
        errBox.style.display = 'block';
        if (okBox) okBox.style.display = 'none';
        if (btn) { btn.disabled = false; btn.textContent = btnLabel; }
      }).then(function () { submitting = false; });
    });
  }

  function boot() { Array.prototype.forEach.call(document.querySelectorAll('form[data-hc-form]'), init); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();

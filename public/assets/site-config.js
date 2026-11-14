/*
 * HOSKOTE CONSTRUCTION: SITE CONFIGURATION
 * ------------------------------------------------------------------
 * Edit the values below to change them everywhere on the website.
 * No other file needs to change for these items.
 *
 *  inspection.fee        Property inspection fee in rupees (a number, e.g. 1000).
 *                        Set to null if management has not confirmed a fee;
 *                        the site then says the amount is confirmed before booking.
 *  inspection.adjustment 'full' = the whole fee is adjusted against the construction
 *                        package if the customer awards the contract to us.
 *  packages[].rate       Starting rate per sq ft of built-up area for each package.
 *  startingRate          The "starting from" rate shown in headlines.
 *  whatsappNumber        WhatsApp number in international format, digits only.
 *
 * After editing, redeploy. Pages that still show a rate or fee as plain text
 * (blog articles, FAQ answers) are listed in owner-review/OWNER-APPROVAL-CHECKLIST.md.
 */
window.HC_CONFIG = {
  whatsappNumber: '919742801802',
  phoneDisplay: '+91 97428 01802',
  email: 'hello@hoskoteconstruction.in',

  inspection: {
    fee: 1000,
    adjustment: 'full'
  },

  serviceArea: 'Hoskote and mutually agreed nearby locations',
  startingRate: 1800,

  packages: [
    { id: 'comfortable', name: 'Comfortable Home',   rate: 1800 },
    { id: 'better',      name: 'Better-Living Home', rate: 2000 },
    { id: 'dream',       name: 'Dream Home',         rate: 2200 }
  ],

  officeAppointmentNotice: '1 to 2 days'
};

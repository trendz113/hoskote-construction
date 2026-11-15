require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── CLOUDINARY CONFIG ───
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ─── MIDDLEWARE ───
app.disable('x-powered-by');
app.set('trust proxy', 1); // Railway sits behind a proxy; needed for correct client IPs
app.use((req, res, next) => {
  // Behind Railway's proxy: send any plain-HTTP browser request to HTTPS (never for local testing)
  if (req.headers['x-forwarded-proto'] === 'http' && !/^(localhost|127\.0\.0\.1)/.test(req.headers.host || '')) {
    return res.redirect(301, 'https://' + req.headers.host + req.originalUrl);
  }
  next();
});
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (req.secure) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  next();
});
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '50kb' }));

// ─── SIMPLE IN-MEMORY RATE LIMITER (no extra dependency) ───
// Good enough to stop casual form spam on a single server; resets on restart.
function rateLimit({ windowMs, max, message }) {
  const hits = new Map();
  setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [ip, arr] of hits) {
      const fresh = arr.filter(t => t > cutoff);
      if (fresh.length) hits.set(ip, fresh); else hits.delete(ip);
    }
  }, windowMs).unref();
  return (req, res, next) => {
    const now = Date.now();
    const arr = (hits.get(req.ip) || []).filter(t => t > now - windowMs);
    if (arr.length >= max) {
      return res.status(429).json({ error: message || 'Too many requests — please try again later.' });
    }
    arr.push(now);
    hits.set(req.ip, arr);
    next();
  };
}
const formLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 8, message: 'Too many submissions from this connection. Please WhatsApp us directly.' });
const uploadLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 10, message: 'Too many uploads. Please try again later.' });
const loginLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 20, message: 'Too many attempts. Please wait and try again.' });

// Indian mobile numbers: optional +91 / 91 / 0 prefix, then 10 digits starting 6-9.
// Landlines and odd formats are still accepted if they contain 8-13 digits, so real enquiries are not rejected.
function cleanPhone(raw) {
  const digits = String(raw || '').replace(/[^\d]/g, '');
  if (digits.length < 8 || digits.length > 13 || /^(\d)\1+$/.test(digits)) return null;
  return String(raw).trim().slice(0, 20);
}
app.use(express.static(path.join(__dirname, 'public'), {
  extensions: ['html'],
  setHeaders(res, filePath) {
    const base = path.basename(filePath);
    // keep the admin page and internal data files out of Google
    if (base === 'admin.html' || base.startsWith('_')) res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    // images and icons change rarely: let browsers cache them for a week
    if (/\.(jpe?g|png|webp|svg|ico|woff2?)$/i.test(base)) res.setHeader('Cache-Control', 'public, max-age=604800');
  },
}));

// ─── CLOUDINARY MULTER STORAGE ───
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const { projectId, stage } = req.body;
    return {
      folder: `hoskote-construction/${projectId}/${stage}`,
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      transformation: [{ width: 1200, height: 900, crop: 'fill', quality: 'auto', fetch_format: 'auto' }],
      public_id: `${stage}_${Date.now()}`,
    };
  },
});

const upload = multer({ storage });

// ─── CONTRACTOR LISTING PHOTO STORAGE ───
const contractorStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: `hoskote-construction/contractor-listings`,
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 1000, height: 750, crop: 'fill', quality: 'auto', fetch_format: 'auto' }],
    public_id: `${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
  }),
});
const uploadContractorPhotos = multer({ storage: contractorStorage, limits: { files: 3, fileSize: 8 * 1024 * 1024 } });

// ─── CONTRACTOR LISTINGS: FILE-BASED STORAGE ───
// Where leads and contractor listings are saved. Set DATA_DIR to a folder on a Railway Volume
// (for example /data) so they survive redeploys. Without it they live inside the app folder,
// which Railway resets on every deploy.
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, 'data');
if (!process.env.DATA_DIR && (process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID)) {
  console.warn('WARNING: DATA_DIR is not set. Leads and contractor applications will be LOST on the next deploy. Attach a Railway Volume and set DATA_DIR to its mount path.');
}
const CONTRACTORS_FILE = path.join(DATA_DIR, 'contractors.json');

function readContractors() {
  try {
    if (!fs.existsSync(CONTRACTORS_FILE)) return [];
    const raw = fs.readFileSync(CONTRACTORS_FILE, 'utf8');
    return raw.trim() ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Failed to read contractors.json', err);
    return [];
  }
}

function writeContractors(list) {
  try {
    fs.mkdirSync(path.dirname(CONTRACTORS_FILE), { recursive: true });
    const tmp = CONTRACTORS_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(list, null, 2));
    fs.renameSync(tmp, CONTRACTORS_FILE);
    return true;
  } catch (err) {
    console.error('Failed to write contractors.json', err);
    return false;
  }
}

// ─── LEADS (quote/site-visit requests): FILE-BASED STORAGE ───
const LEADS_FILE = path.join(DATA_DIR, 'leads.json');

function readLeads() {
  try {
    if (!fs.existsSync(LEADS_FILE)) return [];
    const raw = fs.readFileSync(LEADS_FILE, 'utf8');
    return raw.trim() ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Failed to read leads.json', err);
    return [];
  }
}

function writeLeads(list) {
  try {
    fs.mkdirSync(path.dirname(LEADS_FILE), { recursive: true });
    const tmp = LEADS_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(list, null, 2));
    fs.renameSync(tmp, LEADS_FILE);
    return true;
  } catch (err) {
    console.error('Failed to write leads.json', err);
    return false;
  }
}

// ─── PROJECTS DATA ───
// Static project definitions — stages get populated from Cloudinary
const PROJECTS = [
  {
    id: 'project-hoskote-1',
    title: 'Hoskote Project 1',
    location: 'Hoskote',
    type: 'Update Later',
    sqft: null,
    cost: null,
    duration: null,
    status: 'completed',
    bhk: null,
    floors: null,
  },
  {
    id: 'project-hoskote-2',
    title: 'Hoskote Project 2',
    location: 'Hoskote',
    type: 'Update Later',
    sqft: null,
    cost: null,
    duration: null,
    status: 'completed',
    bhk: null,
    floors: null,
  },
  {
    id: 'project-hoskote-3',
    title: 'Hoskote Project 3',
    location: 'Hoskote',
    type: 'Update Later',
    sqft: null,
    cost: null,
    duration: null,
    status: 'completed',
    bhk: null,
    floors: null,
  },
  {
    id: 'project-hoskote-4',
    title: 'Hoskote Project 4',
    location: 'Hoskote',
    type: 'Update Later',
    sqft: null,
    cost: null,
    duration: null,
    status: 'completed',
    bhk: null,
    floors: null,
  },
  {
    id: 'project-ongoing-1',
    title: 'Ongoing Project',
    location: 'Hoskote',
    type: 'New Build',
    sqft: null,
    cost: null,
    duration: null,
    status: 'ongoing',
    bhk: null,
    floors: null,
    startDate: new Date().toISOString().split('T')[0],
  },
];

// Stage labels and order
const STAGES = [
  { id: 'empty_plot',  label: 'Empty Plot' },
  { id: 'foundation',  label: 'Foundation' },
  { id: 'slab',        label: 'Slab' },
  { id: 'walls',       label: 'Walls' },
  { id: 'finishing',   label: 'Finishing' },
  { id: 'completed',   label: 'Completed' },
];

// ─── ADMIN AUTH MIDDLEWARE ───
// Fails closed: if ADMIN_PASSWORD is not set, nobody gets in (previously an unset
// variable let requests with no password through). Header only — a password in the
// URL ends up in logs and browser history.
function passwordMatches(candidate) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || typeof candidate !== 'string') return false;
  const a = crypto.createHash('sha256').update(candidate).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

function adminAuth(req, res, next) {
  if (!passwordMatches(req.headers['x-admin-password'])) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ─── SHORT-LIVED CACHE FOR PROJECT PHOTOS ───
// /api/projects runs ~30 Cloudinary searches per call; cache for 60s and clear on upload/delete.
let projectsCache = null;
let projectsCacheAt = 0;
const PROJECTS_TTL_MS = 60 * 1000;
function clearProjectsCache() { projectsCache = null; projectsCacheAt = 0; }

// ─── API: GET ALL PROJECTS WITH PHOTOS ───
app.get('/api/projects', async (req, res) => {
  try {
    if (projectsCache && Date.now() - projectsCacheAt < PROJECTS_TTL_MS) {
      return res.json(projectsCache);
    }
    const projectsWithPhotos = await Promise.all(
      PROJECTS.map(async (project) => {
        const stages = {};
        await Promise.all(
          STAGES.map(async (stage) => {
            try {
              const result = await cloudinary.search
                .expression(`folder:hoskote-construction/${project.id}/${stage.id}`)
                .sort_by('created_at', 'asc')
                .max_results(10)
                .execute();
              stages[stage.id] = {
                label: stage.label,
                photos: result.resources.map(r => ({
                  url: r.secure_url,
                  publicId: r.public_id,
                  uploadedAt: r.created_at,
                })),
              };
            } catch {
              stages[stage.id] = { label: stage.label, photos: [] };
            }
          })
        );
        return { ...project, stages };
      })
    );
    projectsCache = { projects: projectsWithPhotos, stages: STAGES };
    projectsCacheAt = Date.now();
    res.json(projectsCache);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// ─── API: GET SINGLE PROJECT ───
app.get('/api/projects/:id', async (req, res) => {
  const project = PROJECTS.find(p => p.id === req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const stages = {};
  await Promise.all(
    STAGES.map(async (stage) => {
      try {
        const result = await cloudinary.search
          .expression(`folder:hoskote-construction/${project.id}/${stage.id}`)
          .sort_by('created_at', 'asc')
          .max_results(20)
          .execute();
        stages[stage.id] = {
          label: stage.label,
          photos: result.resources.map(r => ({
            url: r.secure_url,
            publicId: r.public_id,
            uploadedAt: r.created_at,
          })),
        };
      } catch {
        stages[stage.id] = { label: stage.label, photos: [] };
      }
    })
  );
  res.json({ ...project, stages });
});

// ─── API: UPLOAD PHOTO (admin only) ───
app.post('/api/upload', adminAuth, upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  clearProjectsCache();
  res.json({
    success: true,
    url: req.file.path,
    publicId: req.file.filename,
    projectId: req.body.projectId,
    stage: req.body.stage,
  });
});

// ─── API: DELETE PHOTO (admin only) ───
app.delete('/api/photo', adminAuth, async (req, res) => {
  const { publicId } = req.body;
  if (!publicId) return res.status(400).json({ error: 'publicId required' });
  try {
    await cloudinary.uploader.destroy(publicId);
    clearProjectsCache();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Delete failed' });
  }
});

// ─── API: UPDATE PROJECT DETAILS (admin only) ───
app.patch('/api/projects/:id', adminAuth, (req, res) => {
  const project = PROJECTS.find(p => p.id === req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  const allowed = ['title', 'location', 'sqft', 'cost', 'duration', 'bhk', 'floors', 'type', 'status'];
  allowed.forEach(key => {
    if (req.body[key] !== undefined) project[key] = req.body[key];
  });
  clearProjectsCache();
  res.json({ success: true, project });
});

// ─── API: VERIFY ADMIN ───
app.post('/api/admin/verify', loginLimiter, (req, res) => {
  const { password } = req.body || {};
  if (passwordMatches(password)) {
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Wrong password' });
  }
});

// ══════════════════════════════════════ CONTRACTOR LISTINGS ══════════════════════════════════════

// ─── API: UPLOAD APPLICATION PHOTOS (public — used during the apply form) ───
app.post('/api/contractors/upload-photos', uploadLimiter, uploadContractorPhotos.array('photos', 3), (req, res) => {
  if (!req.files || !req.files.length) return res.status(400).json({ error: 'No files uploaded' });
  res.json({
    success: true,
    photos: req.files.map(f => ({ url: f.path, publicId: f.filename })),
  });
});

// ─── API: SUBMIT APPLICATION (public) ───
app.post('/api/contractors/apply', formLimiter, (req, res) => {
  const { businessName, ownerName, phone, whatsapp, serviceArea, specialties, yearsExperience, udyam, description, plan, photos } = req.body;

  if (!businessName || !phone || !serviceArea) {
    return res.status(400).json({ error: 'Business name, phone, and service area are required' });
  }

  const list = readContractors();
  const entry = {
    id: 'ctr_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex'),
    businessName: String(businessName).trim(),
    ownerName: String(ownerName || '').trim(),
    phone: String(phone).trim(),
    whatsapp: String(whatsapp || phone).trim(),
    serviceArea: String(serviceArea).trim(),
    specialties: String(specialties || '').trim(),
    yearsExperience: yearsExperience ? Number(yearsExperience) : null,
    udyam: String(udyam || '').trim(),
    description: String(description || '').trim(),
    plan: plan === 'annual' ? 'annual' : 'monthly',
    photos: Array.isArray(photos) ? photos.slice(0, 3) : [],
    status: 'pending',       // pending | approved | rejected
    paid: false,
    submittedAt: new Date().toISOString(),
    approvedAt: null,
    expiresAt: null,
  };
  list.push(entry);
  if (!writeContractors(list)) {
    return res.status(500).json({ error: 'Could not save application — please try again or contact us on WhatsApp' });
  }
  res.json({ success: true, id: entry.id });
});

// ─── API: PUBLIC DIRECTORY — only approved, paid, not-expired listings ───
app.get('/api/contractors', (req, res) => {
  const list = readContractors();
  const now = new Date();
  const visible = list.filter(c =>
    c.status === 'approved' &&
    c.paid &&
    (!c.expiresAt || new Date(c.expiresAt) > now)
  ).sort((a, b) => a.businessName.localeCompare(b.businessName));
  res.json({ contractors: visible });
});

// ─── API: ADMIN — full list including pending/rejected/expired ───
app.get('/api/contractors/all', adminAuth, (req, res) => {
  const list = readContractors().sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  res.json({ contractors: list });
});

// ─── API: ADMIN — browse Cloudinary folders (for attaching existing photos without re-upload) ───
app.get('/api/cloudinary/folders', adminAuth, async (req, res) => {
  try {
    const parent = req.query.parent;
    const result = parent
      ? await cloudinary.api.sub_folders(parent)
      : await cloudinary.api.root_folders();
    res.json({ folders: result.folders.map(f => ({ name: f.name, path: f.path })) });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Could not load folders' });
  }
});

// ─── API: ADMIN — list images in a Cloudinary folder ───
app.get('/api/cloudinary/images', adminAuth, async (req, res) => {
  try {
    const folder = req.query.folder;
    if (!folder) return res.status(400).json({ error: 'folder is required' });
    const result = await cloudinary.api.resources({
      type: 'upload',
      prefix: folder,
      max_results: 100,
    });
    const images = result.resources
      .filter(r => r.public_id.startsWith(folder + '/') || r.folder === folder)
      .map(r => ({ url: r.secure_url, publicId: r.public_id, createdAt: r.created_at }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ images });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Could not load images' });
  }
});

// ─── API: ADMIN — update a listing (approve, mark paid, set expiry, edit fields, reject) ───
app.patch('/api/contractors/:id', adminAuth, (req, res) => {
  const list = readContractors();
  const entry = list.find(c => c.id === req.params.id);
  if (!entry) return res.status(404).json({ error: 'Listing not found' });

  const allowed = ['businessName', 'ownerName', 'phone', 'whatsapp', 'serviceArea', 'specialties', 'yearsExperience', 'udyam', 'description', 'plan', 'status', 'paid', 'expiresAt', 'photos'];
  allowed.forEach(key => {
    if (req.body[key] !== undefined) entry[key] = req.body[key];
  });
  if (req.body.status === 'approved' && !entry.approvedAt) entry.approvedAt = new Date().toISOString();

  if (!writeContractors(list)) return res.status(500).json({ error: 'Save failed' });
  res.json({ success: true, contractor: entry });
});

// ─── API: ADMIN — delete a listing ───
app.delete('/api/contractors/:id', adminAuth, (req, res) => {
  const list = readContractors();
  const next = list.filter(c => c.id !== req.params.id);
  if (next.length === list.length) return res.status(404).json({ error: 'Listing not found' });
  if (!writeContractors(next)) return res.status(500).json({ error: 'Save failed' });
  res.json({ success: true });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════ LEADS (quote / site visit requests) ══════════════════════════════════════════════

// Shared spam checks for every public form.
//  - honeypot: a hidden field real visitors never fill
//  - time trap: the page sends when it was opened (_t); a form "filled" in under 3 seconds is a bot
//  - link count: genuine enquiries rarely contain more than one link; promotional spam usually does
// In every case we answer "success" so bots do not simply retry.
function looksLikeSpam(body, ...textFields) {
  if (body.website) return true;
  const t = Number(body._t);
  if (t && Date.now() - t < 3000) return true;
  const urls = textFields.join(' ').match(/https?:\/\/|www\./gi) || [];
  return urls.length > 2;
}
const clip = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const isEmail = (v) => /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(String(v || '').trim());
const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

const LEAD_TYPES = ['House Construction Enquiry', 'Paid Property Inspection', 'Cost Estimate', 'General Query'];

// Pipeline statuses (slug -> label shown in /admin). Older slugs are kept so existing leads still display.
const LEAD_STATUSES = ['new', 'under-review', 'qualified', 'payment-pending', 'inspection-confirmed', 'inspection-completed', 'quotation-sent', 'contract-awarded', 'closed',
  'contacted', 'site-visit-booked', 'won', 'lost'];
// Inspection payment is only ever set to 'verified' by an admin after checking the UPI/bank record. The public site cannot set it.
const PAYMENT_STATUSES = ['not-requested', 'details-shared', 'awaiting-payment', 'verified', 'not-received'];
const QUOTATION_STATUSES = ['not-started', 'in-preparation', 'sent', 'accepted', 'declined'];
const CONTRACT_STATUSES = ['none', 'discussion', 'agreement-sent', 'awarded', 'not-proceeding'];
const LEAD_STAGES = [
  'I own a plot and want to start construction',
  'I have purchased a property and need construction',
  'I am planning to purchase a plot',
  'I am evaluating a bank auction property',
  'I am only exploring construction prices',
];
const LEAD_PACKAGES = ['Comfortable', 'Better-Living', 'Dream Home', 'Not sure yet'];
const OWNERSHIP = ['I own the plot', 'Purchased, registration/khata in progress', 'Planning to purchase', 'Bank auction property', 'Other'];

// Optional new-enquiry alert. Set NOTIFY_WEBHOOK_URL to any endpoint that accepts a JSON POST
// (Slack/Discord/Make/Zapier) or NTFY_TOPIC for a free ntfy.sh push. Never blocks or fails the form.
function notifyNewLead(entry) {
  const text = 'New ' + entry.type + ': ' + entry.name + ', ' + entry.phone + ', ' + (entry.area || 'location not given') + (entry.stage ? ' (' + entry.stage + ')' : '');
  try {
    if (process.env.NOTIFY_WEBHOOK_URL) {
      fetch(process.env.NOTIFY_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, content: text }) }).catch(() => {});
    }
    if (process.env.NTFY_TOPIC) {
      fetch('https://ntfy.sh/' + encodeURIComponent(process.env.NTFY_TOPIC), { method: 'POST', body: text, headers: { Title: 'HoskoteConstruction enquiry' } }).catch(() => {});
    }
  } catch (e) { /* notification is best-effort */ }
}

// ─── API: SUBMIT LEAD (public) ───
// Customer enquiries only. Contractors and suppliers have their own forms and storage below.
app.post('/api/leads', formLimiter, (req, res) => {
  const body = req.body || {};
  const { name, phone, area, size, budget, message, floors, contactMethod, startDate, propertyType } = body;
  const type = LEAD_TYPES.includes(body.type) ? body.type : 'House Construction Enquiry';

  if (looksLikeSpam(body, message, area, size, name, body.auctionDetails)) return res.json({ success: true });

  if (!name || !String(name).trim() || !phone) {
    return res.status(400).json({ error: 'Name and phone are required' });
  }
  const cleanedPhone = cleanPhone(phone);
  if (!cleanedPhone) {
    return res.status(400).json({ error: 'Please enter a valid phone number' });
  }
  let cleanedWhatsapp = '';
  if (clip(body.whatsapp, 20)) {
    cleanedWhatsapp = cleanPhone(body.whatsapp);
    if (!cleanedWhatsapp) return res.status(400).json({ error: 'Please enter a valid WhatsApp number, or leave it blank if it is the same as your mobile number.' });
  }
  if (!clip(area, 120)) {
    return res.status(400).json({ error: 'Please tell us the location of your plot or property.' });
  }
  const stage = LEAD_STAGES.includes(body.stage) ? body.stage : '';
  const pkg = LEAD_PACKAGES.includes(body.package) ? body.package : '';
  const ownership = OWNERSHIP.includes(body.ownership) ? body.ownership : '';

  if (type === 'House Construction Enquiry') {
    if (!clip(body.plotDimensions, 60)) return res.status(400).json({ error: 'Please enter your plot dimensions, for example 30 x 40 ft.' });
    if (!ownership) return res.status(400).json({ error: 'Please choose your plot ownership status.' });
    if (!clip(size, 60)) return res.status(400).json({ error: 'Please enter the approximate construction (built-up) area.' });
    if (!clip(floors, 20)) return res.status(400).json({ error: 'Please choose the number of floors.' });
    if (!clip(startDate, 40)) return res.status(400).json({ error: 'Please tell us your expected construction start date.' });
    if (!pkg) return res.status(400).json({ error: 'Please choose the package you are considering.' });
    if (!clip(budget, 60)) return res.status(400).json({ error: 'Please enter your approximate budget.' });
    if (!stage) return res.status(400).json({ error: 'Please tell us what stage you are currently at.' });
    if (body.consent !== true) return res.status(400).json({ error: 'Please tick the consent box so we can contact you about this enquiry.' });
  }
  if (type === 'Paid Property Inspection') {
    if (!clip(propertyType, 60)) {
      return res.status(400).json({ error: 'Please choose the property type.' });
    }
    if (clip(body.plotDimensions, 60).length < 1) {
      return res.status(400).json({ error: 'Please enter the plot or property dimensions or size.' });
    }
    if (propertyType === 'Bank auction property' && clip(body.auctionDetails, 1500).length < 15) {
      return res.status(400).json({ error: 'For a bank auction property, please share the auction notice or property details (bank, reference, address) so our team can review them first.' });
    }
    if (body.acknowledged !== true) {
      return res.status(400).json({ error: 'Please confirm that you have read the inspection policy.' });
    }
    if (body.consent !== true) {
      return res.status(400).json({ error: 'Please tick the consent box so we can contact you about this request.' });
    }
  }

  const list = readLeads();
  const entry = {
    id: 'lead_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex'),
    name: clip(name, 80),
    phone: cleanedPhone,
    whatsapp: cleanedWhatsapp,
    area: clip(area, 120),
    plotDimensions: clip(body.plotDimensions, 60),
    ownership,
    size: clip(size, 60),
    floors: clip(floors, 20),
    budget: clip(budget, 60),
    package: pkg,
    stage,
    type,
    propertyType: clip(propertyType, 60),
    auctionDetails: clip(body.auctionDetails, 1500),
    acknowledgedInspectionPolicy: body.acknowledged === true,
    consentToContact: body.consent === true,
    contactMethod: clip(contactMethod, 20),
    startDate: clip(startDate, 40),
    message: clip(message, 1000),
    status: 'new',
    // Inspection payment: never marked verified from the public site. Admin sets it after checking the UPI/bank record.
    inspectionPaymentStatus: 'not-requested',
    paymentReference: '',
    paymentVerifiedAt: null,
    inspectionAppointment: '',
    quotationStatus: 'not-started',
    contractStatus: 'none',
    followUp: '',
    followUpDate: '',
    adminNotes: '',
    submittedAt: new Date().toISOString(),
  };
  list.push(entry);
  if (!writeLeads(list)) {
    return res.status(500).json({ error: 'Could not save — please try WhatsApp directly' });
  }
  notifyNewLead(entry);
  res.json({ success: true, id: entry.id });
});

// ─── API: ADMIN — full leads list ───
app.get('/api/leads', adminAuth, (req, res) => {
  const list = readLeads().sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  res.json({ leads: list });
});

// ─── API: ADMIN — update lead status ───
app.patch('/api/leads/:id', adminAuth, (req, res) => {
  const list = readLeads();
  const entry = list.find(l => l.id === req.params.id);
  if (!entry) return res.status(404).json({ error: 'Lead not found' });

  const b = req.body || {};
  const text = ['name', 'phone', 'area', 'size', 'floors', 'budget', 'type', 'contactMethod', 'startDate', 'message',
    'paymentReference', 'inspectionAppointment', 'followUp', 'followUpDate', 'adminNotes'];
  text.forEach(key => { if (b[key] !== undefined) entry[key] = clip(b[key], key === 'adminNotes' || key === 'message' ? 1500 : 200); });

  const enums = [['status', LEAD_STATUSES], ['inspectionPaymentStatus', PAYMENT_STATUSES], ['quotationStatus', QUOTATION_STATUSES], ['contractStatus', CONTRACT_STATUSES]];
  for (const [key, allowed] of enums) {
    if (b[key] === undefined) continue;
    if (!allowed.includes(b[key])) return res.status(400).json({ error: 'Invalid ' + key });
    entry[key] = b[key];
  }
  // Payment must be verified by a person: needs a reference, and a visit cannot be confirmed without it.
  if (b.inspectionPaymentStatus === 'verified') {
    if (!clip(entry.paymentReference, 200)) return res.status(400).json({ error: 'Enter the UPI/bank reference you checked before marking payment verified.' });
    entry.paymentVerifiedAt = new Date().toISOString();
  } else if (b.inspectionPaymentStatus !== undefined) {
    entry.paymentVerifiedAt = null;
  }
  if (b.status !== undefined && ['inspection-confirmed', 'inspection-completed', 'site-visit-booked'].includes(entry.status) && entry.type === 'Paid Property Inspection' && entry.inspectionPaymentStatus !== 'verified') {
    return res.status(400).json({ error: 'Cannot confirm an inspection until the inspection payment is marked verified.' });
  }

  if (!writeLeads(list)) return res.status(500).json({ error: 'Save failed' });
  res.json({ success: true, lead: entry });
});

// ─── API: ADMIN — delete a lead ───
app.delete('/api/leads/:id', adminAuth, (req, res) => {
  const list = readLeads();
  const next = list.filter(l => l.id !== req.params.id);
  if (next.length === list.length) return res.status(404).json({ error: 'Lead not found' });
  if (!writeLeads(next)) return res.status(500).json({ error: 'Save failed' });
  res.json({ success: true });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════

// ══════════════════ CONTRACTOR PARTNERSHIP + SUPPLIER REGISTRATIONS (separate from customer leads) ══════════════════

// Small JSON-file store, same approach as leads and contractor listings.
function makeStore(fileName) {
  const file = path.join(DATA_DIR, fileName);
  return {
    read() {
      try {
        if (!fs.existsSync(file)) return [];
        const raw = fs.readFileSync(file, 'utf8');
        return raw.trim() ? JSON.parse(raw) : [];
      } catch (err) { console.error('Failed to read ' + fileName, err); return []; }
    },
    write(list) {
      try {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        const tmp = file + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(list, null, 2));
        fs.renameSync(tmp, file);
        return true;
      } catch (err) { console.error('Failed to write ' + fileName, err); return false; }
    },
  };
}
const partnersStore = makeStore('partners.json');
const suppliersStore = makeStore('suppliers.json');

const PARTNER_STATUSES = ['new', 'reviewing', 'shortlisted', 'onboarded', 'declined'];
const SUPPLIER_STATUSES = ['new', 'reviewing', 'shortlisted', 'onboarded', 'declined'];
const SUPPLIER_MATERIALS = ['Cement', 'TMT steel', 'Plumbing pipes and fittings', 'Electrical materials', 'Gates and fabrication', 'Tiles', 'Paints', 'Doors and windows', 'Sand and aggregates', 'Blocks and construction materials'];

// ─── API: CONTRACTOR PARTNERSHIP APPLICATION (public) ───
app.post('/api/partners', formLimiter, (req, res) => {
  const b = req.body || {};
  if (looksLikeSpam(b, b.experience, b.projectTypes, b.businessName)) return res.json({ success: true });

  const businessName = clip(b.businessName, 120);
  const contactPerson = clip(b.contactPerson, 80);
  const phone = cleanPhone(b.phone);
  const email = clip(b.email, 120);
  const serviceAreas = clip(b.serviceAreas, 200);
  const experience = clip(b.experience, 1500);
  const years = Number(b.yearsExperience);

  if (!businessName || !contactPerson) return res.status(400).json({ error: 'Please enter your business name and your name.' });
  if (!phone) return res.status(400).json({ error: 'Please enter a valid phone number.' });
  if (email && !isEmail(email)) return res.status(400).json({ error: 'That email address does not look right.' });
  if (!serviceAreas) return res.status(400).json({ error: 'Please tell us the areas where you work.' });
  if (!Number.isFinite(years) || years < 0 || years > 60) return res.status(400).json({ error: 'Please enter your years of experience as a number.' });
  if (experience.length < 30) return res.status(400).json({ error: 'Please describe the residential projects you have completed (a few sentences).' });
  if (b.agreed !== true) return res.status(400).json({ error: 'Please confirm that you have read and accept how the programme works.' });

  const list = partnersStore.read();
  const entry = {
    id: 'ptr_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex'),
    businessName, contactPerson, phone, email, serviceAreas,
    yearsExperience: years,
    projectTypes: clip(b.projectTypes, 200),
    teamSize: clip(b.teamSize, 40),
    registration: clip(b.registration, 120),   // GST / UDYAM / licence, optional
    experience,
    agreedToProcess: true,
    status: 'new',
    submittedAt: new Date().toISOString(),
  };
  list.push(entry);
  if (!partnersStore.write(list)) return res.status(500).json({ error: 'Could not save your application. Please try again in a moment.' });
  res.json({ success: true, id: entry.id });
});

// ─── API: SUPPLIER REGISTRATION (public) ───
app.post('/api/suppliers', formLimiter, (req, res) => {
  const b = req.body || {};
  if (looksLikeSpam(b, b.catalogue, b.specifications, b.pricing, b.companyName)) return res.json({ success: true });

  const companyName = clip(b.companyName, 120);
  const contactPerson = clip(b.contactPerson, 80);
  const phone = cleanPhone(b.phone);
  const email = clip(b.email, 120);
  const materials = (Array.isArray(b.materials) ? b.materials : []).filter(m => SUPPLIER_MATERIALS.includes(m));
  const gstin = clip(b.gstin, 15).toUpperCase();
  const businessDetails = clip(b.businessDetails, 300);
  const catalogue = clip(b.catalogue, 600);

  if (!companyName || !contactPerson) return res.status(400).json({ error: 'Please enter your company name and contact person.' });
  if (!phone) return res.status(400).json({ error: 'Please enter a valid phone number.' });
  if (!isEmail(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
  if (!materials.length) return res.status(400).json({ error: 'Please choose at least one material category.' });
  if (!gstin && !businessDetails) return res.status(400).json({ error: 'Please give your GST number or other business registration details.' });
  if (gstin && !GSTIN_RE.test(gstin)) return res.status(400).json({ error: 'That GST number does not look right. It has 15 characters, for example 29ABCDE1234F1Z5.' });
  if (catalogue.length < 5) return res.status(400).json({ error: 'Please add a link to your product catalogue, or say that you will email it.' });
  if (!clip(b.pricing, 800)) return res.status(400).json({ error: 'Please share your pricing (or price list details).' });
  if (!clip(b.moq, 120)) return res.status(400).json({ error: 'Please enter your minimum order quantity.' });
  if (!clip(b.deliveryLocations, 300)) return res.status(400).json({ error: 'Please tell us the locations you deliver to.' });

  const list = suppliersStore.read();
  const entry = {
    id: 'sup_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex'),
    companyName, contactPerson, phone, email,
    city: clip(b.city, 80),
    materials,
    gstin, businessDetails, catalogue,
    specifications: clip(b.specifications, 1000),
    pricing: clip(b.pricing, 800),
    moq: clip(b.moq, 120),
    deliveryLocations: clip(b.deliveryLocations, 300),
    status: 'new',
    submittedAt: new Date().toISOString(),
  };
  list.push(entry);
  if (!suppliersStore.write(list)) return res.status(500).json({ error: 'Could not save your registration. Please try again in a moment.' });
  res.json({ success: true, id: entry.id });
});

// ─── ADMIN: list / update status / delete, for both stores ───
function registerAdminRoutes(base, store, statuses, editable) {
  app.get(base, adminAuth, (req, res) => {
    res.json({ items: store.read().sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)) });
  });
  app.patch(base + '/:id', adminAuth, (req, res) => {
    const list = store.read();
    const entry = list.find(x => x.id === req.params.id);
    if (!entry) return res.status(404).json({ error: 'Not found' });
    if (req.body.status !== undefined) {
      if (!statuses.includes(req.body.status)) return res.status(400).json({ error: 'Invalid status' });
      entry.status = req.body.status;
    }
    editable.forEach(k => { if (req.body[k] !== undefined) entry[k] = clip(req.body[k], 1000); });
    if (!store.write(list)) return res.status(500).json({ error: 'Save failed' });
    res.json({ success: true, item: entry });
  });
  app.delete(base + '/:id', adminAuth, (req, res) => {
    const list = store.read();
    const next = list.filter(x => x.id !== req.params.id);
    if (next.length === list.length) return res.status(404).json({ error: 'Not found' });
    if (!store.write(next)) return res.status(500).json({ error: 'Save failed' });
    res.json({ success: true });
  });
}
registerAdminRoutes('/api/partners', partnersStore, PARTNER_STATUSES, ['notes']);
registerAdminRoutes('/api/suppliers', suppliersStore, SUPPLIER_STATUSES, ['notes']);

// ══════════════════════════════════════════════════════════════════════════════════════════════

// ─── UPLOAD / BODY ERRORS: return clean JSON instead of a stack-trace page ───
app.use((err, req, res, next) => {
  if (!err) return next();
  if (err.name === 'MulterError') {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Photo is too large (max 8 MB each).'
      : (err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_FILE_COUNT') ? 'Too many photos (max 3).'
      : 'Upload failed.';
    return res.status(400).json({ error: msg });
  }
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request too large.' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid request.' });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong.' });
});

// ─── SERVE ADMIN PAGE ───
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ─── REDIRECT OLD SITEREADY URL ───
app.get('/siteready', (req, res) => {
  res.redirect(301, '/property-document-service-hoskote');
});

// ─── SERVE INDEX ───
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- 404 (after every real route) ---
app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

app.listen(PORT, () => {
  console.log(`HoskoteConstruction server running on port ${PORT}`);
});

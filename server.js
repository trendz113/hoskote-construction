require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── CLOUDINARY CONFIG ───
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ─── MIDDLEWARE ───
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

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
const CONTRACTORS_FILE = path.join(__dirname, 'data', 'contractors.json');

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
    fs.writeFileSync(CONTRACTORS_FILE, JSON.stringify(list, null, 2));
    return true;
  } catch (err) {
    console.error('Failed to write contractors.json', err);
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
function adminAuth(req, res, next) {
  const pass = req.headers['x-admin-password'] || req.query.password;
  if (pass !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ─── API: GET ALL PROJECTS WITH PHOTOS ───
app.get('/api/projects', async (req, res) => {
  try {
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
    res.json({ projects: projectsWithPhotos, stages: STAGES });
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
  res.json({ success: true, project });
});

// ─── API: VERIFY ADMIN ───
app.post('/api/admin/verify', (req, res) => {
  const { password } = req.body;
  if (password === process.env.ADMIN_PASSWORD) {
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Wrong password' });
  }
});

// ══════════════════════════════════════ CONTRACTOR LISTINGS ══════════════════════════════════════

// ─── API: UPLOAD APPLICATION PHOTOS (public — used during the apply form) ───
app.post('/api/contractors/upload-photos', uploadContractorPhotos.array('photos', 3), (req, res) => {
  if (!req.files || !req.files.length) return res.status(400).json({ error: 'No files uploaded' });
  res.json({
    success: true,
    photos: req.files.map(f => ({ url: f.path, publicId: f.filename })),
  });
});

// ─── API: SUBMIT APPLICATION (public) ───
app.post('/api/contractors/apply', (req, res) => {
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

// ─── API: ADMIN — update a listing (approve, mark paid, set expiry, edit fields, reject) ───
app.patch('/api/contractors/:id', adminAuth, (req, res) => {
  const list = readContractors();
  const entry = list.find(c => c.id === req.params.id);
  if (!entry) return res.status(404).json({ error: 'Listing not found' });

  const allowed = ['businessName', 'ownerName', 'phone', 'whatsapp', 'serviceArea', 'specialties', 'yearsExperience', 'udyam', 'description', 'plan', 'status', 'paid', 'expiresAt'];
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

// ─── SERVE ADMIN PAGE ───
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ─── SERVE INDEX ───
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`HoskoteConstruction server running on port ${PORT}`);
});

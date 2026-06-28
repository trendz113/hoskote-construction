require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const path = require('path');

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

// ─── SERVE ADMIN PAGE ───
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ─── SERVE DOCUMENTS GUIDE PAGE ───
app.get('/documents', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'documents.html'));
});

// ─── SERVE INDEX ───
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`HoskoteConstruction server running on port ${PORT}`);
});

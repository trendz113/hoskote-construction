# HoskoteConstruction

House construction website with live project photo tracking via Cloudinary.

## Stack
- **Backend**: Node.js + Express (Railway)
- **Photos**: Cloudinary
- **Frontend**: Vanilla HTML/CSS/JS
- **Admin**: Password-protected upload panel at `/admin`

## Project Structure
```
hoskote-construction/
├── server.js           ← Express API + Cloudinary routes
├── public/
│   ├── index.html      ← Main website (fetches projects from API)
│   └── admin.html      ← Admin upload panel
├── package.json
├── railway.toml
├── .env.example
└── .gitignore
```

## Deploy Steps

### 1. GitHub
```bash
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/YOUR_USERNAME/hoskote-construction.git
git push -u origin main
```

### 2. Railway
1. Go to railway.app → New Project → Deploy from GitHub
2. Select `hoskote-construction` repo
3. Add Environment Variables (Settings → Variables):

```
CLOUDINARY_CLOUD_NAME=dvjocpz8j
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
ADMIN_PASSWORD=your_admin_password
```

4. Railway auto-deploys. Get your domain from Settings → Networking → Generate Domain.

### 3. Upload First Photos
Go to `https://your-railway-url.railway.app/admin`
- Enter admin password
- Select project → Select stage → Upload photo

Photos appear on homepage automatically.

## API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/projects` | All projects with photos |
| GET | `/api/projects/:id` | Single project |
| POST | `/api/upload` | Upload photo (admin) |
| DELETE | `/api/photo` | Delete photo (admin) |
| PATCH | `/api/projects/:id` | Update project details (admin) |
| POST | `/api/admin/verify` | Verify admin password |

## Adding New Project
In `server.js`, add to the `PROJECTS` array:
```js
{
  id: 'project-hoskote-5',
  title: 'Hoskote Project 5',
  location: 'Area Name',
  status: 'ongoing', // or 'completed'
  sqft: null,
  cost: null,
  duration: null,
  bhk: null,
  floors: null,
}
```
Then redeploy. Upload photos via `/admin`.

## WhatsApp Number
Search for `XXXXXXXXXX` in `public/index.html` and replace with real number.

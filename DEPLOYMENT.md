# 🚀 Fresh Market - Deployment Guide

Follow these simple steps to make your app live on the internet!

## ✅ Prerequisites Check

You need these installed (the script will check for you):
- **Node.js** - Download from https://nodejs.org (choose LTS version)
- **Git** - Download from https://git-scm.com/download/win

---

## 📋 Step-by-Step Instructions

### Step 1: Run the Setup Script

1. Open PowerShell in this folder
2. Run:
   ```powershell
   .\deploy-setup.ps1
   ```

The script will:
- ✓ Check if Node.js and Git are installed
- ✓ Install dependencies
- ✓ Test the build
- ✓ Initialize Git
- ✓ Create first commit
- ✓ Open GitHub in your browser

---

### Step 2: Create GitHub Repository

The script will open this page: https://github.com/new

1. **Repository name:** `fresh-market-preorder`
2. **Visibility:** Choose **Public** ⭐
3. **DO NOT** check "Initialize this repository with README"
4. Click **"Create repository"**

You'll see a page with commands. **Copy the HTTPS URL** that looks like:
```
https://github.com/YOUR-USERNAME/fresh-market-preorder.git
```

---

### Step 3: Push Code to GitHub

Back in PowerShell, run these two commands (replace with your actual URL):

```powershell
git remote add origin https://github.com/YOUR-USERNAME/fresh-market-preorder.git
git push -u origin master
```

When prompted for credentials:
- **Username:** Your GitHub username
- **Password:** You need a **Personal Access Token** (not your password!)

#### How to get a Personal Access Token:
1. Go to: https://github.com/settings/tokens
2. Click **"Generate new token"** → **"Generate new token (classic)"**
3. Name it: `Fresh Market Deployment`
4. Check the **`repo`** scope
5. Click **"Generate token"**
6. **COPY THE TOKEN** (you'll only see it once!)
7. Paste it when PowerShell asks for password

---

### Step 4: Deploy to Netlify

1. Go to: https://app.netlify.com
2. Click **"Sign up"** → Choose **"Sign up with GitHub"**
3. Authorize Netlify

#### Create New Site:
1. Click **"New site from Git"**
2. Choose **GitHub**
3. Select your repository: `fresh-market-preorder`
4. **Build settings:**
   - Build command: `npm run build`
   - Publish directory: `dist`
5. Click **"Show advanced"** → **"New variable"**

#### Add Environment Variables (IMPORTANT!):

Add these TWO variables:

**Variable 1:**
- Key: `VITE_SUPABASE_URL`
- Value: `https://gkxiujmyfsdyxnwhgyzc.supabase.co`

**Variable 2:**
- Key: `VITE_SUPABASE_ANON_KEY`
- Value: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdreGl1am15ZnNkeXhud2hneXpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3NzU3MzUsImV4cCI6MjA4MjM1MTczNX0.oNv2crqvx94abVYFrNhnlQ_ACIdBe1UxMkIDHeBeH7U`

6. Click **"Deploy site"**

---

### Step 5: Get Your Live URL! 🎉

Netlify will build your site (takes 1-2 minutes).

Once done, you'll see a URL like:
```
https://sparkling-unicorn-123abc.netlify.app
```

**That's it!** Anyone can now open this URL and use your app!

---

## 🔄 Future Updates

When you want to update the live site:

```powershell
git add .
git commit -m "Updated features"
git push
```

Netlify will automatically rebuild and deploy! ✨

---

## ❓ Troubleshooting

### "Git not found"
Install from: https://git-scm.com/download/win

### "Node not found"
Install from: https://nodejs.org (LTS version)

### "Build failed in Netlify"
Make sure you added BOTH environment variables correctly in Netlify settings.

### "Can't push to GitHub"
Use a Personal Access Token, not your password (see Step 3 above).

---

## 📞 Need Help?

If stuck on any step, just let me know which step number and I'll guide you through it!

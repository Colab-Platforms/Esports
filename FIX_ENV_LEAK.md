# 🚨 URGENT: .env File Leaked to GitHub - Fix Guide

## Problem
Your `.env` file with sensitive credentials is on GitHub. This is a security risk!

## Immediate Actions Required

### Step 1: Remove .env from Git History
```bash
# Remove .env from git tracking
git rm --cached .env
git rm --cached client/.env

# Commit the removal
git commit -m "Remove .env files from repository"

# Push to GitHub
git push origin main
```

### Step 2: Remove from Git History (Complete Cleanup)
The file is still in git history. Use BFG Repo Cleaner:

```bash
# Option 1: Using git filter-branch (built-in)
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env client/.env" \
  --prune-empty --tag-name-filter cat -- --all

# Force push to rewrite history
git push origin --force --all
```

**OR**

```bash
# Option 2: Using BFG (easier, faster)
# Download from: https://rtyley.github.io/bfg-repo-cleaner/

# Run BFG
java -jar bfg.jar --delete-files .env

# Clean up
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push
git push origin --force --all
```

### Step 3: Verify .gitignore
Make sure `.env` is in `.gitignore`:

```
# .gitignore should have:
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
client/.env
server/.env
```

### Step 4: Rotate All Credentials
**IMPORTANT:** Change these immediately:

1. **MongoDB Password**
   - Go to MongoDB Atlas
   - Database Access → Edit User
   - Change password
   - Update in Railway/Vercel

2. **JWT Secret**
   - Generate new secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```
   - Update in Railway

3. **Steam API Key**
   - Go to: https://steamcommunity.com/dev/apikey
   - Revoke old key
   - Generate new key
   - Update in Railway

4. **Any Other API Keys**
   - Razorpay keys
   - Email credentials
   - etc.

### Step 5: Update Environment Variables

#### Railway (Backend)
1. Go to Railway Dashboard
2. Your Project → Variables
3. Update all credentials with new values

#### Vercel (Frontend)
1. Go to Vercel Dashboard
2. Your Project → Settings → Environment Variables
3. Update if any sensitive data was there

## Prevention Checklist

- [ ] `.env` removed from git
- [ ] `.env` in `.gitignore`
- [ ] Git history cleaned
- [ ] MongoDB password changed
- [ ] JWT secret regenerated
- [ ] Steam API key rotated
- [ ] Railway variables updated
- [ ] Verified `.env` not on GitHub

## Quick Commands

```bash
# 1. Remove from tracking
git rm --cached .env
git rm --cached client/.env

# 2. Commit
git commit -m "Remove sensitive .env files"

# 3. Push
git push origin main

# 4. Verify .gitignore has .env
cat .gitignore | grep .env

# 5. Check GitHub - .env should not be visible
```

## Why This Matters

Exposed credentials can lead to:
- ❌ Unauthorized database access
- ❌ API key abuse
- ❌ Account takeover
- ❌ Data theft
- ❌ Service disruption

## After Fixing

1. ✅ Verify `.env` not on GitHub
2. ✅ All credentials rotated
3. ✅ `.gitignore` properly configured
4. ✅ Railway/Vercel updated
5. ✅ Test application still works

## Going Forward

**NEVER commit:**
- `.env` files
- API keys
- Passwords
- Private keys
- Tokens

**ALWAYS use:**
- Environment variables in platforms
- `.env.example` for templates
- `.gitignore` for sensitive files

## Need Help?

If you're unsure about any step, ask before proceeding!

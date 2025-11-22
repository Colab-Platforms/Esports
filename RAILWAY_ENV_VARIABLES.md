# 🔑 Railway Environment Variables - Complete List

## Current Error
```
📍 MONGODB_URI: Missing
📍 JWT_SECRET: Missing
Error: `key_id` or `oauthToken` is mandatory
```

## Solution: Add Environment Variables in Railway

### Step 1: Go to Railway Variables

1. Railway Dashboard → Your Project
2. Click **Variables** tab
3. Click **+ New Variable** for each one below

### Step 2: Add These Variables

#### Required Variables (MUST ADD):

```env
PORT=5001
NODE_ENV=production
MONGODB_URI=mongodb+srv://colab_esports:7HgZ7ApfEPWrabx9@esports.zn4fbf9.mongodb.net/colab-esports
JWT_SECRET=colab-esports-super-secret-jwt-key-2024-production-ready
JWT_EXPIRE=7d
BCRYPT_ROUNDS=12
STEAM_API_KEY=78AC439C723DE55025FF959B863E4480
CLIENT_URL=https://your-app.vercel.app
SERVER_URL=${{RAILWAY_PUBLIC_DOMAIN}}
```

#### Optional Variables (For Razorpay - Can Skip for Now):

```env
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
```

**Note:** If you don't have Razorpay, leave these empty. The app will work without payment features.

### Step 3: How to Add in Railway

For each variable:

1. Click **+ New Variable**
2. **Variable Name:** (e.g., `MONGODB_URI`)
3. **Value:** (paste the value)
4. Click **Add**

Repeat for all variables.

### Step 4: Redeploy

After adding all variables:
1. Railway will auto-redeploy
2. OR click **Deployments** → **Redeploy**

---

## ⚠️ IMPORTANT: Use NEW Credentials

Since .env was exposed on GitHub, use NEW credentials:

### MongoDB Password (MUST CHANGE):
1. Go to: https://cloud.mongodb.com
2. Database Access → Edit User
3. Change password
4. Update `MONGODB_URI` with new password

### JWT Secret (MUST CHANGE):
Generate new secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
Use output as `JWT_SECRET`

### Steam API Key (MUST CHANGE):
1. Go to: https://steamcommunity.com/dev/apikey
2. Revoke old key
3. Generate new key
4. Use as `STEAM_API_KEY`

---

## 📋 Complete Variable List with Descriptions

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `PORT` | Yes | Server port | `5001` |
| `NODE_ENV` | Yes | Environment | `production` |
| `MONGODB_URI` | Yes | Database connection | `mongodb+srv://...` |
| `JWT_SECRET` | Yes | JWT signing key | `your-secret-key` |
| `JWT_EXPIRE` | Yes | JWT expiry | `7d` |
| `BCRYPT_ROUNDS` | Yes | Password hashing | `12` |
| `STEAM_API_KEY` | Yes | Steam OAuth | `your-steam-key` |
| `CLIENT_URL` | Yes | Frontend URL | `https://your-app.vercel.app` |
| `SERVER_URL` | Yes | Backend URL | `${{RAILWAY_PUBLIC_DOMAIN}}` |
| `RAZORPAY_KEY_ID` | No | Payment gateway | `rzp_test_...` |
| `RAZORPAY_KEY_SECRET` | No | Payment secret | `your-secret` |

---

## 🎯 Quick Copy-Paste (Update Values!)

```env
PORT=5001
NODE_ENV=production
MONGODB_URI=mongodb+srv://colab_esports:NEW_PASSWORD_HERE@esports.zn4fbf9.mongodb.net/colab-esports
JWT_SECRET=GENERATE_NEW_SECRET_HERE
JWT_EXPIRE=7d
BCRYPT_ROUNDS=12
STEAM_API_KEY=GET_NEW_KEY_HERE
CLIENT_URL=https://your-vercel-app.vercel.app
SERVER_URL=${{RAILWAY_PUBLIC_DOMAIN}}
```

---

## ✅ After Adding Variables

### Success Logs Will Show:
```
✅ 🔧 Environment Debug:
✅ 📍 PORT: 5001
✅ 📍 MONGODB_URI: Found
✅ 📍 JWT_SECRET: Found
✅ 🔗 Connecting to MongoDB...
✅ 🚀 Server running on port 5001
✅ 🎮 MongoDB connected successfully
```

### Current Error Logs:
```
❌ 📍 MONGODB_URI: Missing
❌ 📍 JWT_SECRET: Missing
❌ Error: `key_id` or `oauthToken` is mandatory
```

---

## 🔧 Troubleshooting

### Issue: Variables not showing up
**Solution:** Redeploy after adding variables

### Issue: MongoDB connection failed
**Solution:** 
1. Check MongoDB URI is correct
2. Ensure password is updated
3. Verify MongoDB Atlas allows Railway IP (0.0.0.0/0)

### Issue: Razorpay error still showing
**Solution:** 
- Add Razorpay keys
- OR comment out Razorpay code temporarily

---

## 📸 Railway Variables Screenshot Location

Variables tab is here:
```
Railway Dashboard
  → Your Project (web)
    → Variables (top menu)
      → + New Variable (button)
```

---

## 🚀 Next Steps

1. ✅ Add all environment variables in Railway
2. ✅ Use NEW credentials (rotated)
3. ✅ Wait for auto-redeploy
4. ✅ Check logs - should see success messages
5. ✅ Test API: `https://your-app.railway.app/api/games`
6. ✅ Deploy frontend on Vercel
7. ✅ Update CLIENT_URL in Railway
8. ✅ Done!

---

## 💡 Pro Tip

Use `${{RAILWAY_PUBLIC_DOMAIN}}` for `SERVER_URL` - Railway automatically fills this with your app's URL!

# CS2 Log Upload Cron Setup Guide

## Overview
This guide explains how to set up automatic log file uploads from your CS2 dedicated server (Hostinger Linux) to your Node.js backend.

---

## Part 1: CS2 Server Setup (Hostinger Linux)

### Step 1: Create Upload Script

SSH into your Hostinger CS2 server and create the upload script:

```bash
# Connect to your server via SSH
ssh your_username@your_server_ip

# Navigate to a suitable directory (e.g., home directory)
cd ~

# Create the upload script
nano cs2_log_upload.sh
```

### Step 2: Add Script Content

Paste this content into `cs2_log_upload.sh`:

```bash
#!/bin/bash

# Configuration
LOG_PATH="/home/amp/.ampdata/instances/ColabEsports0101/counter-strike2/730/game/csgo/logs"
SERVER_ID=1
BACKEND_URL="http://YOUR_BACKEND_URL/api/cs2/upload-log"  # Replace with your actual backend URL

# Get the latest log file
LATEST_LOG=$(ls -t $LOG_PATH 2>/dev/null | head -1)

# Check if log file exists
if [ -z "$LATEST_LOG" ]; then
    echo "[$(date)] No log files found in $LOG_PATH"
    exit 1
fi

FULL_PATH="$LOG_PATH/$LATEST_LOG"

# Upload the log file
echo "[$(date)] Uploading $LATEST_LOG to server $SERVER_ID..."
RESPONSE=$(curl -s -w "\n%{http_code}" -L -F "logfile=@$FULL_PATH" "$BACKEND_URL?server_id=$SERVER_ID")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 200 ]; then
    echo "[$(date)] ✅ Upload successful for server $SERVER_ID"
    echo "$BODY"
else
    echo "[$(date)] ❌ Upload failed with HTTP code: $HTTP_CODE"
    echo "$BODY"
fi
```

**Important:** Replace `YOUR_BACKEND_URL` with your actual backend URL:
- Local testing: `http://localhost:5001`
- Production: `http://your-domain.com` or `http://your-server-ip:5001`

Save and exit (Ctrl+X, then Y, then Enter)

### Step 3: Make Script Executable

```bash
chmod +x cs2_log_upload.sh
```

### Step 4: Test the Script Manually

```bash
./cs2_log_upload.sh
```

You should see output like:
```
[Date] Uploading 2025_11_14_044317.log to server 1...
[Date] ✅ Upload successful for server 1
```

### Step 5: Set Up Cron Job

Open crontab editor:

```bash
crontab -e
```

Add this line to run the script every 1 minute:

```bash
# Upload CS2 logs every 1 minute
* * * * * /home/YOUR_USERNAME/cs2_log_upload.sh >> /home/YOUR_USERNAME/cs2_upload.log 2>&1
```

**Replace `YOUR_USERNAME`** with your actual username.

This will:
- Run every minute (`* * * * *`)
- Execute the upload script
- Log output to `cs2_upload.log`

Save and exit (Ctrl+X, then Y, then Enter)

### Step 6: Verify Cron is Running

```bash
# Check if cron job is added
crontab -l

# Monitor the log file
tail -f ~/cs2_upload.log
```

---

## Part 2: Backend Server Setup (Your MERN App)

### Step 1: Start Your Backend Server

On your development machine (Windows):

```cmd
cd C:\Users\USER\Desktop\Esports
npm run server
```

Or for production:

```cmd
npm start
```

### Step 2: Verify Backend is Running

Open browser and check:
- Health check: `http://localhost:5001/api/cs2/health`

You should see:
```json
{
  "success": true,
  "message": "CS2 Log Processing API is running",
  "timestamp": "2024-11-15T..."
}
```

### Step 3: Check Server Status

```
GET http://localhost:5001/api/cs2/server-status/1
```

Response:
```json
{
  "success": true,
  "serverId": 1,
  "logFile": {
    "exists": true,
    "totalLines": 4063,
    "sizeKB": "125.45"
  },
  "checkpoint": {
    "lastProcessedLine": 4063,
    "pendingLines": 0
  },
  "status": "up-to-date"
}
```

---

## Part 3: Testing the Complete Flow

### Test 1: Manual Upload from CS2 Server

On your CS2 server (Linux):

```bash
cd /home/amp/.ampdata/instances/ColabEsports0101/counter-strike2/730/game/csgo/logs
ls -lh  # Check log files

# Upload manually using curl
curl -F "logfile=@latest_server_1.log" "http://YOUR_BACKEND_URL/api/cs2/upload-log?server_id=1"
```

### Test 2: Check Database

On your backend, check MongoDB:

```javascript
// In MongoDB Compass or shell
db.cs2_matches.find().limit(10)
```

You should see player data with:
- accountid
- kills, deaths, assists
- match_id, round_number
- map name

### Test 3: Monitor Logs

**CS2 Server:**
```bash
tail -f ~/cs2_upload.log
```

**Backend Server:**
Check console output for:
```
[CS2] Log file uploaded successfully for server 1
[CS2] Auto-triggering log processing for server 1...
[CS2] Processing from line 4064 to 4150
[CS2] 👤 Found player: AccountID=1927445380, Match #5, Round=3, K/D=2/1
[CS2] ✅ INSERTED: Player 1927445380, Match #5, Round 3, K/D: 2/1
```

---

## Part 4: Production Deployment

### Option A: Deploy Backend on Same Server (Hostinger)

If your backend is also on Hostinger:

```bash
# Update cron script with localhost
BACKEND_URL="http://localhost:5001/api/cs2/upload-log"
```

### Option B: Deploy Backend on Different Server

Update cron script with your backend URL:

```bash
# For Heroku
BACKEND_URL="https://your-app.herokuapp.com/api/cs2/upload-log"

# For Vercel/Netlify (need serverless functions)
BACKEND_URL="https://your-app.vercel.app/api/cs2/upload-log"

# For VPS with domain
BACKEND_URL="https://api.colabesports.in/api/cs2/upload-log"
```

---

## Part 5: Troubleshooting

### Issue 1: Cron Not Running

```bash
# Check cron service status
sudo service cron status

# Restart cron
sudo service cron restart

# Check cron logs
grep CRON /var/log/syslog
```

### Issue 2: Permission Denied

```bash
# Make sure script is executable
chmod +x ~/cs2_log_upload.sh

# Check log directory permissions
ls -la /home/amp/.ampdata/instances/ColabEsports0101/counter-strike2/730/game/csgo/logs
```

### Issue 3: Backend Not Receiving Files

```bash
# Test with curl directly
curl -v -F "logfile=@test.log" "http://YOUR_BACKEND_URL/api/cs2/upload-log?server_id=1"

# Check if backend is accessible
curl http://YOUR_BACKEND_URL/api/cs2/health
```

### Issue 4: Logs Not Processing

Check backend console for errors:
- MongoDB connection issues
- File permission issues
- Parsing errors

---

## Part 6: Monitoring & Maintenance

### View Upload Logs

```bash
# On CS2 server
tail -f ~/cs2_upload.log

# Last 50 lines
tail -50 ~/cs2_upload.log

# Search for errors
grep "❌" ~/cs2_upload.log
```

### Check Processing Status

```bash
# API call to check status
curl http://YOUR_BACKEND_URL/api/cs2/server-status/1
```

### Manual Processing Trigger

If automatic processing fails, trigger manually:

```bash
curl -X POST http://YOUR_BACKEND_URL/api/cs2/process-logs \
  -H "Content-Type: application/json" \
  -d '{"serverId": 1}'
```

---

## Part 7: Advanced Configuration

### Multiple CS2 Servers

If you have multiple CS2 servers:

```bash
# Server 1 cron (every 1 minute)
* * * * * /home/user/cs2_log_upload_server1.sh >> /home/user/cs2_upload_1.log 2>&1

# Server 2 cron (every 1 minute)
* * * * * /home/user/cs2_log_upload_server2.sh >> /home/user/cs2_upload_2.log 2>&1
```

Update each script with different `SERVER_ID`:
- Server 1: `SERVER_ID=1`
- Server 2: `SERVER_ID=2`

### Custom Upload Frequency

```bash
# Every 30 seconds (run twice per minute)
* * * * * /home/user/cs2_log_upload.sh >> /home/user/cs2_upload.log 2>&1
* * * * * sleep 30; /home/user/cs2_log_upload.sh >> /home/user/cs2_upload.log 2>&1

# Every 5 minutes
*/5 * * * * /home/user/cs2_log_upload.sh >> /home/user/cs2_upload.log 2>&1

# Every 10 minutes
*/10 * * * * /home/user/cs2_log_upload.sh >> /home/user/cs2_upload.log 2>&1
```

---

## Summary

✅ **CS2 Server (Linux):**
1. Create `cs2_log_upload.sh` script
2. Make it executable
3. Add to crontab (runs every minute)
4. Monitor with `tail -f ~/cs2_upload.log`

✅ **Backend Server (Node.js):**
1. Start server: `npm run server`
2. Verify health: `GET /api/cs2/health`
3. Check status: `GET /api/cs2/server-status/1`
4. Monitor console logs

✅ **Flow:**
```
CS2 Server → Cron (1 min) → Upload Script → Backend API → Process Logs → MongoDB
```

Your PHP system is now fully replaced with Node.js! 🎉

#!/bin/bash

# CS2 Multi-Server Cron Setup Script
echo "🚀 Setting up CS2 Multi-Server Cron Jobs..."

# Make scripts executable
echo "📝 Making scripts executable..."
chmod +x scripts/process_cs2_server1.js
chmod +x scripts/process_cs2_server2.js
chmod +x scripts/process_all_servers.js
chmod +x scripts/setup_cron.sh

# Create log directories
echo "📁 Creating log directories..."
sudo mkdir -p /var/log
sudo touch /var/log/cs2_server1_cron.log
sudo touch /var/log/cs2_server2_cron.log
sudo touch /var/log/cs2_all_servers_cron.log

# Set permissions for log files
echo "🔐 Setting log file permissions..."
sudo chown $USER:$USER /var/log/cs2_*_cron.log 2>/dev/null || echo "Note: Could not change log file ownership (may need sudo)"

# Create CS2 log files if they don't exist
echo "📄 Creating CS2 log files..."
mkdir -p server/logs
touch server/logs/latest_server1.log
touch server/logs/latest_server2.log

# Test scripts
echo "🧪 Testing scripts..."
echo "Testing Server 1 script..."
node scripts/process_cs2_server1.js

echo "Testing Server 2 script..."
node scripts/process_cs2_server2.js

# Display cron job options
echo ""
echo "✅ Setup complete! Now add cron jobs:"
echo ""
echo "📋 Option A: Individual Server Crons (Recommended)"
echo "Run: crontab -e"
echo "Add these lines:"
echo ""
echo "# Process Server 1 every 2 minutes"
echo "*/2 * * * * cd $(pwd) && node scripts/process_cs2_server1.js >> /var/log/cs2_server1_cron.log 2>&1"
echo ""
echo "# Process Server 2 every 2 minutes (offset by 1 minute)"
echo "1-59/2 * * * * cd $(pwd) && node scripts/process_cs2_server2.js >> /var/log/cs2_server2_cron.log 2>&1"
echo ""
echo "📋 Option B: Combined Processing"
echo "*/2 * * * * cd $(pwd) && node scripts/process_all_servers.js >> /var/log/cs2_all_servers_cron.log 2>&1"
echo ""
echo "🔍 Monitor logs with:"
echo "tail -f /var/log/cs2_server1_cron.log"
echo "tail -f /var/log/cs2_server2_cron.log"
echo ""
echo "🎯 Manual processing:"
echo "node scripts/process_cs2_server1.js"
echo "node scripts/process_cs2_server2.js"
echo "node scripts/process_all_servers.js"
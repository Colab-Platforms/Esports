// Add this to your old server's webhook route

const axios = require('axios');

// BGMI users set (maintain this list)
const bgmiUsers = new Set();

// Main webhook handler (replace your existing webhook)
app.post('/webhook', async (req, res) => {
  try {
    console.log('📱 Webhook received');
    const body = req.body;
    
    // Check if this is a BGMI related message
    if (await isBGMIMessage(body)) {
      console.log('🎮 BGMI message detected - forwarding to new server');
      
      // Forward to BGMI server
      try {
        await axios.post('https://your-bgmi-server.com/api/whatsapp/webhook', body, {
          headers: { 
            'Content-Type': 'application/json',
            'X-Forwarded-From': 'old-server' // Optional: track forwarded messages
          },
          timeout: 5000
        });
        console.log('✅ Successfully forwarded to BGMI server');
      } catch (forwardError) {
        console.error('❌ Failed to forward to BGMI server:', forwardError.message);
        // Fallback: handle in old server or send error message
      }
    } else {
      console.log('📱 Regular message - handling in old server');
      
      // Your existing old server logic here
      await handleOldServerLogic(body);
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(500).send('ERROR');
  }
});

// Function to detect BGMI messages
async function isBGMIMessage(body) {
  const messages = body.entry?.[0]?.changes?.[0]?.value?.messages;
  if (!messages) return false;
  
  const message = messages[0];
  const from = message.from;
  const shortPhone = from.slice(-10);
  
  // Method 1: Check if user is in BGMI users list
  if (bgmiUsers.has(shortPhone)) {
    return true;
  }
  
  // Method 2: Check message content for BGMI keywords
  if (message.text?.body) {
    const text = message.text.body.toLowerCase();
    const bgmiKeywords = [
      'bgmi', 'tournament', 'team registration', 'verification', 
      'battlegrounds', 'pubg', 'squad', 'esports'
    ];
    
    const hasBGMIKeyword = bgmiKeywords.some(keyword => text.includes(keyword));
    if (hasBGMIKeyword) {
      // Add user to BGMI list for future messages
      bgmiUsers.add(shortPhone);
      return true;
    }
  }
  
  // Method 3: Check if user recently registered for BGMI
  // You can check your database here
  try {
    const response = await axios.get(`https://your-bgmi-server.com/api/check-bgmi-user/${shortPhone}`, {
      timeout: 2000
    });
    
    if (response.data.isBGMIUser) {
      bgmiUsers.add(shortPhone);
      return true;
    }
  } catch (error) {
    // If BGMI server is down, fallback to old server
    console.log('BGMI server check failed, handling in old server');
  }
  
  return false;
}

// API to add BGMI user (call this when someone registers)
app.post('/api/add-bgmi-user', (req, res) => {
  const { phone } = req.body;
  if (phone) {
    bgmiUsers.add(phone.toString());
    console.log(`✅ Added BGMI user: ${phone}`);
    res.json({ success: true, message: 'User added to BGMI list' });
  } else {
    res.status(400).json({ success: false, message: 'Phone number required' });
  }
});

// API to remove BGMI user
app.post('/api/remove-bgmi-user', (req, res) => {
  const { phone } = req.body;
  if (phone) {
    bgmiUsers.delete(phone.toString());
    console.log(`🗑️ Removed BGMI user: ${phone}`);
    res.json({ success: true, message: 'User removed from BGMI list' });
  } else {
    res.status(400).json({ success: false, message: 'Phone number required' });
  }
});

// API to get BGMI users list
app.get('/api/bgmi-users', (req, res) => {
  res.json({ 
    success: true, 
    users: Array.from(bgmiUsers),
    count: bgmiUsers.size
  });
});

// Your existing old server logic
async function handleOldServerLogic(body) {
  // Put your existing webhook logic here
  console.log('Handling in old server...');
}
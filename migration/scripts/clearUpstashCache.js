require('dotenv').config();

async function clearCache() {
  try {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      console.error('❌ Upstash Redis credentials not found in .env');
      process.exit(1);
    }

    console.log('🔍 Connecting to Upstash Redis...');

    // Get all keys matching tournaments:*
    const keysResponse = await fetch(`${url}/keys/tournaments:*`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!keysResponse.ok) {
      console.error('❌ Failed to fetch keys:', keysResponse.statusText);
      process.exit(1);
    }

    const keysData = await keysResponse.json();
    const keys = keysData.result || [];

    console.log(`\n🔍 Found ${keys.length} tournament cache keys`);

    if (keys.length > 0) {
      // Delete each key
      for (const key of keys) {
        const deleteResponse = await fetch(`${url}/del/${key}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (deleteResponse.ok) {
          console.log(`✅ Deleted: ${key}`);
        }
      }
    }

    // Also try to delete general tournament cache
    const generalDeleteResponse = await fetch(`${url}/del/tournaments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (generalDeleteResponse.ok) {
      console.log('✅ Cleared general tournament cache');
    }

    console.log('\n✅ Cache cleared successfully!');
    console.log('🔄 Frontend will now fetch fresh tournament data from MongoDB');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

clearCache();

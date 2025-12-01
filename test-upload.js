const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

async function testUpload() {
  try {
    // Create a simple test file
    const testImagePath = 'test-image.txt';
    fs.writeFileSync(testImagePath, 'test image content');

    const formData = new FormData();
    formData.append('image', fs.createReadStream(testImagePath));

    const response = await axios.post(
      'http://localhost:5001/api/upload/image',
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'Authorization': 'Bearer YOUR_TOKEN_HERE'
        }
      }
    );

    console.log('✅ Upload successful:', response.data);
    
    // Cleanup
    fs.unlinkSync(testImagePath);
  } catch (error) {
    console.error('❌ Upload failed:');
    console.error('Status:', error.response?.status);
    console.error('Message:', error.response?.data || error.message);
  }
}

testUpload();

const axios = require('axios');

const OCR_BASE_URL = process.env.PYTHON_OCR_SERVICE_URL || 'http://localhost:8000';

const processFreeFireScoreboardImage = async ({ imageUrl }) => {
  const response = await axios.post(
    `${OCR_BASE_URL}/process-scoreboard-image`,
    {
      image_url: imageUrl,
      game_type: 'freefire'
    },
    { timeout: 60000 }
  );
  return response.data;
};

module.exports = {
  processFreeFireScoreboardImage
};

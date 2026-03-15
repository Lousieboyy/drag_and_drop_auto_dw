const express = require('express');
const cors = require('cors');
const axios = require('axios');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const DATASET_DIR = 'C:\\Users\\User\\smart_city_citizen_reporting_app\\ai_backend\\ai_data';
const PUBLIC_DIR = path.join(__dirname, 'public');

// Ensure dataset directory exists
if (!fs.existsSync(DATASET_DIR)) {
  fs.mkdirSync(DATASET_DIR, { recursive: true });
}

app.use(cors());
app.use(express.json());

// Serve static frontend files
if (fs.existsSync(PUBLIC_DIR)) {
  app.use(express.static(PUBLIC_DIR));
}

app.post('/api/save-image', async (req, res) => {
  const { url, folder } = req.body || {};

  if (!url || typeof url !== 'string' || !url.trim()) {
    return res.status(400).json({
      success: false,
      error: 'Invalid request: "url" is required.',
    });
  }

  // Sanitize optional folder name (subdirectory under dataset)
  let targetDir = DATASET_DIR;
  let targetFolder = '';
  if (folder && typeof folder === 'string' && folder.trim()) {
    const raw = folder.trim();
    const safe = raw.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 64) || 'default';
    targetFolder = safe;
    targetDir = path.join(DATASET_DIR, safe);
    try {
      await fs.promises.mkdir(targetDir, { recursive: true });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: 'Failed to prepare target folder on server.',
      });
    }
  }

  let imageBuffer;
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      // Allow most image content-types; validation is done by sharp later
      validateStatus: (status) => status >= 200 && status < 400,
    });
    imageBuffer = Buffer.from(response.data);
  } catch (err) {
    return res.status(502).json({
      success: false,
      error: 'Failed to download image from the provided URL.',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }

  const filename = `image-${Date.now()}-${Math.floor(Math.random() * 1e6)}.png`;
  const filePath = path.join(targetDir, filename);

  try {
    const pngBuffer = await sharp(imageBuffer).png().toBuffer();
    await fs.promises.writeFile(filePath, pngBuffer);
  } catch (err) {
    return res.status(415).json({
      success: false,
      error: 'Downloaded file is not a valid or supported image.',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }

  return res.json({
    success: true,
    filename,
    folder: targetFolder || null,
  });
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});


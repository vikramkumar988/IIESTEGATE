const sharp = require('sharp');

/**
 * Process an uploaded image file (from multer memory storage):
 * - Resize to max 400px width (preserving aspect ratio)
 * - Convert to JPEG at 70% quality
 * - Return as a base64 data URI string
 *
 * This produces ~20-60KB strings that are safe to store in PostgreSQL TEXT columns.
 * Photos persist across Render redeploys since they live in the database, not on disk.
 */
async function processAndEncodeImage(fileBuffer, mimetype) {
  try {
    const compressed = await sharp(fileBuffer)
      .resize({ width: 400, withoutEnlargement: true })
      .jpeg({ quality: 70 })
      .toBuffer();

    const base64 = compressed.toString('base64');
    return `data:image/jpeg;base64,${base64}`;
  } catch (error) {
    console.log('Image processing error (falling back to raw base64):', error.message);
    // Fallback: store original as base64 without compression
    const base64 = fileBuffer.toString('base64');
    return `data:${mimetype || 'image/jpeg'};base64,${base64}`;
  }
}

module.exports = { processAndEncodeImage };

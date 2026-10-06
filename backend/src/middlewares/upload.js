const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const env = require('../lib/env');
const { ApiError } = require('../lib/errors');

/** Extensões aceitas -> mime (PowerPoint + imagens). */
const EXT = {
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  avif: 'image/avif',
};

const IMG_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp', 'avif']);
// Fotos públicas do anúncio: sem SVG/BMP (SVG pode carregar scripts).
const FOTO_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif']);

const DESTINO = path.join(env.UPLOAD_DIR, 'arquivos');
fs.mkdirSync(DESTINO, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, DESTINO),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, '') || '.bin';
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
  },
});

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
  if (file.fieldname === 'fotos' && !FOTO_EXT.has(ext)) {
    return cb(ApiError.badRequest('As fotos do anúncio devem ser .jpg, .jpeg, .png, .webp, .gif ou .avif.'));
  }
  if (!EXT[ext]) {
    return cb(
      ApiError.badRequest(
        `Arquivo .${ext || 'sem extensão'} não é permitido. Envie PowerPoint (.ppt, .pptx) ou imagens (.jpg, .jpeg, .png, .webp, .gif, .svg, .bmp, .avif).`
      )
    );
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: env.UPLOAD_MAX_SIZE_MB * 1024 * 1024,
    files: 30,
  },
});

/** Publicação: arquivos entregues ao cliente + fotos do anúncio. */
const uploadMaterial = upload.fields([
  { name: 'arquivos', maxCount: 20 },
  { name: 'fotos', maxCount: 10 },
]);

/** Apenas fotos (adicionar fotos a um material já publicado). */
const uploadFotos = upload.array('fotos', 10);

module.exports = { upload, uploadMaterial, uploadFotos, EXT, IMG_EXT, FOTO_EXT };

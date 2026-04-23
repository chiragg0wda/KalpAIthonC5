const fetch = require('node-fetch');

const VALID_MATERIALS = ['plastic', 'metal', 'paper', 'general'];

async function classifyWaste(base64Image) {
  if (!base64Image || typeof base64Image !== 'string' || base64Image.length < 100) {
    console.log('[AI] No valid image, defaulting to general');
    return 'general';
  }
  const prompt = `Look at this image of waste or garbage placed in a bin.
Classify it into exactly one of these four categories:
- plastic (bottles, bags, plastic containers, packaging, wrappers)
- metal (cans, tins, aluminium foil, metal objects)
- paper (cardboard, newspapers, books, paper bags, cartons)
- general (food waste, mixed waste, unidentifiable, anything else)
Reply with exactly one word in lowercase only. No punctuation. No explanation.`;

  try {
    const response = await fetch(`${process.env.OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llava', prompt, images: [base64Image], stream: false }),
      timeout: 12000
    });
    if (!response.ok) throw new Error(`Ollama HTTP ${response.status}`);
    const data = await response.json();
    const raw = (data.response || '').trim().toLowerCase().replace(/[^a-z]/g, '');
    if (VALID_MATERIALS.includes(raw)) { console.log('[AI] Classified:', raw); return raw; }
    for (const mat of VALID_MATERIALS) { if (raw.includes(mat)) return mat; }
    console.log('[AI] Unknown response, defaulting to general');
    return 'general';
  } catch (err) {
    console.error('[AI] Failed (using general):', err.message);
    return 'general';
  }
}

module.exports = { classifyWaste };

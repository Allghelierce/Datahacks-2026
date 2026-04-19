const fs = require('fs');
const https = require('https');
const path = require('path');

const MASTER_SPECIES_PATH = 'frontend/src/lib/masterSpecies.json';
const OUTPUT_PATH = 'frontend/public/data/species-photos.json';

if (!fs.existsSync(MASTER_SPECIES_PATH)) {
  console.error('masterSpecies.json not found. Run process_data.py first.');
  process.exit(1);
}

const masterSpecies = JSON.parse(fs.readFileSync(MASTER_SPECIES_PATH, 'utf8'));
const speciesNames = Object.keys(masterSpecies);

function fetchJSON(url, retryCount = 0) {
  return new Promise((resolve, reject) => {
    https.get(url, { 
      headers: { 'User-Agent': 'BioScope/1.0' },
      timeout: 10000 
    }, (res) => {
      if (res.statusCode === 429) {
        return reject({ code: 429, message: 'Too Many Requests' });
      }
      
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { 
          const parsed = JSON.parse(data);
          resolve(parsed); 
        } catch (e) { 
          reject(new Error(`Parse error: ${data.slice(0, 100)}...`)); 
        }
      });
    }).on('error', (err) => {
      reject(err);
    }).on('timeout', () => {
      reject(new Error('Request Timeout'));
    });
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  let photos = {};
  if (fs.existsSync(OUTPUT_PATH)) {
    try { photos = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8')); }
    catch (e) { console.warn('Could not read existing photos.'); }
  }

  let found = 0;
  let skipped = 0;
  let errors = 0;

  console.log(`Expansion starting: 0/${speciesNames.length} species checked`);

  for (let i = 0; i < speciesNames.length; i++) {
    const name = speciesNames[i];
    
    if (photos[name] !== undefined && photos[name] !== null) {
      skipped++;
      found++;
      continue;
    }

    const url = `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(name)}&per_page=1`;
    let attempts = 0;
    let success = false;

    while (attempts < 3 && !success) {
      try {
        const data = await fetchJSON(url);
        success = true;
        if (data.results && data.results.length > 0) {
          const taxon = data.results[0];
          if (taxon.default_photo && (taxon.default_photo.square_url || taxon.default_photo.url)) {
            let photoUrl = taxon.default_photo.medium_url || taxon.default_photo.url || taxon.default_photo.square_url;
            photoUrl = photoUrl.replace('/square', '/medium'); // Upgrade if needed
            photos[name] = photoUrl;
            found++;
            console.log(`[${i + 1}/${speciesNames.length}] ${name} -> OK`);
          } else {
            photos[name] = null;
          }
        } else {
          photos[name] = null;
        }
      } catch (e) {
        attempts++;
        if (e.code === 429 || attempts < 3) {
          const wait = e.code === 429 ? 5000 * attempts : 1000 * attempts;
          console.warn(`[${i + 1}/${speciesNames.length}] ${name} -> Retrying (${attempts}/3) in ${wait}ms...`);
          await sleep(wait);
        } else {
          console.error(`[${i + 1}/${speciesNames.length}] ${name} -> Final Error: ${e.message}`);
          errors++;
        }
      }
    }

    // Moderate rate limit for success
    await sleep(200);
    
    if (i % 10 === 0) {
      fs.writeFileSync(OUTPUT_PATH, JSON.stringify(photos, null, 2));
    }
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(photos, null, 2));
  console.log(`\nExpansion Complete:`);
  console.log(`  - Total: ${speciesNames.length}`);
  console.log(`  - Found: ${found}`);
  console.log(`  - Skipped (Cache): ${skipped}`);
  console.log(`  - Errors: ${errors}`);
}

main().catch(console.error);

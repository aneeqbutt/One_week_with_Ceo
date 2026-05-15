import fs from 'fs';
import path from 'path';

const modPath = path.resolve('./dist/services/Codegenerator.js');
(async () => {
  try {
    const codegen = await import(modPath);
    const sample = fs.readFileSync(path.resolve('./scripts/sample_gpt_response.txt'), 'utf8');
    const files = codegen.parseCodeResponse(sample, 'xiaohongshu-profile-scraper');
    console.log('\n=== Parsed files ===');
    files.forEach((f, i) => {
      console.log(i + 1, f.filepath, 'len=', (f.code || '').length, 'strategy=', f.strategy);
    });

    // write outputs to temp folder for inspection
    const outBase = path.resolve('./generated-test-output');
    for (const f of files) {
      const target = path.resolve(outBase, f.filepath.replace(/^[\\/]+/, ''));
      await fs.promises.mkdir(path.dirname(target), { recursive: true });
      await fs.promises.writeFile(target, f.code || '', 'utf8');
    }
    console.log('\nWrote parsed files to', outBase);
  } catch (e) {
    console.error('ERROR running test:', e);
    process.exit(1);
  }
})();

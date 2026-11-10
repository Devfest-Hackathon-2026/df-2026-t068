import {readFile} from 'node:fs/promises';
import {calibrate} from './calibration.ts';
try {
  if (!process.argv[2]) throw Error('Usage: npm run calibrate -- judgments.json');
  const {analysis,judgments}=JSON.parse(await readFile(process.argv[2],'utf8'));
  if (!analysis || !Array.isArray(judgments) || !judgments.length) throw Error('Provide analysis and nonempty judgments');
  process.stdout.write(JSON.stringify(calibrate(analysis,judgments),null,2)+'\n');
} catch(error) { console.error(error instanceof Error?error.message:'Invalid input');process.exitCode=1; }

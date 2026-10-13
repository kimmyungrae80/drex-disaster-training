import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {createScenarioEngine} from './scenario-core.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const ontologyRoot = path.resolve(here, '..');

const readJSON = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const core = readJSON(path.join(ontologyRoot, 'data', 'core-knowledge.v0.1.jsonld'));
const defaultSeed = readJSON(path.join(ontologyRoot, 'data', 'seoul-urban-flood.seed.json'));
export const {generateScenario,validateScenario}=createScenarioEngine(core,defaultSeed);

function parseCLI(argv) {
  const options = {};
  for (let i=2;i<argv.length;i++) {
    if (argv[i]==='--level') options.level=argv[++i];
    else if (argv[i]==='--seed') options.randomSeed=argv[++i];
    else if (argv[i]==='--output') options.output=argv[++i];
  }
  return options;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const options = parseCLI(process.argv);
  const scenario = generateScenario(options);
  const json = JSON.stringify(scenario, null, 2);
  if (options.output) fs.writeFileSync(path.resolve(options.output), json + '\n');
  else process.stdout.write(json + '\n');
  if (!scenario.validation.valid) process.exitCode = 1;
}


import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(__dirname, '..');
const WORKSPACE_ROOT = resolve(PACKAGE_ROOT, '../..');
const SPEC_PATH = resolve(WORKSPACE_ROOT, 'specs/datto-rmm-openapi.json');
const OUTPUT_DIR = resolve(PACKAGE_ROOT, 'src/generated');
const OUTPUT_PATH = resolve(OUTPUT_DIR, 'types.ts');

console.log('Generating TypeScript types from OpenAPI spec...');
console.log(`  Spec: ${SPEC_PATH}`);
console.log(`  Output: ${OUTPUT_PATH}`);

// Check spec exists
if (!existsSync(SPEC_PATH)) {
  console.error(`Error: OpenAPI spec not found at ${SPEC_PATH}`);
  console.error('Run "pnpm sync:openapi" first to fetch the spec.');
  process.exit(1);
}

// Ensure output directory exists
if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Filter out deprecated operations from the spec
console.log('Filtering deprecated operations...');
const spec = JSON.parse(readFileSync(SPEC_PATH, 'utf-8'));
let deprecatedCount = 0;
const pathsToRemove: string[] = [];

for (const [path, pathItem] of Object.entries(spec.paths)) {
  for (const [method, operation] of Object.entries(pathItem)) {
    if (method !== 'parameters' && operation?.deprecated === true) {
      console.log(`  Excluding deprecated: ${method.toUpperCase()} ${path}`);
      delete pathItem[method];
      deprecatedCount++;
    }
  }

  // Remove path entirely if it has no operations left (only 'parameters' or empty)
  const hasOperations = Object.keys(pathItem).some(key => key !== 'parameters');
  if (!hasOperations) {
    pathsToRemove.push(path);
  }
}

// Remove empty paths
for (const path of pathsToRemove) {
  delete spec.paths[path];
}

console.log(`Filtered ${deprecatedCount} deprecated operation(s)${pathsToRemove.length > 0 ? ` and removed ${pathsToRemove.length} empty path(s)` : ''}`);

// Write filtered spec to temporary file
const tempSpecPath = resolve(OUTPUT_DIR, '.temp-spec.json');
writeFileSync(tempSpecPath, JSON.stringify(spec, null, 2));

// Run openapi-typescript
try {
  execSync(`npx openapi-typescript "${tempSpecPath}" -o "${OUTPUT_PATH}"`, {
    stdio: 'inherit',
    cwd: PACKAGE_ROOT,
  });
  console.log('\nTypes generated successfully!');
} catch (error) {
  console.error('Failed to generate types:', error);
  process.exit(1);
} finally {
  // Clean up temp file
  if (existsSync(tempSpecPath)) {
    unlinkSync(tempSpecPath);
  }
}

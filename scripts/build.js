import { execSync } from 'child_process';

const args = process.argv.slice(2);
let mode = 'dev'; // Default to dev

// 1. Check process arguments (e.g. from npm run build -- --staging or npm run build:staging)
if (args.includes('--staging')) {
  mode = 'staging';
} else if (args.includes('--prod')) {
  mode = 'prod';
} else if (args.includes('--dev')) {
  mode = 'dev';
}
// 2. Check npm-specific configuration environment variables as fallback
else if (process.env.npm_config_staging) {
  mode = 'staging';
} else if (process.env.npm_config_prod || process.env.npm_config_production) {
  mode = 'prod';
} else if (process.env.npm_config_dev) {
  mode = 'dev';
}

console.log(`\nBuilding for flavor: ${mode}...\n`);

try {
  // Execute typescript check and vite build with the resolved mode
  execSync(`npx tsc && npx vite build --mode ${mode}`, { stdio: 'inherit' });
  console.log(`\n✓ Build for flavor "${mode}" completed successfully!\n`);
} catch (error) {
  console.error(`\n✗ Build for flavor "${mode}" failed.\n`);
  process.exit(1);
}


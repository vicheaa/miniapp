import { execSync } from 'child_process';

const majorNodeVersion = parseInt(process.versions.node.split('.')[0], 10);
if (majorNodeVersion < 20) {
  console.error(`\n⚠️  Current Node version is v${process.versions.node}. Vite 6/8 requires Node 20+ or 24+.\nPlease run:\n  nvm use 24\nor\n  nvm use\nbefore building.\n`);
}

const args = process.argv.slice(2);
let mode = 'prod'; // Default to prod


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
  // Automatically update production deployment zip package
  execSync(`cd dist && tar -a -c -f ../miniapp.zip *`, { stdio: 'inherit' });
  console.log(`\n✓ Build & zip package for flavor "${mode}" completed successfully!\n`);
} catch (error) {
  console.error(`\n✗ Build for flavor "${mode}" failed.\n`);
  process.exit(1);
}

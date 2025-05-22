/**
 * This script ensures TypeScript imports are properly converted to JavaScript imports
 * with the correct file extensions after compilation.
 */

import { readFileSync, writeFileSync, readdirSync, Dirent } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get current directory
const __filename: string = fileURLToPath(import.meta.url);
const __dirname: string = dirname(__filename);
const distDir: string = join(__dirname, '..', 'dist');

/**
 * Process a JavaScript file to ensure imports have the correct extension
 */
function processFile(filePath: string): void {
  try {
    let content: string = readFileSync(filePath, 'utf8');
    
    // Fix TypeScript imports that are missing .js extension
    content = content.replace(
      /from\s+["']([^"']+)["']/g,
      (match: string, importPath: string): string => {
        // Skip external modules and imports that already have extensions
        if (importPath.startsWith('.') && !importPath.endsWith('.js')) {
          return `from "${importPath}.js"`;
        }
        return match;
      }
    );
    
    writeFileSync(filePath, content, 'utf8');
    console.log(`✓ Fixed imports in ${filePath}`);
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
  }
}

/**
 * Recursively process all JavaScript files in a directory
 */
function processDirectory(dir: string): void {
  const files: Dirent[] = readdirSync(dir, { withFileTypes: true });
  
  for (const file of files) {
    const path: string = join(dir, file.name);
    
    if (file.isDirectory()) {
      processDirectory(path);
    } else if (file.name.endsWith('.js')) {
      processFile(path);
    }
  }
}

// Start processing from the dist directory
console.log('Fixing import paths in compiled JavaScript files...');
processDirectory(distDir);
console.log('Import paths fixed successfully!'); 
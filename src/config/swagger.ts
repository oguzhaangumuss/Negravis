import swaggerJSDoc from 'swagger-jsdoc';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: '0G Compute Network API with Hedera Mirror Node Integration',
      version: '1.0.0',
      description: 'API for the 0G Compute Network with integrated Hedera Mirror Node endpoints',
    },
    servers: [
      {
        url: 'http://localhost:4000',
        description: 'Development server',
      },
    ],
  },
  apis: ['./src/routes/*.ts', './src/controllers/*.ts'],
};

const baseSpec = swaggerJSDoc(options) as any;

// Try to load and merge Hedera OpenAPI spec
let finalSpec = baseSpec;
try {
  const hederaSpecPath = path.join(__dirname, '../../openapi.yaml');
  if (fs.existsSync(hederaSpecPath)) {
    const hederaSpecContent = fs.readFileSync(hederaSpecPath, 'utf8');
    const hederaSpec = yaml.load(hederaSpecContent) as any;
    
    if (hederaSpec && hederaSpec.paths) {
      // Transform Hedera paths to be prefixed with /hedera
      const hederaPaths: any = {};
      Object.keys(hederaSpec.paths).forEach(path => {
        const newPath = `/hedera${path}`;
        hederaPaths[newPath] = {
          ...hederaSpec.paths[path]
        };
        
        // Add Hedera tag to all operations
        Object.keys(hederaPaths[newPath]).forEach(method => {
          if (hederaPaths[newPath][method].tags) {
            hederaPaths[newPath][method].tags.push('Hedera Mirror Node');
          } else {
            hederaPaths[newPath][method].tags = ['Hedera Mirror Node'];
          }
        });
      });

      // Create merged specification
      finalSpec = {
        ...baseSpec,
        paths: {
          ...(baseSpec.paths || {}),
          ...hederaPaths
        },
        components: {
          ...(baseSpec.components || {}),
          schemas: {
            ...(baseSpec.components?.schemas || {}),
            ...(hederaSpec.components?.schemas || {})
          },
          parameters: {
            ...(baseSpec.components?.parameters || {}),
            ...(hederaSpec.components?.parameters || {})
          },
          responses: {
            ...(baseSpec.components?.responses || {}),
            ...(hederaSpec.components?.responses || {})
          }
        }
      };
    }
  }
} catch (error) {
  console.warn('Could not load Hedera OpenAPI spec:', error);
}

export default finalSpec;
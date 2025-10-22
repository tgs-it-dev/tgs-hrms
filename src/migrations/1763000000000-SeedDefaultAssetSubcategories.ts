import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedDefaultAssetSubcategories1763000000000 implements MigrationInterface {
  name = 'SeedDefaultAssetSubcategories1763000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Get all existing tenants
    const tenants = await queryRunner.query('SELECT id FROM tenants');
    
    // Default asset subcategories data
    const defaultSubcategories = [
      // IT Equipment
      { category: 'IT Equipment', name: 'Laptop', description: 'Portable computers for work' },
      { category: 'IT Equipment', name: 'Desktop', description: 'Desktop computers' },
      { category: 'IT Equipment', name: 'Monitor', description: 'Computer displays' },
      { category: 'IT Equipment', name: 'Keyboard', description: 'Computer keyboards' },
      { category: 'IT Equipment', name: 'Mouse', description: 'Computer mice' },
      { category: 'IT Equipment', name: 'Docking Station', description: 'Laptop docking stations' },
      { category: 'IT Equipment', name: 'Headphones', description: 'Audio headsets' },
      { category: 'IT Equipment', name: 'Microphone', description: 'Audio recording devices' },
      { category: 'IT Equipment', name: 'Webcam', description: 'Video cameras for meetings' },
      { category: 'IT Equipment', name: 'Printer', description: 'Printing devices' },
      { category: 'IT Equipment', name: 'Scanner', description: 'Document scanning devices' },
      { category: 'IT Equipment', name: 'Projector', description: 'Presentation projectors' },
      { category: 'IT Equipment', name: 'Display Screen', description: 'Large display screens' },
      { category: 'IT Equipment', name: 'Tablet', description: 'Tablet computers' },
      { category: 'IT Equipment', name: 'iPad', description: 'Apple iPad devices' },
      { category: 'IT Equipment', name: 'Router', description: 'Network routers' },
      { category: 'IT Equipment', name: 'Switch', description: 'Network switches' },
      { category: 'IT Equipment', name: 'Access Point', description: 'WiFi access points' },

      // Software & Licenses
      { category: 'Software & Licenses', name: 'Windows License', description: 'Microsoft Windows operating system' },
      { category: 'Software & Licenses', name: 'macOS License', description: 'Apple macOS operating system' },
      { category: 'Software & Licenses', name: 'Linux License', description: 'Linux operating system' },
      { category: 'Software & Licenses', name: 'Microsoft Office', description: 'Microsoft Office suite' },
      { category: 'Software & Licenses', name: 'Google Workspace', description: 'Google productivity suite' },
      { category: 'Software & Licenses', name: 'Notion', description: 'Notion workspace' },
      { category: 'Software & Licenses', name: 'Slack', description: 'Slack workspace' },
      { category: 'Software & Licenses', name: 'Figma', description: 'Design software' },
      { category: 'Software & Licenses', name: 'Adobe Suite', description: 'Adobe Creative Suite' },
      { category: 'Software & Licenses', name: 'Sketch', description: 'Design software' },
      { category: 'Software & Licenses', name: 'GitHub', description: 'Code repository service' },
      { category: 'Software & Licenses', name: 'JetBrains', description: 'Development tools' },
      { category: 'Software & Licenses', name: 'Visual Studio', description: 'Microsoft development environment' },
      { category: 'Software & Licenses', name: 'Postman', description: 'API development tools' },
      { category: 'Software & Licenses', name: 'AWS Credits', description: 'Amazon Web Services' },
      { category: 'Software & Licenses', name: 'Azure Credits', description: 'Microsoft Azure' },
      { category: 'Software & Licenses', name: 'GCP Credits', description: 'Google Cloud Platform' },
      { category: 'Software & Licenses', name: 'Antivirus', description: 'Security software' },

      // Office Equipment
      { category: 'Office Equipment', name: 'Office Chair', description: 'Ergonomic office chairs' },
      { category: 'Office Equipment', name: 'Desk', description: 'Work desks' },
      { category: 'Office Equipment', name: 'Monitor Stand', description: 'Monitor mounting stands' },
      { category: 'Office Equipment', name: 'Whiteboard', description: 'Writing boards' },
      { category: 'Office Equipment', name: 'Stationery Set', description: 'Basic office supplies' },
      { category: 'Office Equipment', name: 'Filing Cabinet', description: 'Document storage' },
      { category: 'Office Equipment', name: 'Desk Lamp', description: 'Office lighting' },
      { category: 'Office Equipment', name: 'Bookshelf', description: 'Storage shelves' },

      // Mobility / Transport
      { category: 'Mobility / Transport', name: 'Company Car', description: 'Company vehicles' },
      { category: 'Mobility / Transport', name: 'Company Bike', description: 'Company bicycles' },
      { category: 'Mobility / Transport', name: 'Fuel Card', description: 'Fuel payment cards' },
      { category: 'Mobility / Transport', name: 'Transport Pass', description: 'Public transport passes' },
      { category: 'Mobility / Transport', name: 'GPS Device', description: 'Navigation devices' },

      // Employee Accessories
      { category: 'Employee Accessories', name: 'ID Card', description: 'Employee identification' },
      { category: 'Employee Accessories', name: 'Access Badge', description: 'Security access cards' },
      { category: 'Employee Accessories', name: 'Company Uniform', description: 'Work uniforms' },
      { category: 'Employee Accessories', name: 'Safety Gear', description: 'Safety equipment' },
      { category: 'Employee Accessories', name: 'Power Bank', description: 'Portable chargers' },
      { category: 'Employee Accessories', name: 'USB Cable', description: 'Charging cables' },
      { category: 'Employee Accessories', name: 'USB Drive', description: 'Portable storage' },

      // Facility Assets
      { category: 'Facility Assets', name: 'Air Conditioner', description: 'Climate control units' },
      { category: 'Facility Assets', name: 'Heater', description: 'Heating units' },
      { category: 'Facility Assets', name: 'CCTV Camera', description: 'Security cameras' },
      { category: 'Facility Assets', name: 'Biometric Device', description: 'Biometric scanners' },
      { category: 'Facility Assets', name: 'UPS', description: 'Uninterruptible power supply' },
      { category: 'Facility Assets', name: 'Power Unit', description: 'Power distribution units' },
      { category: 'Facility Assets', name: 'Office Furniture Set', description: 'Complete furniture sets' },

      // Health & Safety
      { category: 'Health & Safety', name: 'First Aid Kit', description: 'Medical emergency supplies' },
      { category: 'Health & Safety', name: 'Safety Helmet', description: 'Head protection' },
      { category: 'Health & Safety', name: 'Safety Gloves', description: 'Hand protection' },
      { category: 'Health & Safety', name: 'Safety Vest', description: 'High visibility clothing' },
      { category: 'Health & Safety', name: 'Fire Extinguisher', description: 'Fire safety equipment' },
      { category: 'Health & Safety', name: 'Medical Kit', description: 'Medical supplies' },

      // Miscellaneous / Custom
      { category: 'Miscellaneous / Custom', name: 'Promotional Materials', description: 'Marketing materials' },
      { category: 'Miscellaneous / Custom', name: 'Event Equipment', description: 'Event supplies' },
      { category: 'Miscellaneous / Custom', name: 'Training Devices', description: 'Training equipment' },
    ];

    // Insert subcategories for each tenant
    for (const tenant of tenants) {
      for (const subcategory of defaultSubcategories) {
        await queryRunner.query(
          `INSERT INTO asset_subcategories (id, name, category, description, tenant_id, created_at) 
           VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW())`,
          [subcategory.name, subcategory.category, subcategory.description, tenant.id]
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove all default subcategories
    await queryRunner.query(`
      DELETE FROM asset_subcategories 
      WHERE category IN (
        'IT Equipment', 
        'Software & Licenses', 
        'Office Equipment', 
        'Mobility / Transport', 
        'Employee Accessories', 
        'Facility Assets', 
        'Health & Safety', 
        'Miscellaneous / Custom'
      )
    `);
  }
}

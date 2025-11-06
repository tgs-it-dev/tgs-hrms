import { MigrationInterface, QueryRunner } from 'typeorm';

export class NormalizeAssetCategories1767000000000 implements MigrationInterface {
  name = 'NormalizeAssetCategories1767000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const GLOBAL = '00000000-0000-0000-0000-000000000000';

    // Step 1: Create asset_categories table
    await queryRunner.query(`
      CREATE TABLE "asset_categories" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" varchar NOT NULL,
        "description" text,
        "icon" varchar,
        "tenant_id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_asset_categories_id" PRIMARY KEY ("id")
      )
    `);

    // Create index for tenant_id
    await queryRunner.query(`
      CREATE INDEX "IDX_asset_categories_tenant" ON "asset_categories" ("tenant_id")
    `);

    // Create unique constraint for name + tenant_id
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_asset_categories_unique" ON "asset_categories" ("name", "tenant_id")
    `);

    // Add foreign key to tenants
    await queryRunner.query(`
      ALTER TABLE "asset_categories"
      ADD CONSTRAINT "FK_asset_categories_tenant"
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    // Step 2: Create categories ONLY for GLOBAL tenant
    // Get all unique categories from all subcategories (to create global categories)
    const allCategories = await queryRunner.query(`
      SELECT DISTINCT category 
      FROM asset_subcategories
      ORDER BY category
    `);

    // Insert categories ONLY for GLOBAL tenant
    // All tenants will reference these global categories
    for (const cat of allCategories) {
      await queryRunner.query(
        `INSERT INTO asset_categories (id, name, tenant_id, created_at)
         VALUES (gen_random_uuid(), $1, $2, NOW())
         ON CONFLICT (name, tenant_id) DO NOTHING`,
        [cat.category, GLOBAL]
      );
    }

    // Step 3: Add category_id to asset_subcategories and migrate data
    await queryRunner.query(`
      ALTER TABLE "asset_subcategories" 
      ADD COLUMN "category_id" uuid
    `);

    // Migrate category strings to category_id
    // Map all subcategories to GLOBAL categories by name (regardless of tenant_id)
    // This ensures all tenants use global categories
    await queryRunner.query(`
      UPDATE asset_subcategories s
      SET category_id = c.id
      FROM asset_categories c
      WHERE s.category = c.name 
      AND c.tenant_id = $1
    `, [GLOBAL]);

    // Make category_id NOT NULL after migration
    await queryRunner.query(`
      ALTER TABLE "asset_subcategories"
      ALTER COLUMN "category_id" SET NOT NULL
    `);

    // Add foreign key for subcategories category
    await queryRunner.query(`
      ALTER TABLE "asset_subcategories"
      ADD CONSTRAINT "FK_subcategories_category"
      FOREIGN KEY ("category_id") REFERENCES "asset_categories"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    // Drop old unique constraint (name, category, tenant_id)
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_asset_subcategories_unique"
    `);

    // Drop old category column
    await queryRunner.query(`
      ALTER TABLE "asset_subcategories"
      DROP COLUMN "category"
    `);

    // Create new unique constraint (name, category_id, tenant_id)
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_asset_subcategories_unique" ON "asset_subcategories" ("name", "category_id", "tenant_id")
    `);

    // Step 4: Add category_id to assets table
    await queryRunner.query(`
      ALTER TABLE "assets"
      ADD COLUMN "category_id" uuid
    `);

    // Get all unique categories from assets that don't exist in GLOBAL categories yet
    const assetCategories = await queryRunner.query(`
      SELECT DISTINCT a.category
      FROM assets a
      WHERE a.category IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM asset_categories ac 
        WHERE ac.name = a.category 
        AND ac.tenant_id = $1
      )
      ORDER BY a.category
    `, [GLOBAL]);

    // Create missing categories ONLY for GLOBAL tenant
    for (const cat of assetCategories) {
      await queryRunner.query(
        `INSERT INTO asset_categories (id, name, tenant_id, created_at)
         VALUES (gen_random_uuid(), $1, $2, NOW())
         ON CONFLICT (name, tenant_id) DO NOTHING`,
        [cat.category, GLOBAL]
      );
    }

    // Migrate category strings to category_id in assets
    // Map all assets to GLOBAL categories by name
    await queryRunner.query(`
      UPDATE assets a
      SET category_id = c.id
      FROM asset_categories c
      WHERE a.category = c.name
      AND c.tenant_id = $1
    `, [GLOBAL]);

    // Add foreign key for assets category
    await queryRunner.query(`
      ALTER TABLE "assets"
      ADD CONSTRAINT "FK_assets_category"
      FOREIGN KEY ("category_id") REFERENCES "asset_categories"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    // Drop old category column from assets
    await queryRunner.query(`
      ALTER TABLE "assets"
      DROP COLUMN "category"
    `);

    // Step 5: Add category_id to asset_requests table
    await queryRunner.query(`
      ALTER TABLE "asset_requests"
      ADD COLUMN "category_id" uuid
    `);

    // Get all unique categories from asset_requests that don't exist in GLOBAL categories yet
    const requestCategories = await queryRunner.query(`
      SELECT DISTINCT ar.asset_category
      FROM asset_requests ar
      WHERE ar.asset_category IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM asset_categories ac 
        WHERE ac.name = ar.asset_category 
        AND ac.tenant_id = $1
      )
      ORDER BY ar.asset_category
    `, [GLOBAL]);

    // Create missing categories ONLY for GLOBAL tenant
    for (const cat of requestCategories) {
      await queryRunner.query(
        `INSERT INTO asset_categories (id, name, tenant_id, created_at)
         VALUES (gen_random_uuid(), $1, $2, NOW())
         ON CONFLICT (name, tenant_id) DO NOTHING`,
        [cat.asset_category, GLOBAL]
      );
    }

    // Migrate asset_category strings to category_id in asset_requests
    // Map all requests to GLOBAL categories by name
    await queryRunner.query(`
      UPDATE asset_requests ar
      SET category_id = c.id
      FROM asset_categories c
      WHERE ar.asset_category = c.name
      AND c.tenant_id = $1
    `, [GLOBAL]);

    // Check if there are any remaining NULL category_id values
    const nullCount = await queryRunner.query(`
      SELECT COUNT(*) as count 
      FROM asset_requests 
      WHERE category_id IS NULL
    `);

    if (parseInt(nullCount[0].count, 10) > 0) {
      // If there are still NULL values, create "Other" category for GLOBAL tenant
      // Create "Other" category if it doesn't exist (GLOBAL tenant only)
      await queryRunner.query(
        `INSERT INTO asset_categories (id, name, description, tenant_id, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, NOW())
         ON CONFLICT (name, tenant_id) DO NOTHING`,
        ['Other', 'Uncategorized assets', GLOBAL]
      );

      // Get the "Other" category ID (GLOBAL tenant)
      const otherCategory = await queryRunner.query(
        `SELECT id FROM asset_categories WHERE name = $1 AND tenant_id = $2`,
        ['Other', GLOBAL]
      );

      if (otherCategory.length > 0) {
        // Update NULL category_id to "Other" (GLOBAL category)
        await queryRunner.query(
          `UPDATE asset_requests 
           SET category_id = $1 
           WHERE category_id IS NULL`,
          [otherCategory[0].id]
        );
      }
    }

    // Make category_id NOT NULL after migration
    await queryRunner.query(`
      ALTER TABLE "asset_requests"
      ALTER COLUMN "category_id" SET NOT NULL
    `);

    // Add foreign key for asset_requests category
    await queryRunner.query(`
      ALTER TABLE "asset_requests"
      ADD CONSTRAINT "FK_asset_requests_category"
      FOREIGN KEY ("category_id") REFERENCES "asset_categories"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // Drop old asset_category column
    await queryRunner.query(`
      ALTER TABLE "asset_requests"
      DROP COLUMN "asset_category"
    `);

    // Step 6: Seed default categories and subcategories for GLOBAL tenant only
    // Existing tenants already have their categories/subcategories migrated from Step 2
    // Only GLOBAL tenant (00000000-0000-0000-0000-000000000000) gets default seed
    // Future tenants will get defaults when they are created (via application logic)
    // Default categories data
    const defaultCategories = [
      { name: 'IT Equipment', description: 'IT equipment and devices' },
      { name: 'Software & Licenses', description: 'Software licenses and subscriptions' },
      { name: 'Office Equipment', description: 'Office furniture and equipment' },
      { name: 'Mobility / Transport', description: 'Transportation and mobility assets' },
      { name: 'Employee Accessories', description: 'Employee accessories and supplies' },
      { name: 'Facility Assets', description: 'Facility and building assets' },
      { name: 'Health & Safety', description: 'Health and safety equipment' },
      { name: 'Miscellaneous / Custom', description: 'Miscellaneous and custom assets' },
    ];

    // Default subcategories data with category mapping
    const defaultSubcategories = [
      // IT Equipment
      { categoryName: 'IT Equipment', name: 'Laptop', description: 'Portable computers for work' },
      { categoryName: 'IT Equipment', name: 'Desktop', description: 'Desktop computers' },
      { categoryName: 'IT Equipment', name: 'Monitor', description: 'Computer displays' },
      { categoryName: 'IT Equipment', name: 'Keyboard', description: 'Computer keyboards' },
      { categoryName: 'IT Equipment', name: 'Mouse', description: 'Computer mice' },
      { categoryName: 'IT Equipment', name: 'Docking Station', description: 'Laptop docking stations' },
      { categoryName: 'IT Equipment', name: 'Headphones', description: 'Audio headsets' },
      { categoryName: 'IT Equipment', name: 'Microphone', description: 'Audio recording devices' },
      { categoryName: 'IT Equipment', name: 'Webcam', description: 'Video cameras for meetings' },
      { categoryName: 'IT Equipment', name: 'Printer', description: 'Printing devices' },
      { categoryName: 'IT Equipment', name: 'Scanner', description: 'Document scanning devices' },
      { categoryName: 'IT Equipment', name: 'Projector', description: 'Presentation projectors' },
      { categoryName: 'IT Equipment', name: 'Display Screen', description: 'Large display screens' },
      { categoryName: 'IT Equipment', name: 'Tablet', description: 'Tablet computers' },
      { categoryName: 'IT Equipment', name: 'iPad', description: 'Apple iPad devices' },
      { categoryName: 'IT Equipment', name: 'Router', description: 'Network routers' },
      { categoryName: 'IT Equipment', name: 'Switch', description: 'Network switches' },
      { categoryName: 'IT Equipment', name: 'Access Point', description: 'WiFi access points' },

      // Software & Licenses
      { categoryName: 'Software & Licenses', name: 'Windows License', description: 'Microsoft Windows operating system' },
      { categoryName: 'Software & Licenses', name: 'macOS License', description: 'Apple macOS operating system' },
      { categoryName: 'Software & Licenses', name: 'Linux License', description: 'Linux operating system' },
      { categoryName: 'Software & Licenses', name: 'Microsoft Office', description: 'Microsoft Office suite' },
      { categoryName: 'Software & Licenses', name: 'Google Workspace', description: 'Google productivity suite' },
      { categoryName: 'Software & Licenses', name: 'Notion', description: 'Notion workspace' },
      { categoryName: 'Software & Licenses', name: 'Slack', description: 'Slack workspace' },
      { categoryName: 'Software & Licenses', name: 'Figma', description: 'Design software' },
      { categoryName: 'Software & Licenses', name: 'Adobe Suite', description: 'Adobe Creative Suite' },
      { categoryName: 'Software & Licenses', name: 'Sketch', description: 'Design software' },
      { categoryName: 'Software & Licenses', name: 'GitHub', description: 'Code repository service' },
      { categoryName: 'Software & Licenses', name: 'JetBrains', description: 'Development tools' },
      { categoryName: 'Software & Licenses', name: 'Visual Studio', description: 'Microsoft development environment' },
      { categoryName: 'Software & Licenses', name: 'Postman', description: 'API development tools' },
      { categoryName: 'Software & Licenses', name: 'AWS Credits', description: 'Amazon Web Services' },
      { categoryName: 'Software & Licenses', name: 'Azure Credits', description: 'Microsoft Azure' },
      { categoryName: 'Software & Licenses', name: 'GCP Credits', description: 'Google Cloud Platform' },
      { categoryName: 'Software & Licenses', name: 'Antivirus', description: 'Security software' },

      // Office Equipment
      { categoryName: 'Office Equipment', name: 'Office Chair', description: 'Ergonomic office chairs' },
      { categoryName: 'Office Equipment', name: 'Desk', description: 'Work desks' },
      { categoryName: 'Office Equipment', name: 'Monitor Stand', description: 'Monitor mounting stands' },
      { categoryName: 'Office Equipment', name: 'Whiteboard', description: 'Writing boards' },
      { categoryName: 'Office Equipment', name: 'Stationery Set', description: 'Basic office supplies' },
      { categoryName: 'Office Equipment', name: 'Filing Cabinet', description: 'Document storage' },
      { categoryName: 'Office Equipment', name: 'Desk Lamp', description: 'Office lighting' },
      { categoryName: 'Office Equipment', name: 'Bookshelf', description: 'Storage shelves' },

      // Mobility / Transport
      { categoryName: 'Mobility / Transport', name: 'Company Car', description: 'Company vehicles' },
      { categoryName: 'Mobility / Transport', name: 'Company Bike', description: 'Company bicycles' },
      { categoryName: 'Mobility / Transport', name: 'Fuel Card', description: 'Fuel payment cards' },
      { categoryName: 'Mobility / Transport', name: 'Transport Pass', description: 'Public transport passes' },
      { categoryName: 'Mobility / Transport', name: 'GPS Device', description: 'Navigation devices' },

      // Employee Accessories
      { categoryName: 'Employee Accessories', name: 'ID Card', description: 'Employee identification' },
      { categoryName: 'Employee Accessories', name: 'Access Badge', description: 'Security access cards' },
      { categoryName: 'Employee Accessories', name: 'Company Uniform', description: 'Work uniforms' },
      { categoryName: 'Employee Accessories', name: 'Safety Gear', description: 'Safety equipment' },
      { categoryName: 'Employee Accessories', name: 'Power Bank', description: 'Portable chargers' },
      { categoryName: 'Employee Accessories', name: 'USB Cable', description: 'Charging cables' },
      { categoryName: 'Employee Accessories', name: 'USB Drive', description: 'Portable storage' },

      // Facility Assets
      { categoryName: 'Facility Assets', name: 'Air Conditioner', description: 'Climate control units' },
      { categoryName: 'Facility Assets', name: 'Heater', description: 'Heating units' },
      { categoryName: 'Facility Assets', name: 'CCTV Camera', description: 'Security cameras' },
      { categoryName: 'Facility Assets', name: 'Biometric Device', description: 'Biometric scanners' },
      { categoryName: 'Facility Assets', name: 'UPS', description: 'Uninterruptible power supply' },
      { categoryName: 'Facility Assets', name: 'Power Unit', description: 'Power distribution units' },
      { categoryName: 'Facility Assets', name: 'Office Furniture Set', description: 'Complete furniture sets' },

      // Health & Safety
      { categoryName: 'Health & Safety', name: 'First Aid Kit', description: 'Medical emergency supplies' },
      { categoryName: 'Health & Safety', name: 'Safety Helmet', description: 'Head protection' },
      { categoryName: 'Health & Safety', name: 'Safety Gloves', description: 'Hand protection' },
      { categoryName: 'Health & Safety', name: 'Safety Vest', description: 'High visibility clothing' },
      { categoryName: 'Health & Safety', name: 'Fire Extinguisher', description: 'Fire safety equipment' },
      { categoryName: 'Health & Safety', name: 'Medical Kit', description: 'Medical supplies' },

      // Miscellaneous / Custom
      { categoryName: 'Miscellaneous / Custom', name: 'Promotional Materials', description: 'Marketing materials' },
      { categoryName: 'Miscellaneous / Custom', name: 'Event Equipment', description: 'Event supplies' },
      { categoryName: 'Miscellaneous / Custom', name: 'Training Devices', description: 'Training equipment' },
    ];

    // Seed default categories and subcategories for GLOBAL tenant only
    // Existing tenants will keep their existing data from Step 2 migration
    // Only GLOBAL tenant gets default seed
    const GLOBAL_TENANT_ID = '00000000-0000-0000-0000-000000000000';

    // Seed default categories for GLOBAL tenant only
    for (const category of defaultCategories) {
      await queryRunner.query(
        `INSERT INTO asset_categories (id, name, description, tenant_id, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, NOW())
         ON CONFLICT (name, tenant_id) DO NOTHING`,
        [category.name, category.description, GLOBAL_TENANT_ID]
      );
    }

    // Seed default subcategories for GLOBAL tenant only
    // Get category IDs for GLOBAL tenant
    const categoryMap = new Map<string, string>();
    for (const category of defaultCategories) {
      const result = await queryRunner.query(
        `SELECT id FROM asset_categories WHERE name = $1 AND tenant_id = $2`,
        [category.name, GLOBAL_TENANT_ID]
      );
      if (result.length > 0) {
        categoryMap.set(category.name, result[0].id);
      }
    }

    // Insert subcategories for GLOBAL tenant
    for (const subcategory of defaultSubcategories) {
      const categoryId = categoryMap.get(subcategory.categoryName);
      if (!categoryId) {
        console.warn(`Category not found for GLOBAL tenant: ${subcategory.categoryName}`);
        continue;
      }

      await queryRunner.query(
        `INSERT INTO asset_subcategories (id, name, category_id, description, tenant_id, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW())
         ON CONFLICT (name, category_id, tenant_id) DO NOTHING`,
        [subcategory.name, categoryId, subcategory.description, GLOBAL_TENANT_ID]
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Step 1: Add back category columns with string type
    await queryRunner.query(`
      ALTER TABLE "asset_subcategories"
      ADD COLUMN "category" varchar
    `);

    await queryRunner.query(`
      ALTER TABLE "assets"
      ADD COLUMN "category" varchar
    `);

    await queryRunner.query(`
      ALTER TABLE "asset_requests"
      ADD COLUMN "asset_category" varchar
    `);

    // Step 2: Migrate category names back from categories table
    await queryRunner.query(`
      UPDATE asset_subcategories s
      SET category = c.name
      FROM asset_categories c
      WHERE s.category_id = c.id
    `);

    await queryRunner.query(`
      UPDATE assets a
      SET category = c.name
      FROM asset_categories c
      WHERE a.category_id = c.id
    `);

    await queryRunner.query(`
      UPDATE asset_requests ar
      SET asset_category = c.name
      FROM asset_categories c
      WHERE ar.category_id = c.id
    `);

    // Step 3: Drop foreign keys and category_id columns
    await queryRunner.query(`
      ALTER TABLE "asset_requests"
      DROP CONSTRAINT IF EXISTS "FK_asset_requests_category"
    `);

    await queryRunner.query(`
      ALTER TABLE "asset_requests"
      DROP COLUMN "category_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "asset_requests"
      ALTER COLUMN "asset_category" SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "assets"
      DROP CONSTRAINT IF EXISTS "FK_assets_category"
    `);

    await queryRunner.query(`
      ALTER TABLE "assets"
      DROP COLUMN "category_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "assets"
      ALTER COLUMN "category" SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "asset_subcategories"
      DROP CONSTRAINT IF EXISTS "FK_subcategories_category"
    `);

    await queryRunner.query(`
      ALTER TABLE "asset_subcategories"
      DROP COLUMN "category_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "asset_subcategories"
      ALTER COLUMN "category" SET NOT NULL
    `);

    // Recreate old unique constraint (name, category, tenant_id)
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_asset_subcategories_unique" ON "asset_subcategories" ("name", "category", "tenant_id")
    `);

    // Step 4: Drop asset_categories table
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_asset_categories_unique"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_asset_categories_tenant"
    `);

    await queryRunner.query(`
      ALTER TABLE "asset_categories"
      DROP CONSTRAINT IF EXISTS "FK_asset_categories_tenant"
    `);

    await queryRunner.query(`
      DROP TABLE "asset_categories"
    `);
  }
}


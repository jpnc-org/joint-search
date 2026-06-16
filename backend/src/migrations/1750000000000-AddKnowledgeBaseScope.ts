import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddKnowledgeBaseScope1750000000000 implements MigrationInterface {
  name = 'AddKnowledgeBaseScope1750000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasKbIdOnFolders = await queryRunner.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'folders' AND column_name = 'knowledgeBaseId'
    `);
    if (hasKbIdOnFolders.length === 0) {
      await queryRunner.query(`ALTER TABLE "folders" ADD "knowledgeBaseId" uuid`);
    }

    const hasKbIdOnFiles = await queryRunner.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'files' AND column_name = 'knowledgeBaseId'
    `);
    if (hasKbIdOnFiles.length === 0) {
      await queryRunner.query(`ALTER TABLE "files" ADD "knowledgeBaseId" uuid`);
    }

    const hasKbIdOnTags = await queryRunner.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'tags' AND column_name = 'knowledgeBaseId'
    `);
    if (hasKbIdOnTags.length === 0) {
      await queryRunner.query(`ALTER TABLE "tags" ADD "knowledgeBaseId" uuid`);
    }

    const users = await queryRunner.query(`SELECT id FROM "users"`);
    for (const user of users) {
      const existingKB = await queryRunner.query(
        `SELECT id FROM "knowledge_bases" WHERE "userId" = $1 LIMIT 1`,
        [user.id]
      );

      let kbId: string;
      if (existingKB.length > 0) {
        kbId = existingKB[0].id;
      } else {
        const result = await queryRunner.query(
          `INSERT INTO "knowledge_bases" ("id", "userId", "name", "description", "createdAt")
           VALUES (gen_random_uuid(), $1, 'Default', NULL, NOW())
           RETURNING id`,
          [user.id]
        );
        kbId = result[0].id;
      }

      await queryRunner.query(
        `UPDATE "folders" SET "knowledgeBaseId" = $1 WHERE "userId" = $2 AND "knowledgeBaseId" IS NULL`,
        [kbId, user.id]
      );
      await queryRunner.query(
        `UPDATE "files" SET "knowledgeBaseId" = $1 WHERE "userId" = $2 AND "knowledgeBaseId" IS NULL`,
        [kbId, user.id]
      );
      await queryRunner.query(
        `UPDATE "tags" SET "knowledgeBaseId" = $1 WHERE "userId" = $2 AND "knowledgeBaseId" IS NULL`,
        [kbId, user.id]
      );
    }

    await queryRunner.query(`ALTER TABLE "folders" ALTER COLUMN "knowledgeBaseId" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "files" ALTER COLUMN "knowledgeBaseId" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "tags" ALTER COLUMN "knowledgeBaseId" SET NOT NULL`);

    await queryRunner.query(`
      ALTER TABLE "folders"
      ADD CONSTRAINT "FK_folders_knowledgeBase"
      FOREIGN KEY ("knowledgeBaseId") REFERENCES "knowledge_bases"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "files"
      ADD CONSTRAINT "FK_files_knowledgeBase"
      FOREIGN KEY ("knowledgeBaseId") REFERENCES "knowledge_bases"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "tags"
      ADD CONSTRAINT "FK_tags_knowledgeBase"
      FOREIGN KEY ("knowledgeBaseId") REFERENCES "knowledge_bases"("id") ON DELETE CASCADE
    `);

    const hasFolderTags = await queryRunner.query(`
      SELECT table_name FROM information_schema.tables WHERE table_name = 'folder_tags'
    `);
    if (hasFolderTags.length > 0) {
      await queryRunner.query(`DROP TABLE "folder_tags"`);
    }

    const hasKbFiles = await queryRunner.query(`
      SELECT table_name FROM information_schema.tables WHERE table_name = 'knowledge_base_files'
    `);
    if (hasKbFiles.length > 0) {
      await queryRunner.query(`DROP TABLE "knowledge_base_files"`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "folders" DROP CONSTRAINT IF EXISTS "FK_folders_knowledgeBase"`);
    await queryRunner.query(`ALTER TABLE "files" DROP CONSTRAINT IF EXISTS "FK_files_knowledgeBase"`);
    await queryRunner.query(`ALTER TABLE "tags" DROP CONSTRAINT IF EXISTS "FK_tags_knowledgeBase"`);

    await queryRunner.query(`ALTER TABLE "folders" ALTER COLUMN "knowledgeBaseId" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "files" ALTER COLUMN "knowledgeBaseId" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "tags" ALTER COLUMN "knowledgeBaseId" DROP NOT NULL`);

    await queryRunner.query(`ALTER TABLE "folders" DROP COLUMN "knowledgeBaseId"`);
    await queryRunner.query(`ALTER TABLE "files" DROP COLUMN "knowledgeBaseId"`);
    await queryRunner.query(`ALTER TABLE "tags" DROP COLUMN "knowledgeBaseId"`);
  }
}

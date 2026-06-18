import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFileRagStatus1750000000003 implements MigrationInterface {
  name = 'AddFileRagStatus1750000000003';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "files" ADD COLUMN "rag_status" varchar NOT NULL DEFAULT 'pending'`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "files" DROP COLUMN "rag_status"`);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMessageReasoning1750000000001 implements MigrationInterface {
  name = 'AddMessageReasoning1750000000001';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "messages" ADD COLUMN "reasoning" text`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "messages" DROP COLUMN "reasoning"`);
  }
}

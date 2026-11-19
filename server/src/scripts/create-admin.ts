import bcrypt from 'bcryptjs';
import { openScriptContext, parseArgs } from './script-context';

const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,64}$/;
export const BCRYPT_ROUNDS = 12;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const email = args.email?.trim().toLowerCase();
  const nickname = args.nickname?.trim() || 'admin';
  const password = process.env.ADMIN_PASSWORD ?? '';
  if (!email) throw new Error('사용법: ADMIN_PASSWORD=<비밀번호> npm run admin:create -- --email <이메일> [--nickname <닉네임>]');
  if (!PASSWORD_RULE.test(password)) throw new Error('ADMIN_PASSWORD는 8~64자, 영문·숫자 포함이어야 함');

  const { dataSource } = await openScriptContext();
  try {
    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await dataSource.query(
      `INSERT INTO users (email, password_hash, nickname, role) VALUES (?, ?, ?, 'ADMIN')
       ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), role = 'ADMIN'`,
      [email, hash, nickname],
    );
    console.log(`관리자 계정 준비 완료: ${email}`);
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});

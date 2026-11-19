import { JwtService } from '@nestjs/jwt';
import { openScriptContext, parseArgs } from './script-context';

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const email = args.email?.trim().toLowerCase();
  if (!email) throw new Error('사용법: npm run admin:token -- --email <관리자 이메일>');

  const { env, dataSource } = await openScriptContext();
  try {
    const [user] = (await dataSource.query("SELECT id FROM users WHERE email = ? AND role = 'ADMIN'", [email])) as {
      id: number | string;
    }[];
    if (!user) throw new Error('관리자 계정을 찾을 수 없음');
    const jwt = new JwtService({ secret: env.jwt.accessSecret });
    const token = await jwt.signAsync(
      { sub: Number(user.id), role: 'ADMIN' },
      { expiresIn: env.jwt.accessTtlSec, algorithm: 'HS256' },
    );
    process.stdout.write(`${token}\n`);
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});

import { Module } from '@nestjs/common';
import { PasskeyLoginController } from './passkey-login.controller';
import { PasskeysController } from './passkeys.controller';
import { PasskeysService } from './passkeys.service';

@Module({
  controllers: [PasskeyLoginController, PasskeysController],
  providers: [PasskeysService],
})
export class PasskeysModule {}

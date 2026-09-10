import { Module } from '@nestjs/common';
import { InvitesService } from './invites.service';
import { InvitesController } from './invites.controller';
import { SwiggyModule } from '../swiggy/swiggy.module';

// SwiggyModule gives us FoodService: guests have no Swiggy account, so their
// menu browsing is brokered with the HOST's grant.
@Module({
  imports: [SwiggyModule],
  controllers: [InvitesController],
  providers: [InvitesService],
  exports: [InvitesService],
})
export class InvitesModule {}

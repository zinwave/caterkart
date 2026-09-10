import { Module } from '@nestjs/common';
import { McpModule } from '../mcp/mcp.module';
import { FoodService } from './food.service';
import { InstamartService } from './instamart.service';
import { SwiggyController } from './swiggy.controller';

@Module({
  imports: [McpModule],
  controllers: [SwiggyController],
  providers: [FoodService, InstamartService],
  exports: [FoodService, InstamartService],
})
export class SwiggyModule {}

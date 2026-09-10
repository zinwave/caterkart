import { Body, Controller, Get, Header, Param, Patch, Post, Put, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CorporateService } from './corporate.service';
import {
  CreateGroupOrderDto, InvoiceStatusDto, JoinDto, SetLinesDto, SignInDto, SignInEmailDto,
  UpdateCompanyDto, UpdateCostCenterDto,
} from './corporate.dto';

/**
 * CaterKart for Work HTTP surface. The global 'api' prefix makes these
 * /api/work/*. The frontend calls these instead of holding any logic itself.
 */
@Controller('work')
export class CorporateController {
  constructor(private readonly svc: CorporateService) {}

  // ── Bootstrap ──
  @Get('overview')
  overview(@Query('as') as?: string) {
    return this.svc.getOverview(as);
  }
  @Get('catalogue')
  catalogue() {
    return this.svc.getCatalogue();
  }

  // ── Session ──
  @Get('session')
  session(@Query('as') as?: string) {
    return this.svc.getSession(as);
  }
  @Post('session/sign-in')
  signIn(@Body() dto: SignInDto) {
    return this.svc.signInAs(dto.employeeId);
  }
  @Post('session/sign-in-by-email')
  signInByEmail(@Body() dto: SignInEmailDto) {
    return this.svc.signInByEmail(dto.email);
  }

  // ── Company / cost centres ──
  @Patch('company')
  updateCompany(@Body() dto: UpdateCompanyDto) {
    return this.svc.updateCompany(dto);
  }
  @Patch('cost-centers/:id')
  updateCostCenter(@Param('id') id: string, @Body() dto: UpdateCostCenterDto) {
    return this.svc.updateCostCenter(id, dto);
  }

  // ── Invoices ──
  @Get('invoices/:id')
  invoice(@Param('id') id: string) {
    return this.svc.getInvoice(id);
  }
  @Get('invoices/:id/export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  exportCsv(@Param('id') id: string, @Res() res: Response) {
    const { filename, csv } = this.svc.exportInvoiceCsv(id);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }
  @Post('invoices/:id/status')
  setInvoiceStatus(@Param('id') id: string, @Body() dto: InvoiceStatusDto) {
    return this.svc.setInvoiceStatus(id, dto.status);
  }

  // ── Group orders ──
  @Get('group-orders/:id')
  groupOrder(@Param('id') id: string) {
    return this.svc.getGroupOrder(id);
  }
  @Get('join/:token')
  byToken(@Param('token') token: string) {
    return this.svc.getGroupOrderByToken(token);
  }
  @Post('group-orders')
  createGroupOrder(@Body() dto: CreateGroupOrderDto) {
    return this.svc.createGroupOrder(dto);
  }
  @Post('group-orders/:id/join')
  join(@Param('id') id: string, @Body() dto: JoinDto) {
    return this.svc.joinGroupOrder(id, dto.employeeId);
  }
  @Put('group-orders/:id/participants/:employeeId/lines')
  setLines(@Param('id') id: string, @Param('employeeId') employeeId: string, @Body() dto: SetLinesDto) {
    return this.svc.setParticipantLines(id, employeeId, dto.lines);
  }
  @Post('group-orders/:id/participants/:employeeId/submit')
  submit(@Param('id') id: string, @Param('employeeId') employeeId: string) {
    return this.svc.submitParticipant(id, employeeId);
  }
  @Post('group-orders/:id/place')
  place(@Param('id') id: string) {
    return this.svc.placeGroupOrder(id);
  }
  @Post('group-orders/:id/cancel')
  cancel(@Param('id') id: string) {
    return this.svc.cancelGroupOrder(id);
  }
}

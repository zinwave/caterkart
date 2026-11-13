import { ArgumentsHost, BadRequestException, ForbiddenException, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { NeedsReauthError, PlacementFailedError, ToolError } from '../mcp/mcp.errors';

/**
 * The filter decides what the outside world learns when something fails. These
 * tests pin the two halves of that: clients get a stable `code` to branch on,
 * and internal detail (stacks, schema names, user ids) never reaches them.
 */
describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let status: jest.Mock;
  let json: jest.Mock;
  let host: ArgumentsHost;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    json = jest.fn();
    status = jest.fn().mockReturnValue({ json });

    host = {
      switchToHttp: () => ({
        getResponse: () => ({ status, json, headersSent: false, end: jest.fn() }),
        getRequest: () => ({ method: 'GET', originalUrl: '/api/celebrations/abc?x=1' }),
      }),
    } as unknown as ArgumentsHost;

    // The filter logs 5xx; keep the test output clean without hiding real calls.
    jest.spyOn(filter['logger'], 'error').mockImplementation(() => undefined);
    jest.spyOn(filter['logger'], 'warn').mockImplementation(() => undefined);
  });

  const body = () => json.mock.calls[0][0];

  it('maps an expired Swiggy grant to 401 without echoing the user id', () => {
    filter.catch(new NeedsReauthError('user_secret_cuid'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    expect(body().code).toBe('SWIGGY_REAUTH_REQUIRED');
    expect(JSON.stringify(body())).not.toContain('user_secret_cuid');
  });

  it("surfaces Swiggy's own refusal text, which is written for the user", () => {
    filter.catch(new ToolError('apply_coupon', 'Add ₹610 more to avail this offer'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(body()).toMatchObject({
      code: 'SWIGGY_REFUSED',
      message: 'Add ₹610 more to avail this offer',
    });
  });

  it('does not leak the underlying cause of a failed placement', () => {
    const cause = new Error('ECONNRESET mcp.swiggy.com internal-trace-9f2');
    filter.catch(new PlacementFailedError('place_food_order', cause), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_GATEWAY);
    expect(body().code).toBe('PLACEMENT_FAILED');
    expect(JSON.stringify(body())).not.toContain('ECONNRESET');
  });

  it('turns a Prisma unique-constraint error into 409 without naming the column', () => {
    const err = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed on the fields: (`email`)',
      { code: 'P2002', clientVersion: '6.2.1', meta: { target: ['email'] } },
    );

    filter.catch(err, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(body().code).toBe('ALREADY_EXISTS');
    expect(JSON.stringify(body())).not.toContain('email');
  });

  it('reduces an unrecognised error to a bare 500', () => {
    filter.catch(new Error('connect ECONNREFUSED 10.0.1.4:5432'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(body()).toMatchObject({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    expect(JSON.stringify(body())).not.toContain('10.0.1.4');
  });

  it('preserves the status and message of a deliberate HttpException', () => {
    filter.catch(new BadRequestException('Instamart minimum order is ₹99'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(body()).toMatchObject({
      code: 'INVALID_INPUT',
      message: 'Instamart minimum order is ₹99',
    });
  });

  it('never writes a body over a response that has already started streaming', () => {
    const end = jest.fn();
    const sseHost = {
      switchToHttp: () => ({
        getResponse: () => ({ status, json, headersSent: true, end }),
        getRequest: () => ({ method: 'GET', originalUrl: '/api/celebrations/abc/stream' }),
      }),
    } as unknown as ArgumentsHost;

    filter.catch(new ForbiddenException(), sseHost);

    expect(end).toHaveBeenCalled();
    expect(json).not.toHaveBeenCalled();
  });
});

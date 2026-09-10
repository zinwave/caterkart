import { BadRequestException, Injectable } from '@nestjs/common';
import { McpClientService } from '../mcp/mcp-client.service';
import { mapAddress, mapProduct, mapTracking } from './mappers';
import type {
  Address,
  AddressId,
  OrderId,
  PaymentMethod,
  Product,
  RawAddresses,
  RawProducts,
  SpinId,
  TrackingState,
} from '../mcp/mcp.types';

/**
 * Typed wrappers over the Swiggy Instamart MCP server.
 *
 * Instamart's shape differs from Food: a "product" is a catalogue entry whose
 * price and stock live on its `variations[]`. We flatten to the first available
 * variation and expose its `spinId` — that is the id `update_cart` expects.
 */
@Injectable()
export class InstamartService {
  constructor(private readonly mcp: McpClientService) {}

  private assertAddress(addressId: AddressId, tool: string): void {
    if (!addressId) throw new BadRequestException(`addressId is required for ${tool}`);
  }

  async getAddresses(userId: string): Promise<Address[]> {
    const res = await this.mcp.callTool<RawAddresses>('instamart', userId, 'get_addresses', {
      pageSize: 50,
    });
    return (res?.addresses ?? []).map(mapAddress);
  }

  /** Powers the pantry-aware pre-drop: what this user reorders most. */
  async yourGoToItems(userId: string, addressId: AddressId): Promise<Product[]> {
    this.assertAddress(addressId, 'your_go_to_items');
    const res = await this.mcp.callTool<RawProducts>('instamart', userId, 'your_go_to_items', {
      addressId,
    });
    return (res?.products ?? []).map(mapProduct).filter((p): p is Product => p !== null);
  }

  async searchProducts(userId: string, addressId: AddressId, query: string): Promise<Product[]> {
    this.assertAddress(addressId, 'search_products');
    const res = await this.mcp.callTool<RawProducts>('instamart', userId, 'search_products', {
      addressId,
      query,
    });
    return (res?.products ?? []).map(mapProduct).filter((p): p is Product => p !== null);
  }

  /** items are keyed by spinId — the variation id, not the productId. */
  updateCart(
    userId: string,
    addressId: AddressId,
    items: Array<{ spinId: SpinId; quantity: number }>,
  ): Promise<unknown> {
    this.assertAddress(addressId, 'update_cart');
    return this.mcp.callTool('instamart', userId, 'update_cart', {
      selectedAddressId: addressId,
      items,
    });
  }

  getCart(userId: string): Promise<unknown> {
    return this.mcp.callTool('instamart', userId, 'get_cart', {});
  }

  clearCart(userId: string): Promise<unknown> {
    return this.mcp.callTool('instamart', userId, 'clear_cart', {});
  }

  /** NOT idempotent — see FoodService.placeFoodOrder. */
  checkout(
    userId: string,
    addressId: AddressId,
    paymentMethod: PaymentMethod = 'COD',
  ): Promise<{ orderId: OrderId }> {
    this.assertAddress(addressId, 'checkout');
    return this.mcp.callTool(
      'instamart',
      userId,
      'checkout',
      { addressId, paymentMethod },
      { idempotent: false },
    );
  }

  getOrders(userId: string, activeOnly = false): Promise<unknown> {
    return this.mcp.callTool('instamart', userId, 'get_orders', { activeOnly });
  }

  /** Instamart tracking needs coordinates, unlike Food. */
  async trackOrder(
    userId: string,
    orderId: OrderId,
    lat?: number,
    lng?: number,
  ): Promise<TrackingState> {
    const raw = await this.mcp.callTool('instamart', userId, 'track_order', { orderId, lat, lng });
    return mapTracking(raw);
  }
}

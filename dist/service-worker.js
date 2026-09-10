/*
 * Kill switch, not a service worker.
 *
 * The previous site at caterkart.in was a CRA build that registered a real
 * service worker at this exact path. That registration is bound to the origin,
 * not to whoever answers at it, so it survived the move to CloudFront: visitors
 * who had ever loaded the old site kept being served the old app from Cache
 * Storage on every soft reload, while a hard reload (which bypasses the worker)
 * showed the new one.
 *
 * A 404 here would eventually clear the registration on its own, but only on
 * the browser's own update schedule and without emptying the caches it left
 * behind. This does it deliberately and immediately instead.
 *
 * The current app registers no service worker. Once the old registrations are
 * gone this file is inert, but it must keep being served: deleting it would
 * bring back the 404 for anyone whose browser has still not checked in.
 */

// Take over without waiting for the old worker's clients to close.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Empty every cache the old worker filled. Names are unknown here, and
      // they are all stale by definition, so drop the lot.
      const names = await caches.keys();
      await Promise.all(names.map((name) => caches.delete(name)));

      await self.registration.unregister();

      // Reload anything already open, which is still showing the old shell.
      // Without this the fix only lands on the *next* navigation.
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) {
        client.navigate(client.url);
      }
    })(),
  );
});

// Deliberately no fetch handler: with none registered, requests go straight to
// the network and this worker never serves a byte of content.

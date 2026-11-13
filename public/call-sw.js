self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const data = notification.data || {};
  const action = event.action === 'accept' || event.action === 'reject' ? event.action : 'focus';

  notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          if (action !== 'reject') {
            await client.focus();
          }
          client.postMessage({
            type: 'WHATAPP_CALL_ACTION',
            action,
            callId: data.callId || '',
          });
          return;
        }
      }
      if (action !== 'reject' && self.clients.openWindow) {
        await self.clients.openWindow('/');
      }
    })
  );
});

// Service Worker for Push Notifications
const CACHE_NAME = 'shree-gor-v1';

// Install event
self.addEventListener('install', (event) => {
    console.log('Service Worker installing...');
    self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
    console.log('Service Worker activating...');
    event.waitUntil(clients.claim());
});

// Push notification received
self.addEventListener('push', (event) => {
    console.log('Push notification received:', event);

    let notificationData = {
        title: 'Shree Gor Veggies',
        body: 'You have a new update!',
        icon: '/icon-192.png',
        badge: '/badge-72.png',
        data: {
            url: '/'
        }
    };

    if (event.data) {
        try {
            notificationData = event.data.json();
        } catch (e) {
            notificationData.body = event.data.text();
        }
    }

    const options = {
        body: notificationData.body,
        icon: notificationData.icon || '/icon-192.png',
        badge: notificationData.badge || '/badge-72.png',
        image: notificationData.image,
        vibrate: [200, 100, 200],
        data: notificationData.data || { url: '/' },
        actions: [
            { action: 'open', title: 'View', icon: '/icon-check.png' },
            { action: 'close', title: 'Close', icon: '/icon-close.png' }
        ],
        requireInteraction: false,
        tag: notificationData.tag || 'default'
    };

    event.waitUntil(
        self.registration.showNotification(notificationData.title, options)
    );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
    console.log('Notification clicked:', event);
    event.notification.close();

    if (event.action === 'close') {
        return;
    }

    const urlToOpen = event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // Check if app is already open
                for (let i = 0; i < clientList.length; i++) {
                    const client = clientList[i];
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        return client.focus().then(() => client.navigate(urlToOpen));
                    }
                }
                // Open new window if not already open
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});

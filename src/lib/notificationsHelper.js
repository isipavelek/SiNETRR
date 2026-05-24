import { supabase } from './supabase';

/**
 * Creates a notification either in Supabase or falls back to localStorage.
 * @param {string|null} userId - The target user ID. If null, it's a global notification for all coordinators/managers.
 * @param {string} title - The notification title.
 * @param {string} content - Detailed text description.
 * @param {string} category - Category: 'red_card', 'coordination', 'planning', 'system'
 */
export async function createNotification(userId, title, content, category = 'system') {
    const notificationData = {
        title,
        content,
        category,
        user_id: userId,
        is_read: false,
        created_at: new Date().toISOString()
    };

    try {
        // Try inserting into Supabase
        const { error } = await supabase
            .from('notifications')
            .insert([notificationData]);

        if (error) {
            // If the table doesn't exist, we fall back to localStorage
            if (error.code === '42P01' || error.message?.includes('does not exist')) {
                saveToLocalStorage(notificationData);
            } else {
                console.error("Supabase notification error:", error);
                saveToLocalStorage(notificationData);
            }
        }
    } catch (err) {
        console.warn("Notification fallback triggered:", err);
        saveToLocalStorage(notificationData);
    }
}

/**
 * Saves a notification to localStorage as a fallback.
 */
function saveToLocalStorage(notification) {
    try {
        const localNotifications = JSON.parse(localStorage.getItem('etrr-notifications') || '[]');
        
        // Generate a random local ID
        const localNotif = {
            id: `local-${Math.random().toString(36).substr(2, 9)}`,
            ...notification
        };
        
        localNotifications.unshift(localNotif);
        // Keep last 100 notifications
        if (localNotifications.length > 100) {
            localNotifications.pop();
        }
        
        localStorage.setItem('etrr-notifications', JSON.stringify(localNotifications));
        
        // Trigger a custom event to notify components in the same tab/window
        window.dispatchEvent(new Event('etrr-new-notification'));
    } catch (e) {
        console.error("Failed to save notification locally:", e);
    }
}

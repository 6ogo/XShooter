// src/lib/notificationService.ts
import { supabase } from './supabase';

export interface Notification {
  id: string;
  type: 'achievement' | 'game' | 'social' | 'system';
  title: string;
  message: string;
  isRead: boolean;
  relatedId?: string; // Achievement ID, game ID, etc.
  createdAt: string;
}

class NotificationService {
  // Get all notifications for the current user
  async getNotifications(): Promise<Notification[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      
      // Map to interface format
      return (data || []).map(notification => ({
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        isRead: notification.is_read,
        relatedId: notification.related_id,
        createdAt: notification.created_at
      }));
    } catch (error) {
      console.error('Error fetching notifications:', error);
      return [];
    }
  }
  
  // Subscribe to new notifications
  subscribeToNotifications(callback: (notification: Notification) => void) {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user?.id;
    };
    
    // Wrap in async function
    const setupSubscription = async () => {
      const userId = await getUser();
      if (!userId) return null;
      
      return supabase
        .channel('notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`
          },
          (payload) => {
            const notification = payload.new as any;
            callback({
              id: notification.id,
              type: notification.type,
              title: notification.title,
              message: notification.message,
              isRead: notification.is_read,
              relatedId: notification.related_id,
              createdAt: notification.created_at
            });
          }
        )
        .subscribe();
    };
    
    // Return the subscription promise
    return setupSubscription();
  }
  
  // Mark notification as read
  async markAsRead(notificationId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);
        
      if (error) throw error;
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }
  
  // Mark all notifications as read
  async markAllAsRead(): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
        
      if (error) throw error;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  }
  
  // Create a system notification (for use when needed from client)
  async createSystemNotification(title: string, message: string): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: user.id,
          type: 'system',
          title,
          message
        });
        
      if (error) throw error;
    } catch (error) {
      console.error('Error creating system notification:', error);
    }
  }
  
  // Create a game notification (for invites and game events)
  async createGameNotification(title: string, message: string, gameId: string): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: user.id,
          type: 'game',
          title,
          message,
          related_id: gameId
        });
        
      if (error) throw error;
    } catch (error) {
      console.error('Error creating game notification:', error);
    }
  }
  
  // Get unread count
  async getUnreadCount(): Promise<number> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;
      
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
        
      if (error) throw error;
      
      return count || 0;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }
}

export const notificationService = new NotificationService();
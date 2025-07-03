import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import type { Message } from '../../types';

export class MessageBus extends EventEmitter {
  private subscribers: Map<string, Set<string>> = new Map(); // topic -> Set<subscriberId>
  private messageHistory: Message[] = [];
  private maxHistorySize = 1000;
  
  subscribe(subscriberId: string, topic: string): void {
    if (!this.subscribers.has(topic)) {
      this.subscribers.set(topic, new Set());
    }
    this.subscribers.get(topic)!.add(subscriberId);
    this.emit('subscribed', { subscriberId, topic });
  }
  
  unsubscribe(subscriberId: string, topic: string): void {
    const topicSubscribers = this.subscribers.get(topic);
    if (topicSubscribers) {
      topicSubscribers.delete(subscriberId);
      if (topicSubscribers.size === 0) {
        this.subscribers.delete(topic);
      }
    }
    this.emit('unsubscribed', { subscriberId, topic });
  }
  
  unsubscribeAll(subscriberId: string): void {
    for (const [topic, subscribers] of this.subscribers.entries()) {
      subscribers.delete(subscriberId);
      if (subscribers.size === 0) {
        this.subscribers.delete(topic);
      }
    }
  }
  
  publish(message: Omit<Message, 'id' | 'timestamp'>): void {
    const fullMessage: Message = {
      ...message,
      id: uuidv4(),
      timestamp: new Date(),
    };
    
    this.addToHistory(fullMessage);
    
    // Direct message to specific recipient
    if (message.to !== 'broadcast') {
      this.emit(`message:${message.to}`, fullMessage);
    } else {
      // Broadcast message
      const topic = `broadcast:${message.type}`;
      const subscribers = this.subscribers.get(topic);
      
      if (subscribers && subscribers.size > 0) {
        for (const subscriberId of subscribers) {
          this.emit(`message:${subscriberId}`, fullMessage);
        }
      }
    }
    
    // Always emit a general message event
    this.emit('message', fullMessage);
  }
  
  getHistory(filter?: {
    from?: string;
    to?: string;
    type?: Message['type'];
    limit?: number;
  }): Message[] {
    let filtered = [...this.messageHistory];
    
    if (filter?.from) {
      filtered = filtered.filter((m) => m.from === filter.from);
    }
    if (filter?.to) {
      filtered = filtered.filter((m) => m.to === filter.to);
    }
    if (filter?.type) {
      filtered = filtered.filter((m) => m.type === filter.type);
    }
    
    const limit = filter?.limit || filtered.length;
    return filtered.slice(-limit);
  }
  
  private addToHistory(message: Message): void {
    this.messageHistory.push(message);
    
    // Trim history if it exceeds max size
    if (this.messageHistory.length > this.maxHistorySize) {
      this.messageHistory = this.messageHistory.slice(-this.maxHistorySize);
    }
  }
  
  clear(): void {
    this.subscribers.clear();
    this.messageHistory = [];
    this.removeAllListeners();
  }
}
import { MessageBus } from '../../../../src/core/messaging/MessageBus';

describe('MessageBus', () => {
  let messageBus: MessageBus;
  
  beforeEach(() => {
    messageBus = new MessageBus();
  });
  
  afterEach(() => {
    messageBus.clear();
  });
  
  describe('subscribe/unsubscribe', () => {
    it('should subscribe to topics', () => {
      const subscriberId = 'test-subscriber';
      const topic = 'broadcast:command';
      
      messageBus.subscribe(subscriberId, topic);
      
      // Verify subscription by publishing a message
      const handler = jest.fn();
      messageBus.on(`message:${subscriberId}`, handler);
      
      messageBus.publish({
        from: 'sender',
        to: 'broadcast',
        type: 'command',
        payload: 'test message',
      });
      
      expect(handler).toHaveBeenCalled();
    });
    
    it('should unsubscribe from topics', () => {
      const subscriberId = 'test-subscriber';
      const topic = 'broadcast:test';
      
      messageBus.subscribe(subscriberId, topic);
      messageBus.unsubscribe(subscriberId, topic);
      
      const handler = jest.fn();
      messageBus.on(`message:${subscriberId}`, handler);
      
      messageBus.publish({
        from: 'sender',
        to: 'broadcast',
        type: 'command',
        payload: 'test message',
      });
      
      expect(handler).not.toHaveBeenCalled();
    });
    
    it('should unsubscribe from all topics', () => {
      const subscriberId = 'test-subscriber';
      
      messageBus.subscribe(subscriberId, 'topic1');
      messageBus.subscribe(subscriberId, 'topic2');
      messageBus.unsubscribeAll(subscriberId);
      
      const handler = jest.fn();
      messageBus.on(`message:${subscriberId}`, handler);
      
      messageBus.publish({
        from: 'sender',
        to: 'broadcast',
        type: 'command',
        payload: 'test',
      });
      
      expect(handler).not.toHaveBeenCalled();
    });
  });
  
  describe('publish', () => {
    it('should publish direct messages', () => {
      const handler = jest.fn();
      const targetId = 'target-instance';
      
      messageBus.on(`message:${targetId}`, handler);
      
      messageBus.publish({
        from: 'sender',
        to: targetId,
        type: 'command',
        payload: 'test message',
      });
      
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'sender',
          to: targetId,
          type: 'command',
          payload: 'test message',
          id: expect.any(String),
          timestamp: expect.any(Date),
        })
      );
    });
    
    it('should broadcast messages to subscribers', () => {
      const subscriber1 = 'sub1';
      const subscriber2 = 'sub2';
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      
      messageBus.subscribe(subscriber1, 'broadcast:command');
      messageBus.subscribe(subscriber2, 'broadcast:command');
      
      messageBus.on(`message:${subscriber1}`, handler1);
      messageBus.on(`message:${subscriber2}`, handler2);
      
      messageBus.publish({
        from: 'sender',
        to: 'broadcast',
        type: 'command',
        payload: 'broadcast message',
      });
      
      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });
    
    it('should emit general message event', (done) => {
      messageBus.on('message', (message) => {
        expect(message).toMatchObject({
          from: 'sender',
          to: 'target',
          type: 'command',
          payload: 'test',
        });
        done();
      });
      
      messageBus.publish({
        from: 'sender',
        to: 'target',
        type: 'command',
        payload: 'test',
      });
    });
  });
  
  describe('getHistory', () => {
    beforeEach(() => {
      // Add some test messages
      messageBus.publish({
        from: 'sender1',
        to: 'target1',
        type: 'command',
        payload: 'message1',
      });
      
      messageBus.publish({
        from: 'sender2',
        to: 'target2',
        type: 'response',
        payload: 'message2',
      });
      
      messageBus.publish({
        from: 'sender1',
        to: 'broadcast',
        type: 'event',
        payload: 'message3',
      });
    });
    
    it('should return all messages without filter', () => {
      const history = messageBus.getHistory();
      expect(history).toHaveLength(3);
    });
    
    it('should filter by from', () => {
      const history = messageBus.getHistory({ from: 'sender1' });
      expect(history).toHaveLength(2);
      expect(history.every(m => m.from === 'sender1')).toBe(true);
    });
    
    it('should filter by to', () => {
      const history = messageBus.getHistory({ to: 'broadcast' });
      expect(history).toHaveLength(1);
      expect(history[0]?.to).toBe('broadcast');
    });
    
    it('should filter by type', () => {
      const history = messageBus.getHistory({ type: 'command' });
      expect(history).toHaveLength(1);
      expect(history[0]?.type).toBe('command');
    });
    
    it('should limit results', () => {
      const history = messageBus.getHistory({ limit: 2 });
      expect(history).toHaveLength(2);
    });
    
    it('should apply multiple filters', () => {
      const history = messageBus.getHistory({
        from: 'sender1',
        type: 'command',
      });
      expect(history).toHaveLength(1);
      expect(history[0]?.payload).toBe('message1');
    });
  });
  
  describe('clear', () => {
    it('should clear all data', () => {
      messageBus.subscribe('sub1', 'topic1');
      messageBus.publish({
        from: 'sender',
        to: 'target',
        type: 'command',
        payload: 'test',
      });
      
      messageBus.clear();
      
      const history = messageBus.getHistory();
      expect(history).toHaveLength(0);
      
      // Verify subscriptions are cleared
      const handler = jest.fn();
      messageBus.on('message:sub1', handler);
      messageBus.publish({
        from: 'sender',
        to: 'broadcast',
        type: 'command',
        payload: 'test',
      });
      
      expect(handler).not.toHaveBeenCalled();
    });
  });
});
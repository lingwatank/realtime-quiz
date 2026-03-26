// 客户端加入模块 - 支持 KV 存储
import KVStore from './kvStore.js';

export default class ClientJoin {
  constructor(env) {
    this.kvStore = new KVStore(env);
    this.clients = new Set();
    this.clientIdCounter = 1;
    this.initialized = false;
  }

  // 初始化，从 KV 加载数据
  async init() {
    if (this.initialized) return;
    
    const storedClients = await this.kvStore.getClients();
    if (storedClients && storedClients.length > 0) {
      this.clients = new Set(storedClients);
      // 恢复计数器
      const maxId = storedClients.reduce((max, clientId) => {
        const num = parseInt(clientId.replace('client_', ''));
        return Math.max(max, num);
      }, 0);
      this.clientIdCounter = maxId + 1;
    }
    this.initialized = true;
  }

  // 确保已初始化
  async ensureInitialized() {
    if (!this.initialized) {
      await this.init();
    }
  }

  // 保存客户端到 KV
  async saveClients() {
    const clientsArray = Array.from(this.clients);
    await this.kvStore.saveClients(clientsArray);
  }

  // 加入客户端
  async joinClient() {
    await this.ensureInitialized();
    
    const clientId = `client_${this.clientIdCounter++}`;
    this.clients.add(clientId);
    
    // 保存到 KV
    await this.saveClients();
    
    return {
      success: true,
      clientId: clientId,
      message: '成功加入答题互动'
    };
  }

  // 离开客户端
  async leaveClient(clientId) {
    await this.ensureInitialized();
    
    const removed = this.clients.delete(clientId);
    
    // 保存到 KV
    if (removed) {
      await this.saveClients();
    }
    
    return {
      success: removed,
      message: removed ? '成功离开答题互动' : '客户端不存在'
    };
  }

  // 获取活跃客户端数量
  async getActiveClientCount() {
    await this.ensureInitialized();
    return this.clients.size;
  }

  // 获取所有活跃客户端
  async getActiveClients() {
    await this.ensureInitialized();
    return Array.from(this.clients);
  }

  // 检查客户端是否活跃
  async isClientActive(clientId) {
    await this.ensureInitialized();
    return this.clients.has(clientId);
  }
}

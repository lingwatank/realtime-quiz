// KV 存储封装模块
export default class KVStore {
  constructor(env) {
    this.kv = env?.EXAM_KV;
  }

  // 检查 KV 是否可用
  isAvailable() {
    return this.kv !== undefined && this.kv !== null;
  }

  // 获取数据
  async get(key, defaultValue = null) {
    if (!this.isAvailable()) {
      return defaultValue;
    }
    try {
      const value = await this.kv.get(key);
      return value ? JSON.parse(value) : defaultValue;
    } catch (error) {
      console.error(`KV get error for key ${key}:`, error);
      return defaultValue;
    }
  }

  // 存储数据
  async put(key, value) {
    if (!this.isAvailable()) {
      return false;
    }
    try {
      await this.kv.put(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`KV put error for key ${key}:`, error);
      return false;
    }
  }

  // 删除数据
  async delete(key) {
    if (!this.isAvailable()) {
      return false;
    }
    try {
      await this.kv.delete(key);
      return true;
    } catch (error) {
      console.error(`KV delete error for key ${key}:`, error);
      return false;
    }
  }

  // 获取所有键（带前缀）
  async list(prefix = '') {
    if (!this.isAvailable()) {
      return [];
    }
    try {
      const list = await this.kv.list({ prefix });
      return list.keys.map(k => k.name);
    } catch (error) {
      console.error(`KV list error for prefix ${prefix}:`, error);
      return [];
    }
  }

  // 题目相关操作
  async getQuestions() {
    return await this.get('questions', []);
  }

  async saveQuestions(questions) {
    return await this.put('questions', questions);
  }

  // 答题记录相关操作
  async getAnswerRecords() {
    return await this.get('answer_records', []);
  }

  async saveAnswerRecords(records) {
    return await this.put('answer_records', records);
  }

  // 历史题目相关操作
  async getQuestionHistory() {
    return await this.get('question_history', []);
  }

  async saveQuestionHistory(history) {
    return await this.put('question_history', history);
  }

  // 客户端相关操作
  async getClients() {
    return await this.get('clients', []);
  }

  async saveClients(clients) {
    return await this.put('clients', clients);
  }

  // 计数器相关操作
  async getCounter(key, defaultValue = 0) {
    return await this.get(`counter:${key}`, defaultValue);
  }

  async setCounter(key, value) {
    return await this.put(`counter:${key}`, value);
  }

  async incrementCounter(key, increment = 1) {
    const current = await this.getCounter(key, 0);
    const newValue = current + increment;
    await this.setCounter(key, newValue);
    return newValue;
  }
}

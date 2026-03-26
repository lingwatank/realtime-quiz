// 题目上传模块 - 支持 KV 存储和时效管理（单题模式）
import KVStore from './kvStore.js';

export default class QuestionUpload {
  constructor(env) {
    this.kvStore = new KVStore(env);
    this.questions = [];
    this.questionHistory = [];
    this.initialized = false;
  }

  // 初始化，从 KV 加载数据
  async init() {
    if (this.initialized) return;

    const storedQuestions = await this.kvStore.getQuestions();
    this.questions = storedQuestions || [];

    const storedHistory = await this.kvStore.getQuestionHistory();
    this.questionHistory = storedHistory || [];

    this.initialized = true;
  }

  // 确保已初始化
  async ensureInitialized() {
    if (!this.initialized) {
      await this.init();
    }
  }

  // 检查是否有未失效的题目
  async hasActiveQuestion() {
    await this.ensureInitialized();
    
    for (const question of this.questions) {
      if (!this.isQuestionExpired(question)) {
        return question;
      }
    }
    return null;
  }

  // 上传题目（单题模式：旧题目移到历史，保留新题目）
  async uploadQuestion(question, force = false) {
    await this.ensureInitialized();

    // 检查是否有未失效的题目
    const activeQuestion = await this.hasActiveQuestion();
    if (activeQuestion && !force) {
      return {
        success: false,
        hasActiveQuestion: true,
        activeQuestion: activeQuestion,
        message: '当前已有未失效的题目，请先删除旧题目或强制覆盖'
      };
    }

    // 如果有旧题目，移到历史记录
    if (this.questions.length > 0) {
      const oldQuestion = this.questions[0];
      // 标记为已过期（如果还没过期）
      if (!this.isQuestionExpired(oldQuestion)) {
        oldQuestion.expiresAt = new Date().toISOString();
        oldQuestion.expired = true;
      }
      this.questionHistory.unshift(oldQuestion); // 添加到历史开头
      await this.kvStore.saveQuestionHistory(this.questionHistory);
      this.questions = [];
    }

    // 生成唯一 ID
    const id = await this.kvStore.incrementCounter('question_id', 1);

    const newQuestion = {
      id: id,
      text: question.text,
      type: question.type,
      options: question.options,
      correctAnswer: question.correctAnswer,
      createdAt: new Date().toISOString(),
      submissions: 0,
      correctCount: 0,
      // 时效相关字段
      expiresAt: question.expiresAt || null,
      durationSeconds: question.durationSeconds || 0
    };

    this.questions.push(newQuestion);

    // 保存到 KV
    await this.kvStore.saveQuestions(this.questions);

    return {
      success: true,
      data: newQuestion,
      replaced: activeQuestion !== null,
      message: activeQuestion ? '已替换旧题目' : '题目推送成功'
    };
  }

  // 获取所有题目（实际只有一道）
  async getAllQuestions() {
    await this.ensureInitialized();
    return this.questions;
  }

  // 获取历史题目
  async getQuestionHistory() {
    await this.ensureInitialized();
    return this.questionHistory;
  }

  // 根据 ID 获取题目（包括当前题目和历史题目）
  async getQuestionById(id) {
    await this.ensureInitialized();
    // 先在当前题目中查找
    let question = this.questions.find(q => q.id === id);
    if (question) {
      return question;
    }
    // 如果在当前题目中找不到，则在历史题目中查找
    return this.questionHistory.find(q => q.id === id) || null;
  }

  // 获取当前活跃题目
  async getActiveQuestion() {
    await this.ensureInitialized();
    return this.questions.find(q => !this.isQuestionExpired(q)) || null;
  }

  // 删除指定题目
  async deleteQuestion(id) {
    await this.ensureInitialized();
    
    const index = this.questions.findIndex(q => q.id === id);
    if (index !== -1) {
      const deleted = this.questions.splice(index, 1)[0];
      
      // 保存到 KV
      await this.kvStore.saveQuestions(this.questions);
      
      return {
        success: true,
        deleted: deleted,
        message: '题目删除成功'
      };
    }
    return {
      success: false,
      message: '题目不存在'
    };
  }

  // 删除所有题目（包括当前题目和历史题目）
  async deleteAllQuestions() {
    await this.ensureInitialized();

    const currentCount = this.questions.length;
    const historyCount = this.questionHistory.length;

    try {
      // 清空当前题目
      this.questions = [];
      await this.kvStore.saveQuestions(this.questions);

      // 清空历史题目
      this.questionHistory = [];
      await this.kvStore.saveQuestionHistory(this.questionHistory);

      return {
        success: true,
        deletedCount: currentCount + historyCount,
        message: `已删除 ${currentCount} 道当前题目和 ${historyCount} 道历史题目`
      };
    } catch (error) {
      return {
        success: false,
        message: '删除题目失败: ' + error.message
      };
    }
  }

  // 更新题目统计
  async updateQuestionStats(id, isCorrect) {
    await this.ensureInitialized();
    
    const question = await this.getQuestionById(id);
    if (question) {
      question.submissions += 1;
      if (isCorrect) {
        question.correctCount += 1;
      }
      
      // 保存到 KV
      await this.kvStore.saveQuestions(this.questions);
      
      return question;
    }
    return null;
  }

  // 检查题目是否已过期
  isQuestionExpired(question) {
    if (!question || !question.expiresAt) {
      return false; // 没有设置过期时间，永不过期
    }
    const now = new Date().getTime();
    const expireTime = new Date(question.expiresAt).getTime();
    return now > expireTime;
  }

  // 获取题目状态信息
  getQuestionStatus(question) {
    if (!question.expiresAt) {
      return { expired: false, remainingSeconds: null, message: '永久有效' };
    }
    
    const now = new Date().getTime();
    const expireTime = new Date(question.expiresAt).getTime();
    const remaining = expireTime - now;
    
    if (remaining <= 0) {
      return { expired: true, remainingSeconds: 0, message: '已过期' };
    }
    
    return { 
      expired: false, 
      remainingSeconds: Math.floor(remaining / 1000), 
      message: `剩余 ${Math.ceil(remaining / 60000)} 分钟`
    };
  }
}

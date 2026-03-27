// 题库管理模块 - 支持 KV 存储
import KVStore from './kvStore.js';

export default class QuestionBank {
  constructor(env) {
    this.kvStore = new KVStore(env);
    this.bank = null;
    this.initialized = false;
  }

  // 初始化，从 KV 加载数据
  async init() {
    if (this.initialized) return;

    this.bank = await this.kvStore.getQuestionBank();
    this.initialized = true;
  }

  // 确保已初始化
  async ensureInitialized() {
    if (!this.initialized) {
      await this.init();
    }
  }

  // 获取完整题库
  async getBank() {
    await this.ensureInitialized();
    return this.bank;
  }

  // 获取题库中的所有题目
  async getQuestions() {
    await this.ensureInitialized();
    return this.bank.questions || [];
  }

  // 根据 ID 获取题目
  async getQuestionById(id) {
    await this.ensureInitialized();
    return this.bank.questions.find(q => q.id === id) || null;
  }

  // 导入题库（覆盖现有题库）
  async importBank(questions) {
    await this.ensureInitialized();

    // 验证题目格式
    const validQuestions = questions.filter(q => {
      return q.id && q.text && q.options && q.correctAnswer;
    });

    this.bank = {
      version: '1.0',
      updatedAt: new Date().toISOString(),
      count: validQuestions.length,
      questions: validQuestions
    };

    await this.kvStore.saveQuestionBank(this.bank);

    return {
      success: true,
      count: validQuestions.length,
      message: `成功导入 ${validQuestions.length} 道题目`
    };
  }

  // 添加单道题目到题库
  async addQuestion(question) {
    await this.ensureInitialized();

    // 验证必填字段
    if (!question.id || !question.text || !question.options || !question.correctAnswer) {
      return {
        success: false,
        message: '题目信息不完整，需要 id, text, options, correctAnswer'
      };
    }

    // 检查 ID 是否已存在
    const existingIndex = this.bank.questions.findIndex(q => q.id === question.id);
    if (existingIndex !== -1) {
      // 更新现有题目
      this.bank.questions[existingIndex] = {
        ...question,
        importedAt: new Date().toISOString()
      };
    } else {
      // 添加新题目
      this.bank.questions.push({
        ...question,
        importedAt: new Date().toISOString()
      });
    }

    this.bank.count = this.bank.questions.length;
    this.bank.updatedAt = new Date().toISOString();

    await this.kvStore.saveQuestionBank(this.bank);

    return {
      success: true,
      question: question,
      message: existingIndex !== -1 ? '题目更新成功' : '题目添加成功'
    };
  }

  // 从题库删除题目
  async deleteQuestion(id) {
    await this.ensureInitialized();

    const index = this.bank.questions.findIndex(q => q.id === id);
    if (index === -1) {
      return {
        success: false,
        message: '题目不存在'
      };
    }

    const deleted = this.bank.questions.splice(index, 1)[0];
    this.bank.count = this.bank.questions.length;
    this.bank.updatedAt = new Date().toISOString();

    await this.kvStore.saveQuestionBank(this.bank);

    return {
      success: true,
      deleted: deleted,
      message: '题目删除成功'
    };
  }

  // 清空题库
  async clearBank() {
    await this.ensureInitialized();

    const oldCount = this.bank.count;

    this.bank = {
      version: '1.0',
      updatedAt: new Date().toISOString(),
      count: 0,
      questions: []
    };

    await this.kvStore.saveQuestionBank(this.bank);

    return {
      success: true,
      deletedCount: oldCount,
      message: `已清空 ${oldCount} 道题目`
    };
  }

  // 从题库推送题目到当前题目
  async pushToCurrent(id, questionUpload) {
    await this.ensureInitialized();

    const question = await this.getQuestionById(id);
    if (!question) {
      return {
        success: false,
        message: '题库中不存在该题目'
      };
    }

    // 计算过期时间
    const durationSeconds = question.durationSeconds || 10;
    const expireDate = new Date();
    expireDate.setSeconds(expireDate.getSeconds() + durationSeconds);
    const expiresAt = expireDate.toISOString();

    // 构建题目数据
    const questionData = {
      text: question.text,
      type: 'single',
      options: question.options,
      correctAnswer: question.correctAnswer,
      durationSeconds: durationSeconds,
      expiresAt: expiresAt,
      bankQuestionId: question.id // 记录来源题库ID
    };

    // 调用现有上传方法
    return await questionUpload.uploadQuestion(questionData, true);
  }

  // 获取下一题（按顺序）
  async getNextQuestion(currentId) {
    await this.ensureInitialized();

    const questions = this.bank.questions;
    if (questions.length === 0) {
      return null;
    }

    if (!currentId) {
      return questions[0];
    }

    const currentIndex = questions.findIndex(q => q.id === currentId);
    if (currentIndex === -1 || currentIndex >= questions.length - 1) {
      return questions[0]; // 循环到第一题
    }

    return questions[currentIndex + 1];
  }

  // 获取上一题
  async getPrevQuestion(currentId) {
    await this.ensureInitialized();

    const questions = this.bank.questions;
    if (questions.length === 0) {
      return null;
    }

    if (!currentId) {
      return questions[questions.length - 1];
    }

    const currentIndex = questions.findIndex(q => q.id === currentId);
    if (currentIndex <= 0) {
      return questions[questions.length - 1]; // 循环到最后一题
    }

    return questions[currentIndex - 1];
  }
}

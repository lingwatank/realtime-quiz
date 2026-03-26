// 答案记录模块 - 支持 KV 存储和参与者信息
import KVStore from './kvStore.js';

export default class AnswerRecord {
  constructor(env) {
    this.kvStore = new KVStore(env);
    this.records = [];
    this.initialized = false;
  }

  // 初始化，从 KV 加载数据
  async init() {
    if (this.initialized) return;
    
    const storedRecords = await this.kvStore.getAnswerRecords();
    this.records = storedRecords || [];
    this.initialized = true;
  }

  // 确保已初始化
  async ensureInitialized() {
    if (!this.initialized) {
      await this.init();
    }
  }

  // 记录答案（包含参与者信息）
  async recordAnswer(questionId, userAnswer, isCorrect, userId, nickname) {
    await this.ensureInitialized();
    
    // 生成唯一 ID
    const id = await this.kvStore.incrementCounter('record_id', 1);
    
    const record = {
      id: id,
      questionId: questionId,
      userAnswer: userAnswer,
      isCorrect: isCorrect,
      userId: userId || 'anonymous_' + Date.now(),
      nickname: nickname || '匿名用户',
      submittedAt: new Date().toISOString()
    };

    this.records.push(record);
    
    // 保存到 KV
    await this.kvStore.saveAnswerRecords(this.records);
    
    return record;
  }

  // 获取所有答案记录
  async getAllRecords() {
    await this.ensureInitialized();
    return this.records;
  }

  // 根据题目 ID 获取答案记录
  async getRecordsByQuestionId(questionId) {
    await this.ensureInitialized();
    return this.records.filter(r => r.questionId === questionId);
  }

  // 根据用户 ID 获取答题记录
  async getRecordsByUserId(userId) {
    await this.ensureInitialized();
    return this.records.filter(r => r.userId === userId);
  }

  // 检查用户是否已经回答过某道题目
  async hasUserAnsweredQuestion(userId, questionId) {
    await this.ensureInitialized();
    return this.records.some(r => r.userId === userId && r.questionId === questionId);
  }

  // 获取用户对特定题目的答题记录
  async getUserAnswerForQuestion(userId, questionId) {
    await this.ensureInitialized();
    return this.records.find(r => r.userId === userId && r.questionId === questionId) || null;
  }

  // 获取统计数据
  async getStatistics() {
    await this.ensureInitialized();
    
    const totalSubmissions = this.records.length;
    const correctCount = this.records.filter(r => r.isCorrect).length;
    const correctRate = totalSubmissions > 0 ? (correctCount / totalSubmissions * 100).toFixed(1) : '0.0';

    return {
      totalSubmissions: totalSubmissions,
      correctCount: correctCount,
      correctRate: correctRate + '%'
    };
  }

  // 获取题目统计数据
  async getQuestionStatistics() {
    await this.ensureInitialized();
    
    const questionStats = {};

    this.records.forEach(record => {
      if (!questionStats[record.questionId]) {
        questionStats[record.questionId] = {
          totalSubmissions: 0,
          correctCount: 0
        };
      }

      questionStats[record.questionId].totalSubmissions += 1;
      if (record.isCorrect) {
        questionStats[record.questionId].correctCount += 1;
      }
    });

    // 计算每个题目的正确率
    Object.keys(questionStats).forEach(questionId => {
      const stats = questionStats[questionId];
      stats.correctRate = (stats.correctCount / stats.totalSubmissions * 100).toFixed(1) + '%';
    });

    return questionStats;
  }

  // 获取参与者统计
  async getParticipantStatistics() {
    await this.ensureInitialized();
    
    const participantMap = {};
    
    this.records.forEach(record => {
      const userId = record.userId;
      if (!participantMap[userId]) {
        participantMap[userId] = {
          userId: userId,
          nickname: record.nickname,
          totalAnswers: 0,
          correctCount: 0,
          lastSubmitAt: record.submittedAt
        };
      }
      
      participantMap[userId].totalAnswers += 1;
      if (record.isCorrect) {
        participantMap[userId].correctCount += 1;
      }
      
      // 更新最后提交时间
      if (new Date(record.submittedAt) > new Date(participantMap[userId].lastSubmitAt)) {
        participantMap[userId].lastSubmitAt = record.submittedAt;
      }
    });
    
    // 转换为数组并计算正确率
    const participants = Object.values(participantMap).map(p => ({
      ...p,
      correctRate: p.totalAnswers > 0 ? (p.correctCount / p.totalAnswers * 100).toFixed(1) + '%' : '0.0%'
    }));
    
    // 按答题数排序
    participants.sort((a, b) => b.totalAnswers - a.totalAnswers);
    
    return participants;
  }

  // 获取参与者的详细答题记录
  async getParticipantDetail(userId) {
    await this.ensureInitialized();
    
    const userRecords = this.records.filter(r => r.userId === userId);
    if (userRecords.length === 0) {
      return null;
    }
    
    const nickname = userRecords[0].nickname;
    const correctCount = userRecords.filter(r => r.isCorrect).length;
    
    return {
      userId: userId,
      nickname: nickname,
      totalAnswers: userRecords.length,
      correctCount: correctCount,
      correctRate: userRecords.length > 0 ? (correctCount / userRecords.length * 100).toFixed(1) + '%' : '0.0%',
      records: userRecords.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
    };
  }

  // 清空所有答题记录
  async clearAllRecords() {
    await this.ensureInitialized();
    
    // 清空内存中的记录
    this.records = [];
    
    // 清空 KV 中的记录
    await this.kvStore.saveAnswerRecords([]);
    
    return { success: true, message: '已清空所有答题记录' };
  }
}

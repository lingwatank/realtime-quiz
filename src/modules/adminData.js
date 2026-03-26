// 管理端数据管理模块 - 支持 KV 存储
export default class AdminData {
  constructor(questionUpload, answerRecord, clientJoin) {
    this.questionUpload = questionUpload;
    this.answerRecord = answerRecord;
    this.clientJoin = clientJoin;
  }

  // 获取综合统计数据
  async getDashboardData() {
    const questions = await this.questionUpload.getAllQuestions();
    const stats = await this.answerRecord.getStatistics();
    const activeClients = await this.clientJoin.getActiveClientCount();
    const participants = await this.answerRecord.getParticipantStatistics();

    return {
      totalQuestions: questions.length,
      totalSubmissions: stats.totalSubmissions,
      correctRate: stats.correctRate,
      activeClients: activeClients,
      totalParticipants: participants.length
    };
  }

  // 获取详细答题数据
  async getDetailedData() {
    const questions = await this.questionUpload.getAllQuestions();
    const questionStats = await this.answerRecord.getQuestionStatistics();

    return questions.map(question => {
      const stats = questionStats[question.id] || {
        totalSubmissions: 0,
        correctCount: 0,
        correctRate: '0.0%'
      };

      // 检查题目是否过期
      const isExpired = this.questionUpload.isQuestionExpired(question);

      return {
        id: question.id,
        text: question.text,
        correctAnswer: question.correctAnswer,
        totalSubmissions: stats.totalSubmissions,
        correctCount: stats.correctCount,
        correctRate: stats.correctRate,
        createdAt: question.createdAt,
        expiresAt: question.expiresAt,
        expired: isExpired
      };
    });
  }

  // 获取题目详情
  async getQuestionDetails(questionId) {
    const question = await this.questionUpload.getQuestionById(questionId);
    if (!question) {
      return null;
    }

    const records = await this.answerRecord.getRecordsByQuestionId(questionId);

    return {
      question: question,
      records: records,
      statistics: {
        totalSubmissions: records.length,
        correctCount: records.filter(r => r.isCorrect).length,
        correctRate: records.length > 0 ? (records.filter(r => r.isCorrect).length / records.length * 100).toFixed(1) + '%' : '0.0%'
      }
    };
  }

  // 获取客户端数据
  async getClientData() {
    return {
      activeClients: await this.clientJoin.getActiveClients(),
      activeClientCount: await this.clientJoin.getActiveClientCount()
    };
  }

  // 获取参与者统计
  async getParticipantStatistics() {
    return await this.answerRecord.getParticipantStatistics();
  }

  // 获取参与者详情
  async getParticipantDetail(userId) {
    return await this.answerRecord.getParticipantDetail(userId);
  }
}

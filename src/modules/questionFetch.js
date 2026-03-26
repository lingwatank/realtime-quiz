// 题目拉取模块 - 支持 KV 存储
export default class QuestionFetch {
  constructor(questionUpload) {
    this.questionUpload = questionUpload;
  }

  // 获取最新题目
  async getLatestQuestion() {
    const questions = await this.questionUpload.getAllQuestions();
    if (questions.length === 0) {
      return null;
    }
    // 按创建时间排序，返回最新的题目
    return questions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
  }

  // 获取题目列表
  async getQuestionList(limit = 10) {
    const questions = await this.questionUpload.getAllQuestions();
    return questions
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit);
  }

  // 根据 ID 获取题目
  async getQuestionById(id) {
    return await this.questionUpload.getQuestionById(id);
  }
}

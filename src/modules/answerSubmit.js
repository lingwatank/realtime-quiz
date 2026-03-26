// 答案提交与校验模块 - 支持 KV 存储和时效校验
export default class AnswerSubmit {
  constructor(questionUpload, answerRecord) {
    this.questionUpload = questionUpload;
    this.answerRecord = answerRecord;
  }

  // 提交答案
  async submitAnswer(questionId, userAnswer, userId, nickname) {
    let question;
    
    // 如果没有提供 questionId，自动获取最新题目
    if (!questionId) {
      const questions = await this.questionUpload.getAllQuestions();
      if (questions.length === 0) {
        return { success: false, message: '暂无题目，请先等待管理员推送题目' };
      }
      // 按创建时间排序，获取最新的题目
      question = questions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
      questionId = question.id;
    } else {
      question = await this.questionUpload.getQuestionById(questionId);
    }
    
    if (!question) {
      return { success: false, message: '题目不存在' };
    }

    // 检查用户是否已经回答过这道题目（防重复提交）
    const hasAnswered = await this.answerRecord.hasUserAnsweredQuestion(userId, questionId);
    if (hasAnswered) {
      const previousAnswer = await this.answerRecord.getUserAnswerForQuestion(userId, questionId);
      // 防御性检查，确保 previousAnswer 存在且数据完整
      if (!previousAnswer) {
        return {
          success: false,
          message: '获取答题记录失败，请重试'
        };
      }
      return {
        success: false,
        alreadyAnswered: true,
        message: '您已经回答过这道题目了',
        previousAnswer: {
          answer: previousAnswer.userAnswer || '未知',
          isCorrect: previousAnswer.isCorrect || false,
          submittedAt: previousAnswer.submittedAt || new Date().toISOString()
        },
        correctAnswer: question.correctAnswer,
        expiredAt: question.expiresAt,
        expired: this.questionUpload.isQuestionExpired(question)
      };
    }

    // 校验题目是否已过期（未回答过的用户）
    if (this.questionUpload.isQuestionExpired(question)) {
      return {
        success: false,
        message: '该题目已过期，无法提交答案',
        expired: true,
        expiredAt: question.expiresAt,
        correctAnswer: question.correctAnswer
      };
    }

    // 验证答案
    const isCorrect = this.validateAnswer(question, userAnswer);

    // 更新题目统计（通过 questionUpload 的 KV 存储）
    await this.questionUpload.updateQuestionStats(questionId, isCorrect);

    // 记录答案（包含参与者信息）
    await this.answerRecord.recordAnswer(questionId, userAnswer, isCorrect, userId, nickname);

    // 获取剩余时间信息
    const status = this.questionUpload.getQuestionStatus(question);

    return {
      success: true,
      isCorrect: isCorrect,
      correctAnswer: question.correctAnswer,
      message: isCorrect ? '回答正确！' : `回答错误，正确答案是 ${question.correctAnswer}`,
      remainingSeconds: status.remainingSeconds,
      expiredAt: question.expiresAt
    };
  }

  // 验证答案
  validateAnswer(question, userAnswer) {
    if (question.type === 'single') {
      // 单选题
      return userAnswer === question.correctAnswer;
    } else if (question.type === 'multiple') {
      // 多选题，按字母排序后比较
      const sortedUserAnswer = userAnswer.split('').sort().join('');
      const sortedCorrectAnswer = question.correctAnswer.split('').sort().join('');
      return sortedUserAnswer === sortedCorrectAnswer;
    }
    return false;
  }
}
